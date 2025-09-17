import { z } from "zod";
import { logger } from "@langfuse/shared/src/server";

// Simple rule-based prompt variant generation
export const PromptVariantRuleSchema = z.enum([
  "tone_formal",
  "tone_casual",
  "structure_step_by_step",
  "include_examples",
  "length_shorter",
  "length_longer",
]);

export const GenerateVariantsInputSchema = z.object({
  sourcePrompt: z.string().min(1),
  rules: z.array(PromptVariantRuleSchema).min(1),
  count: z.number().min(1).max(10).default(3),
  projectId: z.string(),
});

export type PromptVariantRule = z.infer<typeof PromptVariantRuleSchema>;
export type GenerateVariantsInput = z.infer<typeof GenerateVariantsInputSchema>;

export interface VariantGenerationResult {
  id: string;
  sourcePrompt: string;
  generatedPrompt: string;
  appliedRules: PromptVariantRule[];
  metadata: {
    generationTime: number;
    confidence: number;
  };
  createdAt: Date;
}

/**
 * Simple prompt variant generation service
 */
export class PromptVariantService {
  /**
   * Generate prompt variants using rule-based transformations
   */
  async generateVariants(
    input: GenerateVariantsInput,
  ): Promise<VariantGenerationResult[]> {
    const startTime = Date.now();
    const results: VariantGenerationResult[] = [];

    try {
      for (const rule of input.rules.slice(0, input.count)) {
        const transformedPrompt = this.applyRule(input.sourcePrompt, rule);

        results.push({
          id: `variant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourcePrompt: input.sourcePrompt,
          generatedPrompt: transformedPrompt,
          appliedRules: [rule],
          metadata: {
            generationTime: Date.now() - startTime,
            confidence: 0.8,
          },
          createdAt: new Date(),
        });
      }

      logger.info(`Generated ${results.length} prompt variants`);
      return results;
    } catch (error) {
      logger.error("Error generating prompt variants:", error);
      throw new Error(
        `Variant generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Apply a specific transformation rule to a prompt
   */
  private applyRule(prompt: string, rule: PromptVariantRule): string {
    switch (rule) {
      case "tone_formal":
        return this.makeFormal(prompt);
      case "tone_casual":
        return this.makeCasual(prompt);
      case "structure_step_by_step":
        return this.addStepByStep(prompt);
      case "include_examples":
        return this.addExamples(prompt);
      case "length_shorter":
        return this.makesShorter(prompt);
      case "length_longer":
        return this.makeLonger(prompt);
      default:
        return prompt;
    }
  }

  private makeFormal(prompt: string): string {
    return prompt
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\byou're\b/gi, "you are");
  }

  private makeCasual(prompt: string): string {
    return prompt
      .replace(/\bcannot\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't")
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\byou are\b/gi, "you're");
  }

  private addStepByStep(prompt: string): string {
    return `${prompt}\n\nPlease provide your response in a clear, step-by-step format.`;
  }

  private addExamples(prompt: string): string {
    return `${prompt}\n\nPlease include relevant examples to illustrate your points.`;
  }

  private makesShorter(prompt: string): string {
    return prompt
      .replace(/\b(please|kindly|if you would|if possible)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private makeLonger(prompt: string): string {
    return `${prompt}\n\nPlease provide a detailed and comprehensive response.`;
  }
}

export const promptVariantService = new PromptVariantService();
