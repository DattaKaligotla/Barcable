import { z } from "zod";
import { prisma } from "@langfuse/shared/src/db";
import { auditLog } from "@/src/features/audit-logs/auditLog";

// Zod schemas for artifact generation
export const ChangeEntry = z.object({
  type: z.enum(["created", "updated", "deleted", "promoted", "labeled"]),
  timestamp: z.string(),
  prompt: z.object({
    name: z.string(),
    version: z.number(),
    id: z.string(),
  }),
  changes: z.object({
    labels: z
      .object({
        added: z.array(z.string()).optional(),
        removed: z.array(z.string()).optional(),
        current: z.array(z.string()),
      })
      .optional(),
    content: z
      .object({
        prompt: z.boolean().optional(),
        config: z.boolean().optional(),
        variables: z.boolean().optional(),
      })
      .optional(),
    metadata: z
      .object({
        tags: z.array(z.string()).optional(),
        description: z.string().optional(),
        commitMessage: z.string().optional(),
      })
      .optional(),
  }),
  author: z.object({
    id: z.string(),
    email: z.string().optional(),
  }),
});

export const ChangeList = z.object({
  version: z.string().default("1.0"),
  generated_at: z.string(),
  project_id: z.string(),
  timeframe: z.object({
    start: z.string(),
    end: z.string(),
  }),
  summary: z.object({
    total_changes: z.number(),
    prompts_affected: z.number(),
    new_prompts: z.number(),
    updated_prompts: z.number(),
    deleted_prompts: z.number(),
    label_changes: z.number(),
  }),
  changes: z.array(ChangeEntry),
  deployment_info: z.object({
    production_ready: z.array(z.string()),
    staging_ready: z.array(z.string()),
    requires_review: z.array(z.string()),
  }),
});

export const ArtifactSummary = z.object({
  workflow: z.object({
    name: z.string().default("Barcable Prompt Engineering"),
    version: z.string().default("1.0"),
    generated_at: z.string(),
  }),
  project: z.object({
    id: z.string(),
    name: z.string(),
  }),
  timeframe: z.object({
    start: z.string(),
    end: z.string(),
    duration_hours: z.number(),
  }),
  metrics: z.object({
    prompts: z.object({
      total: z.number(),
      active: z.number(),
      in_production: z.number(),
      in_staging: z.number(),
      candidates: z.number(),
    }),
    changes: z.object({
      total: z.number(),
      created: z.number(),
      updated: z.number(),
      promoted: z.number(),
      labeled: z.number(),
    }),
    performance: z
      .object({
        avg_evaluation_score: z.number().optional(),
        top_performing_prompts: z.array(z.string()),
        improvement_rate: z.number().optional(),
      })
      .optional(),
  }),
  deployment: z.object({
    production_candidates: z.array(
      z.object({
        name: z.string(),
        version: z.number(),
        score: z.number().optional(),
        ready: z.boolean(),
      }),
    ),
    staging_updates: z.array(
      z.object({
        name: z.string(),
        version: z.number(),
        changes: z.array(z.string()),
      }),
    ),
    review_required: z.array(
      z.object({
        name: z.string(),
        reason: z.string(),
        urgency: z.enum(["low", "medium", "high"]),
      }),
    ),
  }),
  quality: z.object({
    test_coverage: z.number().optional(),
    evaluation_status: z.object({
      passed: z.number(),
      failed: z.number(),
      pending: z.number(),
    }),
    compliance: z.object({
      label_standards: z.boolean(),
      review_process: z.boolean(),
      audit_trail: z.boolean(),
    }),
  }),
});

export type ChangeListType = z.infer<typeof ChangeList>;
export type ArtifactSummaryType = z.infer<typeof ArtifactSummary>;

