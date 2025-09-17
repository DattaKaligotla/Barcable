import { z } from "zod/v4";

// Rule-based prompt transformation types
export const PromptVariantRule = z.enum([
  "tone_formal",
  "tone_casual",
  "structure_step_by_step",
  "include_examples",
  "length_shorter",
  "length_longer",
]);

export type PromptVariantRule = z.infer<typeof PromptVariantRule>;

export const GenerateVariantsRequest = z.object({
  basePrompt: z.string(),
  rules: z.array(PromptVariantRule).optional(),
  llmAssisted: z.boolean().default(false),
  llmConfig: z
    .object({
      modelProvider: z.string().optional(),
      modelName: z.string().optional(),
      temperature: z.number().optional(),
    })
    .optional(),
  maxVariants: z.number().min(1).max(10).default(5),
});

export type GenerateVariantsRequest = z.infer<typeof GenerateVariantsRequest>;

export interface PromptVariant {
  id: string;
  name: string;
  content: string;
  generationMethod: "rule-based" | "llm-assisted";
  rule?: PromptVariantRule;
  metadata: {
    basePromptHash: string;
    generatedAt: string;
    method: string;
  };
}

// Rule-based transformations
const RULE_TRANSFORMATIONS: Record<
  PromptVariantRule,
  (prompt: string) => string
> = {
  tone_formal: (prompt: string) =>
    `${prompt}\n\nUse formal, professional language in your response.`,

  tone_casual: (prompt: string) =>
    `${prompt}\n\nUse casual, conversational language in your response.`,

  structure_step_by_step: (prompt: string) =>
    `${prompt}\n\nBreak down your response into clear, step-by-step instructions.`,

  include_examples: (prompt: string) =>
    `${prompt}\n\nPlease include relevant examples to illustrate your points.`,

  length_shorter: (prompt: string) =>
    `${prompt}\n\nProvide a concise response. Keep it brief and to the point.`,

  length_longer: (prompt: string) =>
    `${prompt}\n\nProvide a detailed, comprehensive response with thorough explanations.`,
};

export class PromptVariantGenerator {
  private generateRuleBasedVariants(
    basePrompt: string,
    rules: PromptVariantRule[],
  ): PromptVariant[] {
    return rules.map((rule, index) => ({
      id: `rule_${rule}_${Date.now()}_${index}`,
      name: `${rule.replace("_", " ")} variant`,
      content: RULE_TRANSFORMATIONS[rule](basePrompt),
      generationMethod: "rule-based" as const,
      rule,
      metadata: {
        basePromptHash: this.hashString(basePrompt),
        generatedAt: new Date().toISOString(),
        method: `rule-based:${rule}`,
      },
    }));
  }

  private async generateLLMAssistedVariants(
    basePrompt: string,
    count: number = 3,
    _llmConfig?: GenerateVariantsRequest["llmConfig"],
  ): Promise<PromptVariant[]> {
    // Mock implementation for Docker build compatibility
    // In production, this would integrate with the actual LLM service
    const mockVariants = [
      "Make this more specific and detailed",
      "Simplify this prompt for clarity",
      "Add examples to illustrate the point",
      "Structure this as a step-by-step process",
      "Make this more conversational in tone",
    ];

    return mockVariants.slice(0, count).map((content, index) => ({
      id: `llm_mock_${Date.now()}_${index}`,
      name: `LLM variant ${index + 1}`,
      content: `${content}: ${basePrompt}`,
      generationMethod: "llm-assisted" as const,
      metadata: {
        basePromptHash: this.hashString(basePrompt),
        generatedAt: new Date().toISOString(),
        method: "llm-assisted:mock:gpt-4",
      },
    }));
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async generateVariants(
    request: GenerateVariantsRequest,
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = [];

    // Generate rule-based variants
    if (request.rules && request.rules.length > 0) {
      const ruleVariants = this.generateRuleBasedVariants(
        request.basePrompt,
        request.rules,
      );
      variants.push(...ruleVariants);
    }

    // Generate LLM-assisted variants
    if (request.llmAssisted) {
      const llmVariants = await this.generateLLMAssistedVariants(
        request.basePrompt,
        Math.min(3, request.maxVariants - variants.length),
        request.llmConfig,
      );
      variants.push(...llmVariants);
    }

    // Limit to maxVariants
    return variants.slice(0, request.maxVariants);
  }
}

export const promptVariantGenerator = new PromptVariantGenerator();
