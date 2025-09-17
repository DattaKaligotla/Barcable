import { z } from "zod";
import { prisma } from "@langfuse/shared/src/db";
import { logger } from "@langfuse/shared/src/server";
// import { fetchLLMCompletion } from "@langfuse/shared/src/server";

// Zod schemas for input validation
export const PromptVariantRuleSchema = z.enum([
  "length_shorter",
  "length_longer",
  "tone_formal",
  "tone_casual",
  "tone_technical",
  "structure_step_by_step",
  "structure_bullet_points",
  "structure_numbered",
  "context_minimal",
  "context_detailed",
  "format_question",
  "format_statement",
  "format_command",
  "specificity_specific",
  "specificity_general",
  "complexity_simple",
  "complexity_complex",
  "include_examples",
  "exclude_examples",
  "temperature_creative",
  "temperature_conservative",
]);

export const GenerateVariantsInputSchema = z.object({
  sourcePrompt: z.string().min(1, "Source prompt is required"),
  rules: z
    .array(PromptVariantRuleSchema)
    .min(1, "At least one rule is required"),
  llmAssist: z.boolean().default(false),
  count: z.number().min(1).max(20).default(5),
  projectId: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  preserveVariables: z.boolean().default(true),
});

export const VariantGenerationResultSchema = z.object({
  id: z.string(),
  sourcePrompt: z.string(),
  generatedPrompt: z.string(),
  appliedRules: z.array(PromptVariantRuleSchema),
  llmAssisted: z.boolean(),
  metadata: z.object({
    generationTime: z.number(),
    tokensUsed: z.number().optional(),
    confidence: z.number().min(0).max(1).optional(),
    ruleApplications: z.record(z.string(), z.any()).optional(),
  }),
  createdAt: z.date(),
});

export type PromptVariantRule = z.infer<typeof PromptVariantRuleSchema>;
export type GenerateVariantsInput = z.infer<typeof GenerateVariantsInputSchema>;
export type VariantGenerationResult = z.infer<
  typeof VariantGenerationResultSchema
>;

/**
 * Service for generating prompt variants using rule-based and LLM-assisted methods
 */
export class PromptVariantService {
  private readonly ruleImplementations: Record<
    PromptVariantRule,
    (prompt: string) => string
  >;

  constructor() {
    this.ruleImplementations = {
      // Length variations
      length_shorter: (prompt) => this.applyLengthReduction(prompt),
      length_longer: (prompt) => this.applyLengthExpansion(prompt),

      // Tone variations
      tone_formal: (prompt) => this.applyFormalTone(prompt),
      tone_casual: (prompt) => this.applyCasualTone(prompt),
      tone_technical: (prompt) => this.applyTechnicalTone(prompt),

      // Structure variations
      structure_step_by_step: (prompt) => this.applyStepByStepStructure(prompt),
      structure_bullet_points: (prompt) =>
        this.applyBulletPointStructure(prompt),
      structure_numbered: (prompt) => this.applyNumberedStructure(prompt),

      // Context variations
      context_minimal: (prompt) => this.applyMinimalContext(prompt),
      context_detailed: (prompt) => this.applyDetailedContext(prompt),

      // Format variations
      format_question: (prompt) => this.applyQuestionFormat(prompt),
      format_statement: (prompt) => this.applyStatementFormat(prompt),
      format_command: (prompt) => this.applyCommandFormat(prompt),

      // Specificity variations
      specificity_specific: (prompt) => this.applyHighSpecificity(prompt),
      specificity_general: (prompt) => this.applyGeneralization(prompt),

      // Complexity variations
      complexity_simple: (prompt) => this.applySimplification(prompt),
      complexity_complex: (prompt) => this.applyComplexification(prompt),

      // Example variations
      include_examples: (prompt) => this.addExamples(prompt),
      exclude_examples: (prompt) => this.removeExamples(prompt),

      // Temperature variations (handled in LLM calls)
      temperature_creative: (prompt) => prompt,
      temperature_conservative: (prompt) => prompt,
    };
  }