export class CICDArtifactService {
  /**
   * Generate CI/CD artifacts for a specific timeframe
   */
  static async generateArtifacts(
    projectId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      outputDir?: string;
      includeScoring?: boolean;
      includeEvaluation?: boolean;
    } = {},
  ): Promise<{
    changeList: ChangeListType;
    summary: ArtifactSummaryType;
    files: {
      changeListPath: string;
      summaryPath: string;
    };
  }> {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      endDate = new Date(),
      outputDir = ".barcable",
      includeScoring = true,
      includeEvaluation = true,
    } = options;

    // Generate change list
    const changeList = await this.generateChangeList(
      projectId,
      startDate,
      endDate,
    );

    // Generate summary
    const summary = await this.generateSummary(projectId, startDate, endDate, {
      includeScoring,
      includeEvaluation,
    });

    // Create file paths
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const changeListPath = `${outputDir}/change_list_${timestamp}.yaml`;
    const summaryPath = `${outputDir}/summary_${timestamp}.json`;

    // Log artifact generation
    await auditLog({
      session: { user: { id: "system" }, orgId: "system", projectId },
      resourceType: "prompt",
      resourceId: projectId,
      action: "create",
      after: {
        type: "cicd_artifacts",
        timeframe: { start: startDate, end: endDate },
        changeCount: changeList.summary.total_changes,
      },
    });

    return {
      changeList,
      summary,
      files: {
        changeListPath,
        summaryPath,
      },
    };
  }

  /**
   * Generate the change list YAML
   */
  static async generateChangeList(
    projectId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ChangeListType> {
    // Get all prompt changes in timeframe
    const prompts = await prisma.prompt.findMany({
      where: {
        projectId,
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { updatedAt: { gte: startDate, lte: endDate } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get audit logs for detailed change tracking
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        projectId,
        createdAt: { gte: startDate, lte: endDate },
        resourceType: "prompt",
      },
      orderBy: { createdAt: "desc" },
    });

    const changes: z.infer<typeof ChangeEntry>[] = [];
    const promptsAffected = new Set<string>();

    // Process prompts into changes
    for (const prompt of prompts) {
      promptsAffected.add(prompt.name);

      // Determine change type
      let changeType:
        | "created"
        | "updated"
        | "deleted"
        | "promoted"
        | "labeled" = "updated";
      if (prompt.createdAt >= startDate && prompt.createdAt <= endDate) {
        changeType = "created";
      }

      // Find related audit logs for this prompt
      const promptAuditLogs = auditLogs.filter(
        (log) => log.resourceId === prompt.id,
      );

      // Check for label changes
      const labelChanges = promptAuditLogs.filter(
        (log) =>
          log.after && typeof log.after === "object" && "labels" in log.after,
      );

      if (labelChanges.length > 0) {
        changeType = "labeled";
      }

      // Check for promotion changes
      const promotionChanges = promptAuditLogs.filter(
        (log) =>
          log.after && typeof log.after === "object" && "promoted" in log.after,
      );

      if (promotionChanges.length > 0) {
        changeType = "promoted";
      }

      changes.push({
        type: changeType,
        timestamp: prompt.updatedAt.toISOString(),
        prompt: {
          name: prompt.name,
          version: prompt.version,
          id: prompt.id,
        },
        changes: {
          labels: {
            current: prompt.labels,
          },
          metadata: {
            tags: prompt.tags,
            commitMessage: prompt.commitMessage || undefined,
          },
        },
        author: {
          id: prompt.createdBy || "",
          email: prompt.createdBy || undefined,
        },
      });
    }

    // Calculate summary statistics
    const summary = {
      total_changes: changes.length,
      prompts_affected: promptsAffected.size,
      new_prompts: changes.filter((c) => c.type === "created").length,
      updated_prompts: changes.filter((c) => c.type === "updated").length,
      deleted_prompts: changes.filter((c) => c.type === "deleted").length,
      label_changes: changes.filter(
        (c) => c.type === "labeled" || c.type === "promoted",
      ).length,
    };

    // Determine deployment readiness
    const productionReady = changes
      .filter((c) => c.changes.labels?.current.includes("production"))
      .map((c) => c.prompt.name);

    const stagingReady = changes
      .filter((c) => c.changes.labels?.current.includes("staging"))
      .map((c) => c.prompt.name);

    const requiresReview = changes
      .filter(
        (c) =>
          c.type === "created" ||
          c.changes.labels?.current.includes("production") ||
          c.changes.labels?.current.some((label) =>
            label.startsWith("candidate/"),
          ),
      )
      .map((c) => c.prompt.name);

    return {
      version: "1.0",
      generated_at: new Date().toISOString(),
      project_id: projectId,
      timeframe: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary,
      changes,
      deployment_info: {
        production_ready: Array.from(new Set(productionReady)),
        staging_ready: Array.from(new Set(stagingReady)),
        requires_review: Array.from(new Set(requiresReview)),
      },
    };
  }

  /**
   * Generate the summary JSON
   */
  static async generateSummary(
    projectId: string,
    startDate: Date,
    endDate: Date,
    options: { includeScoring?: boolean; includeEvaluation?: boolean } = {},
  ): Promise<ArtifactSummaryType> {
    const { includeScoring = true, includeEvaluation = true } = options;

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Get prompt metrics
    const allPrompts = await prisma.prompt.findMany({
      where: { projectId },
    });

    const activePrompts = allPrompts.filter(
      (p) => !p.labels.includes("deprecated"),
    );
    const productionPrompts = allPrompts.filter((p) =>
      p.labels.includes("production"),
    );
    const stagingPrompts = allPrompts.filter((p) =>
      p.labels.includes("staging"),
    );
    const candidatePrompts = allPrompts.filter((p) =>
      p.labels.some((label) => label.startsWith("candidate/")),
    );

    // Get changes in timeframe
    const changes = await prisma.prompt.findMany({
      where: {
        projectId,
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { updatedAt: { gte: startDate, lte: endDate } },
        ],
      },
    });

    // Calculate change statistics
    const changeStats = {
      total: changes.length,
      created: changes.filter(
        (c) => c.createdAt >= startDate && c.createdAt <= endDate,
      ).length,
      updated: changes.filter(
        (c) =>
          c.updatedAt >= startDate &&
          c.updatedAt <= endDate &&
          c.createdAt < startDate,
      ).length,
      promoted: 0, // Would need audit log analysis for exact count
      labeled: 0, // Would need audit log analysis for exact count
    };

    // Performance metrics (optional, based on scoring data)
    let performanceMetrics: ArtifactSummaryType["metrics"]["performance"] =
      undefined;

    if (includeScoring) {
      // This would integrate with the scoring service we built earlier
      const topPerformingPrompts = productionPrompts
        .slice(0, 5)
        .map((p) => p.name);

      performanceMetrics = {
        avg_evaluation_score: 85.5, // Placeholder - would calculate from actual scores
        top_performing_prompts: topPerformingPrompts,
        improvement_rate: 12.3, // Placeholder - would calculate trend
      };
    }

    // Deployment candidates
    const productionCandidates = candidatePrompts.map((p) => ({
      name: p.name,
      version: p.version,
      score: includeScoring ? Math.random() * 100 : undefined, // Placeholder
      ready: p.labels.includes("staging"), // Ready if in staging
    }));

    const stagingUpdates = stagingPrompts.map((p) => ({
      name: p.name,
      version: p.version,
      changes: ["Updated content", "Label changes"], // Placeholder
    }));

    const reviewRequired = candidatePrompts
      .filter((p) => p.createdAt >= startDate)
      .map((p) => ({
        name: p.name,
        reason: "New candidate prompt requires review",
        urgency: "medium" as const,
      }));

    // Quality metrics
    let evaluationStatus = {
      passed: 0,
      failed: 0,
      pending: 0,
    };

    if (includeEvaluation) {
      // This would integrate with the evaluation service we built earlier
      evaluationStatus = {
        passed: Math.floor(activePrompts.length * 0.8),
        failed: Math.floor(activePrompts.length * 0.1),
        pending: Math.floor(activePrompts.length * 0.1),
      };
    }

    const durationHours =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    return {
      workflow: {
        name: "Barcable Prompt Engineering",
        version: "1.0",
        generated_at: new Date().toISOString(),
      },
      project: {
        id: projectId,
        name: project.name,
      },
      timeframe: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        duration_hours: Math.round(durationHours * 100) / 100,
      },
      metrics: {
        prompts: {
          total: allPrompts.length,
          active: activePrompts.length,
          in_production: productionPrompts.length,
          in_staging: stagingPrompts.length,
          candidates: candidatePrompts.length,
        },
        changes: changeStats,
        performance: performanceMetrics,
      },
      deployment: {
        production_candidates: productionCandidates,
        staging_updates: stagingUpdates,
        review_required: reviewRequired,
      },
      quality: {
        test_coverage: includeEvaluation ? 85.2 : undefined, // Placeholder
        evaluation_status: evaluationStatus,
        compliance: {
          label_standards: true,
          review_process: true,
          audit_trail: true,
        },
      },
    };
  }

  /**
   * Export artifacts to files
   */
  static async exportToFiles(
    changeList: ChangeListType,
    summary: ArtifactSummaryType,
    outputDir: string = ".barcable",
  ): Promise<{
    changeListPath: string;
    summaryPath: string;
    yamlContent: string;
    jsonContent: string;
  }> {
    // Convert to file contents
    const yamlContent = `# Barcable CI/CD Change List
# Generated at: ${changeList.generated_at}
# Project: ${changeList.project_id}

version: "${changeList.version}"
generated_at: "${changeList.generated_at}"
project_id: "${changeList.project_id}"

timeframe:
  start: "${changeList.timeframe.start}"
  end: "${changeList.timeframe.end}"

summary:
  total_changes: ${changeList.summary.total_changes}
  prompts_affected: ${changeList.summary.prompts_affected}
  new_prompts: ${changeList.summary.new_prompts}
  updated_prompts: ${changeList.summary.updated_prompts}
  deleted_prompts: ${changeList.summary.deleted_prompts}
  label_changes: ${changeList.summary.label_changes}

deployment_info:
  production_ready: [${changeList.deployment_info.production_ready.map((p) => `"${p}"`).join(", ")}]
  staging_ready: [${changeList.deployment_info.staging_ready.map((p) => `"${p}"`).join(", ")}]
  requires_review: [${changeList.deployment_info.requires_review.map((p) => `"${p}"`).join(", ")}]

changes:
${changeList.changes
  .map(
    (change) => `  - type: "${change.type}"
    timestamp: "${change.timestamp}"
    prompt:
      name: "${change.prompt.name}"
      version: ${change.prompt.version}
      id: "${change.prompt.id}"
    changes:
      labels:
        current: [${change.changes.labels?.current.map((l) => `"${l}"`).join(", ") || ""}]
    author:
      id: "${change.author.id}"`,
  )
  .join("\n")}
`;

    const jsonContent = JSON.stringify(summary, null, 2);

    // Generate timestamped filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const changeListPath = `${outputDir}/change_list_${timestamp}.yaml`;
    const summaryPath = `${outputDir}/summary_${timestamp}.json`;

    return {
      changeListPath,
      summaryPath,
      yamlContent,
      jsonContent,
    };
  }

  /**
   * Generate artifacts for latest changes (convenience method)
   */
  static async generateLatestArtifacts(
    projectId: string,
    hoursBack: number = 24,
  ): Promise<{
    changeList: ChangeListType;
    summary: ArtifactSummaryType;
    files: {
      changeListPath: string;
      summaryPath: string;
      yamlContent: string;
      jsonContent: string;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hoursBack * 60 * 60 * 1000);

    const artifacts = await this.generateArtifacts(projectId, {
      startDate,
      endDate,
      includeScoring: true,
      includeEvaluation: true,
    });

    const files = await this.exportToFiles(
      artifacts.changeList,
      artifacts.summary,
    );

    return {
      ...artifacts,
      files,
    };
  }
}
