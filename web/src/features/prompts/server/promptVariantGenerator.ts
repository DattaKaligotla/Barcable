import { z } from "zod/v4";

// Rule-based prompt transformation types
export const PromptVariantRule = z.enum([
  "strict",
  "bullet_points",
  "numbered_list",
  "concise",
  "detailed",
  "formal",
  "casual",
  "step_by_step",
  "json_format",
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
  strict: (prompt) =>
    `${prompt}\n\nIMPORTANT: Follow these instructions exactly. Do not deviate from the specified format or requirements.`,

  bullet_points: (prompt) =>
    `${prompt}\n\nFormat your response as bullet points:\n• Point 1\n• Point 2\n• Point 3`,

  numbered_list: (prompt) =>
    `${prompt}\n\nFormat your response as a numbered list:\n1. First item\n2. Second item\n3. Third item`,

  concise: (prompt) =>
    `${prompt}\n\nProvide a concise response. Keep it brief and to the point.`,

  detailed: (prompt) =>
    `${prompt}\n\nProvide a detailed, comprehensive response with thorough explanations.`,

  formal: (prompt) =>
    `${prompt}\n\nUse formal, professional language in your response.`,

  casual: (prompt) =>
    `${prompt}\n\nUse casual, conversational language in your response.`,

  step_by_step: (prompt) =>
    `${prompt}\n\nBreak down your response into clear, step-by-step instructions.`,

  json_format: (prompt) =>
    `${prompt}\n\nRespond in valid JSON format only. Do not include any text outside the JSON structure.`,
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
