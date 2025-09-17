import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { prisma } from "@langfuse/shared/src/db";
import { auditLog } from "@/src/features/audit-logs/auditLog";

// Standard label patterns for the prompt store
export const PromptLabelPatterns = {
  PRODUCTION: "production",
  STAGING: "staging",
  CANDIDATE_PREFIX: "candidate/",
  EXPERIMENTAL_PREFIX: "experimental/",
  DEPRECATED: "deprecated",
  LATEST: "latest",
} as const;

export const PromptStoreLabel = z
  .enum(["production", "staging", "deprecated", "latest"])
  .or(
    z
      .string()
      .refine(
        (label) =>
          label.startsWith("candidate/") || label.startsWith("experimental/"),
        {
          message:
            "Custom labels must start with 'candidate/' or 'experimental/'",
        },
      ),
  );

export type PromptStoreLabel = z.infer<typeof PromptStoreLabel>;

export const PromptLabelingRequest = z.object({
  promptId: z.string(),
  labels: z.array(PromptStoreLabel),
  commitMessage: z.string().optional(),
  publishToProduction: z.boolean().default(false),
});

export type PromptLabelingRequest = z.infer<typeof PromptLabelingRequest>;

export const PromptPublishingWorkflow = z.object({
  sourcePromptId: z.string(),
  targetLabel: PromptStoreLabel,
  commitMessage: z.string().min(1, "Commit message is required"),
  createNewVersion: z.boolean().default(false),
  removeFromPreviousLabels: z.array(PromptStoreLabel).default([]),
  requiresApproval: z.boolean().default(false),
  approvedBy: z.string().optional(),
});

export type PromptPublishingWorkflow = z.infer<typeof PromptPublishingWorkflow>;

