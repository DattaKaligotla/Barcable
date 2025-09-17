import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import {
  promptVariantGenerator,
  GenerateVariantsRequest,
} from "@/src/features/prompts/server/promptVariantGenerator";
import { z } from "zod/v4";

const GenerateVariantsResponse = z.object({
  variants: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      content: z.string(),
      generationMethod: z.enum(["rule-based", "llm-assisted"]),
      rule: z.string().optional(),
      metadata: z.object({
        basePromptHash: z.string(),
        generatedAt: z.string(),
        method: z.string(),
      }),
    }),
  ),
  basePromptHash: z.string(),
  generatedAt: z.string(),
});

export default withMiddlewares({
  POST: createAuthedProjectAPIRoute({
    name: "Generate Prompt Variants",
    bodySchema: GenerateVariantsRequest,
    responseSchema: GenerateVariantsResponse,
    rateLimitResource: "prompts",
    fn: async ({ body, auth: _auth }) => {
      try {
        const variants = await promptVariantGenerator.generateVariants(body);

        return {
          variants,
          basePromptHash: variants[0]?.metadata.basePromptHash || "",
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error generating prompt variants:", error);
        throw new Error("Failed to generate prompt variants");
      }
    },
  }),
});
