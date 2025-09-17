import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import {
  PromptStoreService,
  PromptLabelingRequest,
  PromptPublishingWorkflow,
} from "@/src/features/prompts/server/promptStoreService";

export const promptStoreRouter = createTRPCRouter({
  // Publish a prompt to a specific label (production, staging, candidate/*, etc.)
  publishPrompt: protectedProjectProcedure
    .input(PromptPublishingWorkflow)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await PromptStoreService.publishPrompt(
          input,
          ctx.session.projectId,
          ctx.session.user.id,
        );

        return result;
      } catch (error) {
        console.error("Prompt publishing failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Publishing failed",
        });
      }
    }),

  // Add/update labels on a prompt
  updateLabels: protectedProjectProcedure
    .input(PromptLabelingRequest)
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate labels first
        const validation = await PromptStoreService.validateLabels(
          input.labels,
          ctx.session.projectId,
        );

        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid labels: ${validation.errors.join(", ")}`,
          });
        }

        // Check if prompt exists and user has access
        const prompt = await ctx.prisma.prompt.findFirst({
          where: {
            id: input.promptId,
            projectId: ctx.session.projectId,
          },
        });

        if (!prompt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Prompt not found",
          });
        }

        // Handle automatic production publishing if requested
        if (input.publishToProduction && !input.labels.includes("production")) {
          input.labels.push("production");
        }

        // Update the prompt labels
        const updatedPrompt = await ctx.prisma.prompt.update({
          where: { id: input.promptId },
          data: {
            labels: input.labels,
            commitMessage: input.commitMessage,
            updatedAt: new Date(),
          },
        });

        // Handle special production label logic
        if (input.labels.includes("production")) {
          await PromptStoreService["handleProductionPublishing"](
            prompt.name,
            input.promptId,
            ctx.session.projectId,
            ctx.session.user.id,
          );
        }

        // Handle latest label logic
        if (input.labels.includes("latest")) {
          await PromptStoreService["updateLatestLabel"](
            prompt.name,
            input.promptId,
            ctx.session.projectId,
          );
        }

        return {
          success: true,
          prompt: updatedPrompt,
          message: "Labels updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Label update failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Label update failed",
        });
      }
    }),

  // Get prompt by label (e.g., get production version of a prompt)
  getPromptByLabel: protectedProjectProcedure
    .input(
      z.object({
        promptName: z.string(),
        label: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const prompt = await PromptStoreService.getPromptByLabel(
          input.promptName,
          input.label,
          ctx.session.projectId,
        );

        if (!prompt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No prompt found with name '${input.promptName}' and label '${input.label}'`,
          });
        }

        return prompt;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to retrieve prompt",
        });
      }
    }),

  // Browse the prompt store with filtering
  browseStore: protectedProjectProcedure
    .input(
      z.object({
        label: z.string().optional(),
        name: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const result = await PromptStoreService.getPromptsInStore(
          ctx.session.projectId,
          input,
        );

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to browse prompt store",
        });
      }
    }),

  // Get all available labels and their counts
  getLabelsOverview: protectedProjectProcedure.query(async ({ ctx }) => {
    try {
      const result = await PromptStoreService.getPromptsInStore(
        ctx.session.projectId,
        { limit: 0 },
      );

      // Get protected labels
      const protectedLabels = await ctx.prisma.promptProtectedLabels.findMany({
        where: { projectId: ctx.session.projectId },
        select: { label: true },
      });

      return {
        labelCounts: result.groupedByLabel,
        protectedLabels: protectedLabels.map((p) => p.label),
        standardLabels: ["production", "staging", "latest", "deprecated"],
        totalPrompts: result.totalCount,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to get labels overview",
      });
    }
  }),

  // Validate labels before applying them
  validateLabels: protectedProjectProcedure
    .input(z.object({ labels: z.array(z.string()) }))
    .query(async ({ input, ctx }) => {
      try {
        const validation = await PromptStoreService.validateLabels(
          input.labels,
          ctx.session.projectId,
        );

        return validation;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Label validation failed",
        });
      }
    }),

  // Create a protected label (requires admin permissions)
  createProtectedLabel: protectedProjectProcedure
    .input(z.object({ label: z.string().min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      try {
        await PromptStoreService.createProtectedLabel(
          ctx.session.projectId,
          input.label,
          ctx.session.user.id,
        );

        return {
          success: true,
          message: `Protected label '${input.label}' created successfully`,
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("unique constraint")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Protected label already exists",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create protected label",
        });
      }
    }),

  // Remove a protected label
  removeProtectedLabel: protectedProjectProcedure
    .input(z.object({ label: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await PromptStoreService.removeProtectedLabel(
          ctx.session.projectId,
          input.label,
          ctx.session.user.id,
        );

        return {
          success: true,
          message: `Protected label '${input.label}' removed successfully`,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to remove protected label",
        });
      }
    }),

  // Promote a prompt through the pipeline (candidate -> staging -> production)
  promotePrompt: protectedProjectProcedure
    .input(
      z.object({
        promptId: z.string(),
        fromLabel: z.string(),
        toLabel: z.string(),
        commitMessage: z.string().min(1),
        createNewVersion: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate promotion path
        const validPromotions: Record<string, string[]> = {
          "candidate/*": ["staging", "production"],
          "experimental/*": ["candidate/*", "staging"],
          staging: ["production"],
          latest: ["staging", "production"],
        };

        const fromPattern = input.fromLabel.startsWith("candidate/")
          ? "candidate/*"
          : input.fromLabel.startsWith("experimental/")
            ? "experimental/*"
            : input.fromLabel;

        const validTargets = validPromotions[fromPattern] || [];
        const toPattern = input.toLabel.startsWith("candidate/")
          ? "candidate/*"
          : input.toLabel;

        if (
          !validTargets.includes(toPattern) &&
          !validTargets.includes(input.toLabel)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot promote from '${input.fromLabel}' to '${input.toLabel}'`,
          });
        }

        // Use the publishing workflow
        const result = await PromptStoreService.publishPrompt(
          {
            sourcePromptId: input.promptId,
            targetLabel: input.toLabel,
            commitMessage: input.commitMessage,
            createNewVersion: input.createNewVersion,
            removeFromPreviousLabels: [input.fromLabel],
            requiresApproval: input.toLabel === "production",
            approvedBy: ctx.session.user.id,
          },
          ctx.session.projectId,
          ctx.session.user.id,
        );

        return {
          ...result,
          message: `Successfully promoted from '${input.fromLabel}' to '${input.toLabel}'`,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Promotion failed",
        });
      }
    }),

  // Get promotion history for a prompt
  getPromptHistory: protectedProjectProcedure
    .input(z.object({ promptName: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // Get all versions of this prompt with their label history
        const prompts = await ctx.prisma.prompt.findMany({
          where: {
            projectId: ctx.session.projectId,
            name: input.promptName,
          },
          orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            version: true,
            labels: true,
            commitMessage: true,
            createdAt: true,
            updatedAt: true,
            createdBy: true,
          },
        });

        // For now, return the prompt versions as history
        // In production, you'd have a dedicated history table
        return {
          prompts,
          timeline: prompts.map((p) => ({
            version: p.version,
            labels: p.labels,
            commitMessage: p.commitMessage,
            timestamp: p.updatedAt,
            changedBy: p.createdBy,
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get prompt history",
        });
      }
    }),
});
