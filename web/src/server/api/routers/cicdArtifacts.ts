import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { CICDArtifactService } from "@/src/features/prompts/server/cicdArtifactService";

export const cicdArtifactRouter = createTRPCRouter({
  // Generate CI/CD artifacts for a specific timeframe
  generateArtifacts: protectedProjectProcedure
    .input(
      z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        hoursBack: z.number().min(1).max(168).default(24), // Max 1 week
        includeScoring: z.boolean().default(true),
        includeEvaluation: z.boolean().default(true),
        outputDir: z.string().default(".barcable"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        let startDate: Date;
        let endDate: Date;

        if (input.startDate && input.endDate) {
          startDate = new Date(input.startDate);
          endDate = new Date(input.endDate);
        } else {
          endDate = new Date();
          startDate = new Date(
            endDate.getTime() - input.hoursBack * 60 * 60 * 1000,
          );
        }

        const result = await CICDArtifactService.generateArtifacts(
          ctx.session.projectId,
          {
            startDate,
            endDate,
            outputDir: input.outputDir,
            includeScoring: input.includeScoring,
            includeEvaluation: input.includeEvaluation,
          },
        );

        return {
          success: true,
          ...result,
          message: `Generated CI/CD artifacts for ${Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))} hours of changes`,
        };
      } catch (error) {
        console.error("CI/CD artifact generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Artifact generation failed",
        });
      }
    }),

  // Generate artifacts for latest changes (convenience endpoint)
  generateLatest: protectedProjectProcedure
    .input(
      z.object({
        hoursBack: z.number().min(1).max(168).default(24),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await CICDArtifactService.generateLatestArtifacts(
          ctx.session.projectId,
          input.hoursBack,
        );

        return {
          success: true,
          ...result,
          message: `Generated latest CI/CD artifacts for ${input.hoursBack} hours back`,
        };
      } catch (error) {
        console.error("Latest CI/CD artifact generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Latest artifact generation failed",
        });
      }
    }),

  // Export artifacts to downloadable files
  exportArtifacts: protectedProjectProcedure
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        format: z.enum(["yaml", "json", "both"]).default("both"),
        includeScoring: z.boolean().default(true),
        includeEvaluation: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);

        const artifacts = await CICDArtifactService.generateArtifacts(
          ctx.session.projectId,
          {
            startDate,
            endDate,
            includeScoring: input.includeScoring,
            includeEvaluation: input.includeEvaluation,
          },
        );

        const files = await CICDArtifactService.exportToFiles(
          artifacts.changeList,
          artifacts.summary,
        );

        let response = {
          success: true,
          message: "Artifacts exported successfully",
          timestamp: new Date().toISOString(),
        };

        if (input.format === "yaml" || input.format === "both") {
          response = {
            ...response,
            ...{
              yamlContent: files.yamlContent,
              changeListPath: files.changeListPath,
            },
          };
        }

        if (input.format === "json" || input.format === "both") {
          response = {
            ...response,
            ...{
              jsonContent: files.jsonContent,
              summaryPath: files.summaryPath,
            },
          };
        }

        return response;
      } catch (error) {
        console.error("CI/CD artifact export failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Artifact export failed",
        });
      }
    }),

  // Get artifact generation status/preview
  previewArtifacts: protectedProjectProcedure
    .input(
      z.object({
        hoursBack: z.number().min(1).max(168).default(24),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const endDate = new Date();
        const startDate = new Date(
          endDate.getTime() - input.hoursBack * 60 * 60 * 1000,
        );

        // Generate a lightweight preview without full artifact creation
        const changeList = await CICDArtifactService.generateChangeList(
          ctx.session.projectId,
          startDate,
          endDate,
        );

        return {
          success: true,
          preview: {
            timeframe: changeList.timeframe,
            summary: changeList.summary,
            deployment_info: changeList.deployment_info,
            sample_changes: changeList.changes.slice(0, 5), // First 5 changes
            total_changes: changeList.changes.length,
          },
          message: `Preview for ${input.hoursBack} hours of changes`,
        };
      } catch (error) {
        console.error("CI/CD artifact preview failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Artifact preview failed",
        });
      }
    }),

  // Get deployment readiness report
  getDeploymentReport: protectedProjectProcedure.query(async ({ ctx }) => {
    try {
      // Get current deployment status across all prompts
      const summary = await CICDArtifactService.generateSummary(
        ctx.session.projectId,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
        new Date(),
        { includeScoring: true, includeEvaluation: true },
      );

      return {
        success: true,
        deployment: summary.deployment,
        metrics: summary.metrics,
        quality: summary.quality,
        message: "Deployment readiness report generated",
      };
    } catch (error) {
      console.error("Deployment report generation failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Deployment report generation failed",
      });
    }
  }),

  // Validate CI/CD configuration
  validateConfig: protectedProjectProcedure.query(async ({ ctx }) => {
    try {
      // Check if the project has the necessary setup for CI/CD
      const summary = await CICDArtifactService.generateSummary(
        ctx.session.projectId,
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
      );

      const validation = {
        hasPrompts: summary.metrics.prompts.total > 0,
        hasLabels:
          summary.metrics.prompts.in_production > 0 ||
          summary.metrics.prompts.in_staging > 0,
        hasAuditTrail: summary.quality.compliance.audit_trail,
        hasReviewProcess: summary.quality.compliance.review_process,
        hasLabelStandards: summary.quality.compliance.label_standards,
      };

      const isValid = Object.values(validation).every(Boolean);

      return {
        success: true,
        validation,
        isValid,
        recommendations: !isValid
          ? [
              !validation.hasPrompts && "Create prompts in your project",
              !validation.hasLabels &&
                "Add labels to prompts (production, staging, etc.)",
              !validation.hasAuditTrail && "Enable audit logging",
              !validation.hasReviewProcess &&
                "Set up review workflow for production changes",
              !validation.hasLabelStandards &&
                "Establish label naming standards",
            ].filter(Boolean)
          : [],
        message: isValid
          ? "CI/CD configuration is valid"
          : "CI/CD configuration needs improvements",
      };
    } catch (error) {
      console.error("CI/CD config validation failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Config validation failed",
      });
    }
  }),
});
