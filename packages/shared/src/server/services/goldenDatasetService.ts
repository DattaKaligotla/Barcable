import { z } from "zod";
import { prisma } from "@langfuse/shared/src/db";
import { logger } from "@langfuse/shared/src/server";
// import { fetchLLMCompletion } from "@langfuse/shared/src/server";

// Zod schemas for golden dataset testing
export const EvaluationCriteriaSchema = z.enum([
  "response_relevance",
  "factual_accuracy",
  "completeness",
  "coherence",
  "response_time",
  "token_efficiency",
  "cost_optimization",
  "format_compliance",
  "structure_adherence",
  "length_requirements",
  "technical_accuracy",
  "domain_expertise",
  "contextual_appropriateness",
]);

export const TestBatchInputSchema = z.object({
  prompts: z.array(z.string()).min(1, "At least one prompt is required"),
  datasets: z.array(z.string()).min(1, "At least one dataset is required"),
  evaluationCriteria: z
    .array(EvaluationCriteriaSchema)
    .min(1, "At least one criteria is required"),
  projectId: z.string(),
  batchName: z.string().optional(),
  maxConcurrency: z.number().min(1).max(10).default(3),
  timeoutMs: z.number().default(30000),
});

export const TestResultSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  promptId: z.string(),
  datasetId: z.string(),
  testCaseId: z.string(),
  criteria: EvaluationCriteriaSchema,
  input: z.string(),
  expectedOutput: z.string().optional(),
  actualOutput: z.string(),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  reasoning: z.string().optional(),
  metrics: z.object({
    responseTime: z.number().optional(),
    tokenCount: z.number().optional(),
    cost: z.number().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  evaluatedAt: z.date(),
});