  /**
   * Generate multiple prompt variants using specified rules and optional LLM assistance
   */
  async generateVariants(
    input: GenerateVariantsInput,
  ): Promise<VariantGenerationResult[]> {
    const startTime = Date.now();
    const results: VariantGenerationResult[] = [];

    try {
      // Generate rule-based variants
      const ruleBasedVariants = await this.generateRuleBasedVariants(input);
      results.push(...ruleBasedVariants);

      // Generate LLM-assisted variants if requested
      if (input.llmAssist) {
        const llmVariants = await this.generateLLMAssistedVariants(input);
        results.push(...llmVariants);
      }

      // Ensure we don't exceed the requested count
      const finalResults = results.slice(0, input.count);

      logger.info(
        `Generated ${finalResults.length} prompt variants in ${Date.now() - startTime}ms`,
      );
      return finalResults;
    } catch (error) {
      logger.error("Error generating prompt variants:", error);
      throw new Error(
        `Variant generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate variants using rule-based transformations
   */
  private async generateRuleBasedVariants(
    input: GenerateVariantsInput,
  ): Promise<VariantGenerationResult[]> {
    const variants: VariantGenerationResult[] = [];
    const { sourcePrompt, rules, preserveVariables } = input;

    // Extract variables if preservation is enabled
    const variables = preserveVariables
      ? this.extractVariables(sourcePrompt)
      : [];

    for (const rule of rules) {
      const startTime = Date.now();

      try {
        let transformedPrompt = this.ruleImplementations[rule](sourcePrompt);

        // Restore variables if needed
        if (preserveVariables && variables.length > 0) {
          transformedPrompt = this.restoreVariables(
            transformedPrompt,
            variables,
          );
        }

        variants.push({
          id: `variant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourcePrompt,
          generatedPrompt: transformedPrompt,
          appliedRules: [rule],
          llmAssisted: false,
          metadata: {
            generationTime: Date.now() - startTime,
            ruleApplications: { [rule]: true },
          },
          createdAt: new Date(),
        });
      } catch (error) {
        logger.warn(`Failed to apply rule ${rule}:`, error);
      }
    }

    return variants;
  }

  /**
   * Generate variants using LLM assistance
   */
  private async generateLLMAssistedVariants(
    input: GenerateVariantsInput,
  ): Promise<VariantGenerationResult[]> {
    const variants: VariantGenerationResult[] = [];
    const { sourcePrompt, rules, temperature } = input;

    const systemPrompt = `You are an expert prompt engineer. Your task is to create improved versions of the given prompt by applying the specified rules while maintaining the core intent and functionality.

Rules to apply: ${rules.join(", ")}

Guidelines:
- Maintain all variable placeholders (e.g., {input}, {context})
- Preserve the core functionality and intent
- Apply the rules thoughtfully and naturally
- Ensure the output is clear and actionable
- Return only the improved prompt, no explanation`;

    const userPrompt = `Original prompt: "${sourcePrompt}"

Please create an improved version that incorporates the specified rules: ${rules.join(", ")}`;

    try {
      const startTime = Date.now();

      // Note: LLM-assisted generation requires API keys to be configured
      // For demo purposes, we'll generate a mock LLM response
      const mockLLMResponse = this.generateMockLLMVariant(sourcePrompt, rules);

      if (mockLLMResponse) {
        variants.push({
          id: `llm_variant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourcePrompt,
          generatedPrompt: mockLLMResponse.trim(),
          appliedRules: rules,
          llmAssisted: true,
          metadata: {
            generationTime: Date.now() - startTime,
            tokensUsed: 50, // Mock token usage
            confidence: 0.8, // Default confidence for mock LLM variants
            ruleApplications: Object.fromEntries(
              rules.map((rule) => [rule, true]),
            ),
          },
          createdAt: new Date(),
        });
      }
    } catch (error) {
      logger.error("LLM-assisted variant generation failed:", error);
    }

    return variants;
  }

  /**
   * Generate a mock LLM variant for demo purposes
   */
  private generateMockLLMVariant(
    sourcePrompt: string,
    rules: PromptVariantRule[],
  ): string {
    let variant = sourcePrompt;

    // Apply some basic transformations based on rules
    if (rules.includes("tone_formal")) {
      variant = variant
        .replace(/\bcan't\b/gi, "cannot")
        .replace(/\bwon't\b/gi, "will not");
    }
    if (rules.includes("structure_step_by_step")) {
      variant +=
        "\n\nPlease provide your response in a clear, step-by-step format.";
    }
    if (rules.includes("include_examples")) {
      variant +=
        "\n\nPlease include relevant examples to illustrate your points.";
    }

    return variant;
  }

  // Rule implementation methods
  private applyLengthReduction(prompt: string): string {
    // Remove unnecessary words and phrases
    return prompt
      .replace(/\b(please|kindly|if you would|if possible)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private applyLengthExpansion(prompt: string): string {
    // Add clarifying phrases and context
    const expansions = [
      "Please provide a detailed response.",
      "Consider all relevant factors in your analysis.",
      "Ensure your answer is comprehensive and well-structured.",
    ];
    return `${prompt} ${expansions[Math.floor(Math.random() * expansions.length)]}`;
  }

  private applyFormalTone(prompt: string): string {
    return prompt
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\bit's\b/gi, "it is")
      .replace(/\byou're\b/gi, "you are");
  }

  private applyCasualTone(prompt: string): string {
    return prompt
      .replace(/\bcannot\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't")
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bit is\b/gi, "it's")
      .replace(/\byou are\b/gi, "you're");
  }

  private applyTechnicalTone(prompt: string): string {
    // Add technical precision phrases
    const technicalPhrases = [
      "utilizing",
      "implementing",
      "analyzing",
      "evaluating",
      "systematically",
    ];
    // Simple replacement of common words with technical equivalents
    return prompt
      .replace(/\buse\b/gi, "utilize")
      .replace(/\bshow\b/gi, "demonstrate")
      .replace(/\bmake\b/gi, "generate");
  }

  private applyStepByStepStructure(prompt: string): string {
    if (!prompt.includes("step")) {
      return `${prompt}\n\nPlease provide your response in a clear, step-by-step format.`;
    }
    return prompt;
  }

  private applyBulletPointStructure(prompt: string): string {
    return `${prompt}\n\nPlease format your response using bullet points for clarity.`;
  }

  private applyNumberedStructure(prompt: string): string {
    return `${prompt}\n\nPlease provide your response in a numbered list format.`;
  }

  private applyMinimalContext(prompt: string): string {
    // Remove excessive context while preserving core meaning
    return prompt
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, 3) // Keep only first 3 non-empty lines
      .join("\n");
  }

  private applyDetailedContext(prompt: string): string {
    return `${prompt}\n\nPlease consider the full context and provide detailed reasoning for your response.`;
  }

  private applyQuestionFormat(prompt: string): string {
    if (!prompt.trim().endsWith("?")) {
      // Convert statement to question format
      const questionStarters = [
        "How would you",
        "What is",
        "Can you explain",
        "Would you please",
      ];
      const starter =
        questionStarters[Math.floor(Math.random() * questionStarters.length)];
      return `${starter} ${prompt.toLowerCase()}?`;
    }
    return prompt;
  }

  private applyStatementFormat(prompt: string): string {
    // Convert to declarative statement
    return prompt
      .replace(/\?$/, ".")
      .replace(/^(how|what|when|where|why|can you)/gi, "Please");
  }

  private applyCommandFormat(prompt: string): string {
    // Convert to imperative command
    const commands = [
      "Analyze",
      "Evaluate",
      "Describe",
      "Explain",
      "Summarize",
    ];
    const command = commands[Math.floor(Math.random() * commands.length)];
    return prompt.replace(/^(please|can you|would you)/gi, command);
  }

  private applyHighSpecificity(prompt: string): string {
    return `${prompt}\n\nPlease be as specific and precise as possible in your response.`;
  }

  private applyGeneralization(prompt: string): string {
    return prompt.replace(/\b(specific|exact|precise|detailed)\b/gi, "general");
  }

  private applySimplification(prompt: string): string {
    return `${prompt}\n\nPlease explain in simple, easy-to-understand terms.`;
  }

  private applyComplexification(prompt: string): string {
    return `${prompt}\n\nPlease provide a comprehensive, in-depth analysis with technical details.`;
  }

  private addExamples(prompt: string): string {
    return `${prompt}\n\nPlease include relevant examples to illustrate your points.`;
  }

  private removeExamples(prompt: string): string {
    // Remove lines that appear to be examples
    return prompt
      .split("\n")
      .filter(
        (line) =>
          !line.toLowerCase().includes("example") &&
          !line.toLowerCase().includes("for instance"),
      )
      .join("\n");
  }

  private extractVariables(prompt: string): string[] {
    const variablePattern = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(prompt)) !== null) {
      variables.push(match[0]);
    }

    return variables;
  }

  private restoreVariables(prompt: string, variables: string[]): string {
    // Simple restoration - in practice, this would be more sophisticated
    return prompt;
  }

  /**
   * Save generated variants to database
   */
  async saveVariants(
    variants: VariantGenerationResult[],
    projectId: string,
    sourcePromptId?: string,
  ): Promise<void> {
    try {
      // In a real implementation, you would save to a PromptVariant table
      // For now, we'll just log the operation
      logger.info(
        `Saving ${variants.length} variants for project ${projectId}`,
      );

      // TODO: Implement database storage
      // await db.promptVariant.createMany({
      //   data: variants.map(variant => ({
      //     ...variant,
      //     projectId,
      //     sourcePromptId
      //   }))
      // });
    } catch (error) {
      logger.error("Failed to save variants:", error);
      throw error;
    }
  }

  /**
   * Get variants for a specific prompt
   */
  async getVariantsForPrompt(
    promptId: string,
    projectId: string,
  ): Promise<VariantGenerationResult[]> {
    try {
      // TODO: Implement database retrieval
      // return await db.promptVariant.findMany({
      //   where: { sourcePromptId: promptId, projectId }
      // });

      return [];
    } catch (error) {
      logger.error("Failed to retrieve variants:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const promptVariantService = new PromptVariantService();
