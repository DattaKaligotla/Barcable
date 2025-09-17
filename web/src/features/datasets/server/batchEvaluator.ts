import { fetchLLMCompletion } from "@langfuse/shared/src/server";
import {
  type ChatMessage,
  type ModelParams,
  ChatMessageType,
  ChatMessageRole,
  LLMAdapter,
} from "@langfuse/shared/src/server";
import { deterministicEvaluator } from "./deterministicEvaluator";
import {
  type BatchEvaluationRequest,
  type BatchEvaluationResult,
  type DatasetTestSuite,
  type DatasetItemEvaluation,
} from "./evaluationTypes";
import { prisma } from "@langfuse/shared/src/db";
import { createId as createCuid } from "@paralleldrive/cuid2";

export class DatasetBatchEvaluator {
  async runBatchEvaluation(
    request: BatchEvaluationRequest,
    testSuite: DatasetTestSuite,
  ): Promise<BatchEvaluationResult> {
    const batchId = createCuid();
    const startedAt = new Date().toISOString();

    // Fetch dataset items
    const datasetItems = await this.fetchDatasetItems(
      request.datasetId,
      request.projectId,
      request.sampleSize,
    );

    if (datasetItems.length === 0) {
      throw new Error("No dataset items found");
    }

    const variantResults: BatchEvaluationResult["variantResults"] = [];

    // Evaluate each prompt variant
    for (const variant of request.promptVariants) {
      const evaluations: DatasetItemEvaluation[] = [];

      for (const item of datasetItems) {
        try {
          const evaluation = await this.evaluatePromptVariantOnItem(
            variant,
            item,
            testSuite,
            request.projectId,
          );
          evaluations.push(evaluation);
        } catch (error) {
          // Create failed evaluation
          evaluations.push({
            datasetItemId: item.id,
            input: item.input,
            actualOutput: null,
            expectedOutput: item.expectedOutput,
            results: [],
            overallScore: 0,
            passed: false,
            executedAt: new Date().toISOString(),
            latencyMs: 0,
          });
        }
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(evaluations);

      variantResults.push({
        variantId: variant.id,
        variantName: variant.name,
        evaluations,
        summary,
      });
    }

    return {
      batchId,
      datasetId: request.datasetId,
      testSuiteId: request.testSuiteId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      variantResults,
    };
  }

  private async fetchDatasetItems(
    datasetId: string,
    projectId: string,
    sampleSize?: number,
  ) {
    const queryBuilder = prisma.datasetItem.findMany({
      where: {
        datasetId,
        projectId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        input: true,
        expectedOutput: true,
        metadata: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      ...(sampleSize && { take: sampleSize }),
    });

    return await queryBuilder;
  }

  private async evaluatePromptVariantOnItem(
    variant: BatchEvaluationRequest["promptVariants"][0],
    item: any,
    testSuite: DatasetTestSuite,
    _projectId: string,
  ): Promise<DatasetItemEvaluation> {
    const startTime = Date.now();

    // Prepare the prompt by substituting variables from input
    const prompt = this.substituteVariables(variant.content, item.input);

    // Execute the LLM call
    const actualOutput = await this.executeLLMCall(prompt, variant.modelConfig);

    // Run deterministic evaluations
    const evaluationResults = await deterministicEvaluator.evaluateOutput(
      actualOutput,
      item.expectedOutput ? JSON.stringify(item.expectedOutput) : null,
      testSuite.criteria,
    );

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    // Calculate overall score and pass/fail
    const { overallScore, passed } = this.calculateOverallScore(
      evaluationResults,
      testSuite.criteria,
    );

    return {
      datasetItemId: item.id,
      input: item.input,
      actualOutput,
      expectedOutput: item.expectedOutput,
      results: evaluationResults,
      overallScore,
      passed,
      executedAt: new Date().toISOString(),
      latencyMs,
    };
  }

  private substituteVariables(prompt: string, input: any): string {
    if (!input || typeof input !== "object") {
      return prompt;
    }

    let result = prompt;

    // Replace variables in format {{variable}} or {variable}
    for (const [key, value] of Object.entries(input)) {
      const patterns = [
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        new RegExp(`\\{${key}\\}`, "g"),
      ];

      for (const pattern of patterns) {
        result = result.replace(pattern, String(value));
      }
    }

    return result;
  }

  private async executeLLMCall(
    prompt: string,
    modelConfig?: BatchEvaluationRequest["promptVariants"][0]["modelConfig"],
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        type: ChatMessageType.User,
        role: ChatMessageRole.User,
        content: prompt,
      },
    ];

    const modelParams: ModelParams = {
      provider: modelConfig?.provider || "openai",
      adapter: LLMAdapter.OpenAI,
      model: modelConfig?.model || "gpt-4",
      temperature: modelConfig?.temperature || 0.7,
      max_tokens: modelConfig?.maxTokens || 2000,
    };

    // For this evaluation system, we'll use a simple API key approach
    // In production, you'd want to fetch the API key from the project settings
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      throw new Error("No API key available for LLM evaluation");
    }

    const response = await fetchLLMCompletion({
      messages,
      modelParams,
      streaming: false,
      apiKey,
    });

    if (!response.completion || typeof response.completion !== "string") {
      throw new Error("No completion received from LLM");
    }

    return response.completion;
  }

  private calculateOverallScore(
    results: any[],
    criteria: DatasetTestSuite["criteria"],
  ): { overallScore: number; passed: boolean } {
    if (results.length === 0) {
      return { overallScore: 0, passed: false };
    }

    // Calculate weighted average score
    let totalWeight = 0;
    let weightedScore = 0;
    let allRequiredPassed = true;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const criterion = criteria[i];

      if (criterion.required && !result.passed) {
        allRequiredPassed = false;
      }

      const weight = criterion.weight || 1;
      totalWeight += weight;
      weightedScore += result.score * weight;
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const passed = allRequiredPassed && overallScore > 0.5; // 50% threshold

    return { overallScore, passed };
  }

  private calculateSummary(evaluations: DatasetItemEvaluation[]) {
    const totalItems = evaluations.length;
    const passedItems = evaluations.filter((e) => e.passed).length;
    const failedItems = totalItems - passedItems;

    const averageScore =
      totalItems > 0
        ? evaluations.reduce((sum, e) => sum + e.overallScore, 0) / totalItems
        : 0;

    const latencies = evaluations
      .map((e) => e.latencyMs)
      .filter((latency): latency is number => latency !== undefined);

    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : undefined;

    const passRate = totalItems > 0 ? passedItems / totalItems : 0;

    return {
      totalItems,
      passedItems,
      failedItems,
      averageScore,
      averageLatency,
      passRate,
    };
  }
}

export const datasetBatchEvaluator = new DatasetBatchEvaluator();