export const BatchProgressSchema = z.object({
  batchId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  totalTests: z.number(),
  completedTests: z.number(),
  failedTests: z.number(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  estimatedCompletion: z.date().optional(),
  results: z.array(TestResultSchema),
});

export type EvaluationCriteria = z.infer<typeof EvaluationCriteriaSchema>;
export type TestBatchInput = z.infer<typeof TestBatchInputSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type BatchProgress = z.infer<typeof BatchProgressSchema>;

/**
 * Service for comprehensive golden dataset testing and evaluation
 */
export class GoldenDatasetService {
  private readonly activeBatches = new Map<string, BatchProgress>();
  private readonly criteriaEvaluators: Record<
    EvaluationCriteria,
    (_input: any) => Promise<TestResult>
  >;

  constructor() {
    this.criteriaEvaluators = {
      response_relevance: this.evaluateResponseRelevance.bind(this),
      factual_accuracy: this.evaluateFactualAccuracy.bind(this),
      completeness: this.evaluateCompleteness.bind(this),
      coherence: this.evaluateCoherence.bind(this),
      response_time: this.evaluateResponseTime.bind(this),
      token_efficiency: this.evaluateTokenEfficiency.bind(this),
      cost_optimization: this.evaluateCostOptimization.bind(this),
      format_compliance: this.evaluateFormatCompliance.bind(this),
      structure_adherence: this.evaluateStructureAdherence.bind(this),
      length_requirements: this.evaluateLengthRequirements.bind(this),
      technical_accuracy: this.evaluateTechnicalAccuracy.bind(this),
      domain_expertise: this.evaluateDomainExpertise.bind(this),
      contextual_appropriateness:
        this.evaluateContextualAppropriateness.bind(this),
    };
  }

  /**
   * Create a new test batch for comprehensive evaluation
   */
  async createTestBatch(input: TestBatchInput): Promise<string> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Calculate total number of tests
      const totalTests =
        input.prompts.length *
        input.datasets.length *
        input.evaluationCriteria.length;

      const batch: BatchProgress = {
        batchId,
        status: "pending",
        totalTests,
        completedTests: 0,
        failedTests: 0,
        startedAt: new Date(),
        results: [],
      };

      this.activeBatches.set(batchId, batch);

      // Start batch processing asynchronously
      this.processBatch(batchId, input).catch((error) => {
        logger.error(`Batch ${batchId} processing failed:`, error);
        const batch = this.activeBatches.get(batchId);
        if (batch) {
          batch.status = "failed";
          batch.completedAt = new Date();
        }
      });

      logger.info(`Created test batch ${batchId} with ${totalTests} tests`);
      return batchId;
    } catch (error) {
      logger.error("Failed to create test batch:", error);
      throw new Error(
        `Test batch creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get progress for a specific batch
   */
  getBatchProgress(batchId: string): BatchProgress | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Get detailed results for a completed batch
   */
  async getBatchResults(
    batchId: string,
    includeMetrics = false,
  ): Promise<BatchProgress | null> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return null;

    if (includeMetrics && batch.status === "completed") {
      // Add aggregated metrics
      batch.results = await this.enrichResultsWithMetrics(batch.results);
    }

    return batch;
  }

  /**
   * Process a test batch asynchronously
   */
  private async processBatch(
    batchId: string,
    input: TestBatchInput,
  ): Promise<void> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return;

    batch.status = "running";

    try {
      // Get test cases from datasets
      const testCases = await this.loadTestCases(
        input.datasets,
        input.projectId,
      );

      // Create test combinations
      const testTasks: Array<{
        promptId: string;
        datasetId: string;
        testCase: any;
        criteria: EvaluationCriteria;
      }> = [];

      for (const promptId of input.prompts) {
        for (const datasetId of input.datasets) {
          const datasetCases = testCases.filter(
            (tc) => tc.datasetId === datasetId,
          );
          for (const testCase of datasetCases) {
            for (const criteria of input.evaluationCriteria) {
              testTasks.push({
                promptId,
                datasetId,
                testCase,
                criteria,
              });
            }
          }
        }
      }

      // Process tests with concurrency control
      // Create semaphore for concurrency control
      // Note: semaphore not currently used in this implementation
      const processTask = async (task: (typeof testTasks)[0]) => {
        try {
          const result = await this.executeTest({
            batchId,
            promptId: task.promptId,
            datasetId: task.datasetId,
            testCase: task.testCase,
            criteria: task.criteria,
            timeoutMs: input.timeoutMs,
          });

          batch.results.push(result);
          batch.completedTests++;
        } catch (error) {
          logger.error(`Test execution failed:`, error);
          batch.failedTests++;
        }
      };

      // Execute tests in batches
      for (let i = 0; i < testTasks.length; i += input.maxConcurrency) {
        const chunk = testTasks.slice(i, i + input.maxConcurrency);
        await Promise.allSettled(chunk.map(processTask));
      }

      batch.status = "completed";
      batch.completedAt = new Date();

      logger.info(
        `Batch ${batchId} completed: ${batch.completedTests}/${batch.totalTests} tests successful`,
      );
    } catch (error) {
      logger.error(`Batch ${batchId} processing failed:`, error);
      batch.status = "failed";
      batch.completedAt = new Date();
    }
  }

  /**
   * Execute a single test case
   */
  private async executeTest(params: {
    batchId: string;
    promptId: string;
    datasetId: string;
    testCase: any;
    criteria: EvaluationCriteria;
    timeoutMs: number;
  }): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Get the prompt
      const prompt = await this.getPrompt(params.promptId);
      if (!prompt) {
        throw new Error(`Prompt ${params.promptId} not found`);
      }

      // Prepare the input by substituting variables
      const processedPrompt = this.substituteVariables(
        prompt.prompt,
        params.testCase.input,
      );

      // Execute the prompt using mock response for demo
      const response = {
        completion: `Mock response for: ${processedPrompt.slice(0, 100)}...`,
        usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20 },
      };

      const responseTime = Date.now() - startTime;

      // Evaluate using the specific criteria
      const evaluationInput = {
        batchId: params.batchId,
        promptId: params.promptId,
        datasetId: params.datasetId,
        testCaseId: params.testCase.id,
        criteria: params.criteria,
        input: params.testCase.input,
        expectedOutput: params.testCase.expectedOutput,
        actualOutput: response.completion,
        responseTime,
        tokenCount: response.usage?.total_tokens,
        cost: response.usage ? this.calculateCost(response.usage) : undefined,
      };

      return await this.criteriaEvaluators[params.criteria](evaluationInput);
    } catch (error) {
      logger.error(`Test execution failed for ${params.criteria}:`, error);

      return {
        id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        batchId: params.batchId,
        promptId: params.promptId,
        datasetId: params.datasetId,
        testCaseId: params.testCase.id,
        criteria: params.criteria,
        input: params.testCase.input,
        expectedOutput: params.testCase.expectedOutput,
        actualOutput: "",
        score: 0,
        passed: false,
        reasoning: `Test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metrics: {
          responseTime: Date.now() - startTime,
        },
        evaluatedAt: new Date(),
      };
    }
  }

  // Criteria evaluation methods
  private async evaluateResponseRelevance(input: any): Promise<TestResult> {
    // Mock relevance evaluation for demo purposes
    try {
      // Mock evaluation for demo purposes
      const score = Math.random() * 0.4 + 0.6; // Random score between 0.6-1.0

      return {
        id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...input,
        score: Math.max(0, Math.min(1, score)),
        passed: score >= 0.7,
        reasoning: `Mock relevance evaluation: ${score.toFixed(2)}`,
        evaluatedAt: new Date(),
      };
    } catch (error) {
      return this.createFailedResult(
        input,
        "Response relevance evaluation failed",
      );
    }
  }

  private async evaluateFactualAccuracy(input: any): Promise<TestResult> {
    // Simple factual accuracy check - in practice, this would be more sophisticated
    const hasExpected = input.expectedOutput && input.expectedOutput.length > 0;
    let score = 0.5; // Default score when no expected output

    if (hasExpected) {
      // Compare with expected output using fuzzy matching
      const similarity = this.calculateTextSimilarity(
        input.actualOutput,
        input.expectedOutput,
      );
      score = similarity;
    }

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: score >= 0.7,
      reasoning: hasExpected
        ? `Similarity to expected: ${score}`
        : "No expected output for comparison",
      evaluatedAt: new Date(),
    };
  }

  private async evaluateCompleteness(input: any): Promise<TestResult> {
    // Evaluate if response fully addresses all aspects of the input
    const minLength = 50; // Minimum expected response length
    const actualLength = input.actualOutput.length;

    let score = Math.min(1, actualLength / (minLength * 2)); // Score based on length

    // Check for key indicators of completeness
    const completenessIndicators = [
      "because",
      "therefore",
      "for example",
      "in conclusion",
    ];
    const indicatorCount = completenessIndicators.filter((indicator) =>
      input.actualOutput.toLowerCase().includes(indicator),
    ).length;

    score = Math.min(1, score + indicatorCount * 0.1);

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: score >= 0.6,
      reasoning: `Length: ${actualLength}, Indicators: ${indicatorCount}`,
      evaluatedAt: new Date(),
    };
  }

  private async evaluateCoherence(input: any): Promise<TestResult> {
    // Simple coherence check based on sentence structure and flow
    const sentences = input.actualOutput
      .split(/[.!?]+/)
      .filter((s: string) => s.trim().length > 0);

    if (sentences.length === 0) {
      return this.createFailedResult(input, "No coherent sentences found");
    }

    // Score based on sentence count and average length
    const avgSentenceLength =
      sentences.reduce((sum: number, s: string) => sum + s.length, 0) /
      sentences.length;
    const score = Math.min(1, (sentences.length * avgSentenceLength) / 500);

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: score >= 0.5,
      reasoning: `${sentences.length} sentences, avg length: ${avgSentenceLength.toFixed(1)}`,
      evaluatedAt: new Date(),
    };
  }

  private async evaluateResponseTime(input: any): Promise<TestResult> {
    const responseTime = input.responseTime || 0;
    const maxAcceptableTime = 10000; // 10 seconds

    const score = Math.max(
      0,
      Math.min(1, (maxAcceptableTime - responseTime) / maxAcceptableTime),
    );

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: responseTime <= maxAcceptableTime,
      reasoning: `Response time: ${responseTime}ms`,
      metrics: { responseTime },
      evaluatedAt: new Date(),
    };
  }

  private async evaluateTokenEfficiency(input: any): Promise<TestResult> {
    const tokenCount = input.tokenCount || 0;
    const outputLength = input.actualOutput.length;

    if (outputLength === 0) {
      return this.createFailedResult(input, "No output to evaluate");
    }

    // Calculate tokens per character ratio
    const efficiency = outputLength / (tokenCount || 1);
    const score = Math.min(1, efficiency / 3); // Normalize to 0-1 scale

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: efficiency >= 2,
      reasoning: `${efficiency.toFixed(2)} chars per token`,
      metrics: { tokenCount },
      evaluatedAt: new Date(),
    };
  }

  private async evaluateCostOptimization(input: any): Promise<TestResult> {
    const cost = input.cost || 0;
    const maxAcceptableCost = 0.1; // $0.10 max per test

    const score = Math.max(
      0,
      Math.min(1, (maxAcceptableCost - cost) / maxAcceptableCost),
    );

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: cost <= maxAcceptableCost,
      reasoning: `Cost: $${cost.toFixed(4)}`,
      metrics: { cost },
      evaluatedAt: new Date(),
    };
  }

  private async evaluateFormatCompliance(input: any): Promise<TestResult> {
    // Check for basic format compliance (e.g., proper sentences, punctuation)
    const output = input.actualOutput;
    let score = 0.5; // Base score

    // Check for proper sentence endings
    if (/[.!?]$/.test(output.trim())) score += 0.2;

    // Check for proper capitalization
    if (/^[A-Z]/.test(output.trim())) score += 0.2;

    // Check for reasonable length
    if (output.length >= 20) score += 0.1;

    score = Math.min(1, score);

    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: score >= 0.7,
      reasoning: `Format compliance score: ${score}`,
      evaluatedAt: new Date(),
    };
  }

  // Additional evaluation methods would follow the same pattern...
  private async evaluateStructureAdherence(input: any): Promise<TestResult> {
    return this.createBasicResult(
      input,
      0.7,
      "Structure evaluation not fully implemented",
    );
  }

  private async evaluateLengthRequirements(input: any): Promise<TestResult> {
    return this.createBasicResult(
      input,
      0.8,
      "Length evaluation not fully implemented",
    );
  }

  private async evaluateTechnicalAccuracy(input: any): Promise<TestResult> {
    return this.createBasicResult(
      input,
      0.6,
      "Technical accuracy evaluation not fully implemented",
    );
  }

  private async evaluateDomainExpertise(input: any): Promise<TestResult> {
    return this.createBasicResult(
      input,
      0.7,
      "Domain expertise evaluation not fully implemented",
    );
  }

  private async evaluateContextualAppropriateness(
    input: any,
  ): Promise<TestResult> {
    return this.createBasicResult(
      input,
      0.8,
      "Contextual appropriateness evaluation not fully implemented",
    );
  }

  // Helper methods
  private createFailedResult(input: any, reason: string): TestResult {
    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score: 0,
      passed: false,
      reasoning: reason,
      evaluatedAt: new Date(),
    };
  }

  private createBasicResult(
    input: any,
    score: number,
    reasoning: string,
  ): TestResult {
    return {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      score,
      passed: score >= 0.7,
      reasoning,
      evaluatedAt: new Date(),
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateCost(usage: any): number {
    // Simple cost calculation - adjust based on actual pricing
    const inputCostPer1k = 0.0015; // $0.0015 per 1k input tokens
    const outputCostPer1k = 0.002; // $0.002 per 1k output tokens

    const inputCost = ((usage.prompt_tokens || 0) * inputCostPer1k) / 1000;
    const outputCost =
      ((usage.completion_tokens || 0) * outputCostPer1k) / 1000;

    return inputCost + outputCost;
  }

  private substituteVariables(
    prompt: string,
    variables: Record<string, any>,
  ): string {
    let result = prompt;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }
    return result;
  }

  private async getPrompt(promptId: string): Promise<any> {
    try {
      return await prisma.prompt.findUnique({
        where: { id: promptId },
      });
    } catch (error) {
      logger.error("Failed to get prompt:", error);
      return null;
    }
  }

  private async loadTestCases(
    datasetIds: string[],
    _projectId: string,
  ): Promise<any[]> {
    try {
      // TODO: Implement actual dataset loading
      // For now, return mock test cases
      return datasetIds.flatMap((datasetId) => [
        {
          id: `test_case_1_${datasetId}`,
          datasetId,
          input: { message: "Sample test input" },
          expectedOutput: "Sample expected output",
        },
      ]);
    } catch (error) {
      logger.error("Failed to load test cases:", error);
      return [];
    }
  }

  private async enrichResultsWithMetrics(
    results: TestResult[],
  ): Promise<TestResult[]> {
    // Add aggregated metrics to results
    return results;
  }
}

// Export singleton instance
export const goldenDatasetService = new GoldenDatasetService();