export const PromptStoreHistory = z.object({
  id: z.string(),
  promptId: z.string(),
  promptName: z.string(),
  version: z.number(),
  action: z.enum(["created", "labeled", "published", "deprecated", "removed"]),
  labels: z.array(z.string()),
  commitMessage: z.string().optional(),
  changedBy: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type PromptStoreHistory = z.infer<typeof PromptStoreHistory>;

export class PromptStoreService {
  static async validateLabels(
    labels: string[],
    projectId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for protected labels
    const protectedLabels = await prisma.promptProtectedLabels.findMany({
      where: { projectId },
      select: { label: true },
    });

    const protectedLabelSet = new Set(protectedLabels.map((p) => p.label));

    for (const label of labels) {
      // Check if label follows valid patterns
      const isValidPattern =
        label === PromptLabelPatterns.PRODUCTION ||
        label === PromptLabelPatterns.STAGING ||
        label === PromptLabelPatterns.DEPRECATED ||
        label === PromptLabelPatterns.LATEST ||
        label.startsWith(PromptLabelPatterns.CANDIDATE_PREFIX) ||
        label.startsWith(PromptLabelPatterns.EXPERIMENTAL_PREFIX);

      if (!isValidPattern) {
        errors.push(`Invalid label pattern: ${label}`);
      }

      // Check if label is protected
      if (protectedLabelSet.has(label)) {
        errors.push(
          `Label '${label}' is protected and requires special permissions`,
        );
      }
    }

    // Business logic validations
    const hasProduction = labels.includes(PromptLabelPatterns.PRODUCTION);
    const hasStaging = labels.includes(PromptLabelPatterns.STAGING);
    const hasDeprecated = labels.includes(PromptLabelPatterns.DEPRECATED);

    if (hasProduction && hasDeprecated) {
      errors.push("Cannot have both 'production' and 'deprecated' labels");
    }

    if (hasProduction && !hasStaging) {
      // Allow direct production publishing, but log a warning
      console.warn("Publishing directly to production without staging label");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static async publishPrompt(
    workflow: PromptPublishingWorkflow,
    projectId: string,
    userId: string,
  ): Promise<{ success: boolean; promptId: string; message: string }> {
    try {
      // Get the source prompt
      const sourcePrompt = await prisma.prompt.findFirst({
        where: {
          id: workflow.sourcePromptId,
          projectId,
        },
      });

      if (!sourcePrompt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source prompt not found",
        });
      }

      // Validate target label
      const labelValidation = await this.validateLabels(
        [workflow.targetLabel],
        projectId,
      );
      if (!labelValidation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid target label: ${labelValidation.errors.join(", ")}`,
        });
      }

      let targetPromptId = workflow.sourcePromptId;

      // Create new version if requested
      if (workflow.createNewVersion) {
        const latestVersion = await prisma.prompt.findFirst({
          where: {
            projectId,
            name: sourcePrompt.name,
          },
          orderBy: { version: "desc" },
          select: { version: true },
        });

        const newVersion = (latestVersion?.version || 0) + 1;

        const newPrompt = await prisma.prompt.create({
          data: {
            projectId,
            name: sourcePrompt.name,
            version: newVersion,
            prompt: sourcePrompt.prompt as any,
            type: sourcePrompt.type,
            config: sourcePrompt.config as any,
            tags: sourcePrompt.tags,
            labels: [workflow.targetLabel], // Start with target label
            commitMessage: workflow.commitMessage,
            createdBy: userId,
          },
        });

        targetPromptId = newPrompt.id;
      } else {
        // Update existing prompt labels
        const currentLabels = sourcePrompt.labels.filter(
          (label) =>
            !workflow.removeFromPreviousLabels.includes(
              label as PromptStoreLabel,
            ),
        );

        const updatedLabels = Array.from(
          new Set([...currentLabels, workflow.targetLabel]),
        );

        await prisma.prompt.update({
          where: { id: workflow.sourcePromptId },
          data: {
            labels: updatedLabels,
            commitMessage: workflow.commitMessage,
            updatedAt: new Date(),
          },
        });
      }

      // Handle special label logic
      if (workflow.targetLabel === PromptLabelPatterns.PRODUCTION) {
        await this.handleProductionPublishing(
          sourcePrompt.name,
          targetPromptId,
          projectId,
          userId,
        );
      }

      if (workflow.targetLabel === PromptLabelPatterns.LATEST) {
        await this.updateLatestLabel(
          sourcePrompt.name,
          targetPromptId,
          projectId,
        );
      }

      // Log the publishing action
      await auditLog({
        session: { user: { id: userId }, projectId } as any,
        resourceType: "prompt",
        resourceId: targetPromptId,
        action: "publish",
        after: {
          targetLabel: workflow.targetLabel,
          commitMessage: workflow.commitMessage,
          createNewVersion: workflow.createNewVersion,
        },
      });

      // Record in prompt store history
      await this.recordHistoryEvent({
        promptId: targetPromptId,
        promptName: sourcePrompt.name,
        version: workflow.createNewVersion
          ? (
              await prisma.prompt.findUnique({
                where: { id: targetPromptId },
                select: { version: true },
              })
            )?.version || sourcePrompt.version
          : sourcePrompt.version,
        action: "published",
        labels: [workflow.targetLabel],
        commitMessage: workflow.commitMessage,
        changedBy: userId,
        metadata: {
          sourcePromptId: workflow.sourcePromptId,
          createNewVersion: workflow.createNewVersion,
          removeFromPreviousLabels: workflow.removeFromPreviousLabels,
        },
      });

      return {
        success: true,
        promptId: targetPromptId,
        message: `Successfully published prompt to '${workflow.targetLabel}'`,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Publishing failed",
      });
    }
  }

  private static async handleProductionPublishing(
    promptName: string,
    newPromptId: string,
    projectId: string,
    userId: string,
  ): Promise<void> {
    // First, get all prompts that need the production label removed
    const promptsToUpdate = await prisma.prompt.findMany({
      where: {
        projectId,
        name: promptName,
        id: { not: newPromptId },
        labels: { has: PromptLabelPatterns.PRODUCTION },
      },
      select: { id: true, labels: true },
    });

    // Update each prompt individually to remove the production label
    for (const prompt of promptsToUpdate) {
      const updatedLabels = prompt.labels.filter(
        (label) => label !== PromptLabelPatterns.PRODUCTION,
      );
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { labels: updatedLabels },
      });
    }

    // Log production deployment
    console.log(
      `Prompt '${promptName}' published to production by user ${userId}`,
    );
  }

  private static async updateLatestLabel(
    promptName: string,
    newPromptId: string,
    projectId: string,
  ): Promise<void> {
    // First, get all prompts that need the latest label removed
    const promptsToUpdate = await prisma.prompt.findMany({
      where: {
        projectId,
        name: promptName,
        id: { not: newPromptId },
        labels: { has: PromptLabelPatterns.LATEST },
      },
      select: { id: true, labels: true },
    });

    // Update each prompt individually to remove the latest label
    for (const prompt of promptsToUpdate) {
      const updatedLabels = prompt.labels.filter(
        (label) => label !== PromptLabelPatterns.LATEST,
      );
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { labels: updatedLabels },
      });
    }
  }

  private static async recordHistoryEvent(event: {
    promptId: string;
    promptName: string;
    version: number;
    action: "created" | "labeled" | "published" | "deprecated" | "removed";
    labels: string[];
    commitMessage?: string;
    changedBy: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    // For now, we could store this in a separate table or use the audit log
    // In production, you might want a dedicated prompt_store_history table
    console.log("Prompt store history event:", {
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  static async getPromptByLabel(
    promptName: string,
    label: string,
    projectId: string,
  ): Promise<any | null> {
    return await prisma.prompt.findFirst({
      where: {
        projectId,
        name: promptName,
        labels: { has: label },
      },
      orderBy: { version: "desc" }, // Get latest version with this label
    });
  }

  static async getPromptsInStore(
    projectId: string,
    filters?: {
      label?: string;
      name?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    prompts: any[];
    totalCount: number;
    groupedByLabel: Record<string, number>;
  }> {
    const where: any = { projectId };

    if (filters?.label) {
      where.labels = { has: filters.label };
    }

    if (filters?.name) {
      where.name = { contains: filters.name, mode: "insensitive" };
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasEvery: filters.tags };
    }

    const [prompts, totalCount] = await Promise.all([
      prisma.prompt.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { version: "desc" }],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
        include: {
          project: { select: { name: true } },
        },
      }),
      prisma.prompt.count({ where }),
    ]);

    // Group by labels for quick overview
    const allPrompts = await prisma.prompt.findMany({
      where: { projectId },
      select: { labels: true },
    });

    const groupedByLabel: Record<string, number> = {};
    allPrompts.forEach((prompt) => {
      prompt.labels.forEach((label) => {
        groupedByLabel[label] = (groupedByLabel[label] || 0) + 1;
      });
    });

    return {
      prompts,
      totalCount,
      groupedByLabel,
    };
  }

  static async createProtectedLabel(
    projectId: string,
    label: string,
    userId: string,
  ): Promise<void> {
    await prisma.promptProtectedLabels.create({
      data: {
        projectId,
        label,
      },
    });

    await auditLog({
      session: { user: { id: userId }, projectId } as any,
      resourceType: "prompt",
      resourceId: "protected-labels",
      action: "create",
      after: { label },
    });
  }

  static async removeProtectedLabel(
    projectId: string,
    label: string,
    userId: string,
  ): Promise<void> {
    await prisma.promptProtectedLabels.delete({
      where: {
        projectId_label: {
          projectId,
          label,
        },
      },
    });

    await auditLog({
      session: { user: { id: userId }, projectId } as any,
      resourceType: "prompt",
      resourceId: "protected-labels",
      action: "delete",
      after: { label },
    });
  }
}

export const promptStoreService = new PromptStoreService();
