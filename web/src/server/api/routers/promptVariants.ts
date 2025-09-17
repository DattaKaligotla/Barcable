import { z } from "zod";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { TRPCError } from "@trpc/server";
import { logger } from "@langfuse/shared/src/server";
import {
  promptVariantService,
  GenerateVariantsInputSchema,
  PromptVariantRuleSchema,
} from "@/src/features/prompts/server/promptVariantService";

export const promptVariantsRouter = createTRPCRouter({
  /**
   * Generate prompt variants using rule-based transformations
   */
  generateVariants: protectedProjectProcedure
    .input(GenerateVariantsInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "prompts:CUD",
        });

        const variants = await promptVariantService.generateVariants(input);

        return {
          success: true,
          variants,
          message: `Generated ${variants.length} prompt variants`,
        };
      } catch (error) {
        logger.error("Failed to generate prompt variants:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Variant generation failed",
        });
      }
    }),

  /**
   * Get available variant generation rules
   */
  getAvailableRules: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "prompts:read",
      });

      const rules = PromptVariantRuleSchema.options.map((rule) => ({
        value: rule,
        label: rule.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        description: getRuleDescription(rule),
      }));

      return { rules };
    }),

  /**
   * Preview what a rule would do to a prompt (without saving)
   */
  previewRule: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        sourcePrompt: z.string(),
        rule: PromptVariantRuleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "prompts:read",
      });

      try {
        const variants = await promptVariantService.generateVariants({
          sourcePrompt: input.sourcePrompt,
          rules: [input.rule],
          count: 1,
          projectId: input.projectId,
        });

        return {
          success: true,
          preview: variants[0] || null,
        };
      } catch (error) {
        logger.error("Failed to preview rule:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Rule preview failed",
        });
      }
    }),

  /**
   * Generate variants for an existing prompt by ID
   */
  generateForPrompt: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        promptId: z.string(),
        rules: z.array(PromptVariantRuleSchema).min(1),
        count: z.number().min(1).max(10).default(3),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        throwIfNoProjectAccess({
          session: ctx.session,
          projectId: input.projectId,
          scope: "prompts:CUD",
        });

        // Get the prompt content
        const prompt = await ctx.prisma.prompt.findUnique({
          where: { id: input.promptId },
          select: { prompt: true, projectId: true },
        });

        if (!prompt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Prompt not found",
          });
        }

        if (prompt.projectId !== input.projectId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Prompt not in specified project",
          });
        }

        // Extract text content from prompt JSON
        const promptText =
          typeof prompt.prompt === "string"
            ? prompt.prompt
            : JSON.stringify(prompt.prompt);

        const variants = await promptVariantService.generateVariants({
          sourcePrompt: promptText,
          rules: input.rules,
          count: input.count,
          projectId: input.projectId,
        });

        return {
          success: true,
          variants,
          sourcePromptId: input.promptId,
        };
      } catch (error) {
        logger.error("Failed to generate variants for prompt:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Variant generation failed",
        });
      }
    }),
});

// Helper function to get rule descriptions
function getRuleDescription(rule: string): string {
  const descriptions: Record<string, string> = {
    tone_formal: "Make the prompt more formal and professional",
    tone_casual: "Make the prompt more casual and conversational",
    structure_step_by_step: "Add step-by-step structure to the response",
    include_examples: "Request examples in the response",
    length_shorter: "Make the prompt more concise",
    length_longer: "Add more detail and context to the prompt",
  };

  return descriptions[rule] || "Transform the prompt using this rule";
}
