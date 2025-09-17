import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import {
  PromptScoringService,
  ComparisonRequest,
  type PromptRanking,
} from "@/src/features/prompts/server/promptScoring";

export const promptScoringRouter = createTRPCRouter({
  // Score and rank prompt variants from evaluation results
  scoreAndRank: protectedProjectProcedure
    .input(ComparisonRequest)
    .query(async ({ input }) => {
      try {
        const rankings = PromptScoringService.rankPrompts(input);
        return {
          rankings,
          metadata: {
            totalVariants: input.evaluationResults.length,
            weights: input.weights || {
              passRate: 0.4,
              averageScore: 0.3,
              latency: 0.2,
              cost: 0.1,
            },
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        console.error("Scoring failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Scoring failed",
        });
      }
    }),

  // Get detailed metrics for a specific variant
  getVariantMetrics: protectedProjectProcedure
    .input(
      z.object({
        variantResults: z.object({
          variantId: z.string(),
          variantName: z.string(),
          evaluations: z.array(
            z.object({
              datasetItemId: z.string(),
              overallScore: z.number(),
              passed: z.boolean(),
              latencyMs: z.number().optional(),
              executedAt: z.string(),
            }),
          ),
          summary: z.object({
            totalItems: z.number(),
            passedItems: z.number(),
            averageScore: z.number(),
            averageLatency: z.number().optional(),
            passRate: z.number(),
          }),
        }),
        modelConfig: z
          .object({
            variantId: z.string(),
            provider: z.string(),
            model: z.string(),
            temperature: z.number().optional(),
            maxTokens: z.number().optional(),
          })
          .optional(),
        weights: z
          .object({
            passRate: z.number().min(0).max(1).default(0.4),
            averageScore: z.number().min(0).max(1).default(0.3),
            latency: z.number().min(0).max(1).default(0.2),
            cost: z.number().min(0).max(1).default(0.1),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const metrics = PromptScoringService.calculateMetrics(
          input.variantResults,
          input.modelConfig,
        );

        const score = PromptScoringService.calculateCompositeScore(
          metrics,
          input.weights,
        );

        const tags = PromptScoringService.generateTags(metrics);
        const recommendation = PromptScoringService.generateRecommendation(
          metrics,
          score,
        );

        return {
          metrics,
          score,
          tags,
          recommendation,
          breakdown: {
            passRateContribution:
              metrics.passRate * (input.weights?.passRate || 0.4),
            averageScoreContribution:
              metrics.averageScore * (input.weights?.averageScore || 0.3),
            latencyContribution:
              Math.max(0, 1 - metrics.averageLatency / 10000) *
              (input.weights?.latency || 0.2),
            costContribution: metrics.estimatedCostPerRun
              ? Math.max(0, 1 - metrics.estimatedCostPerRun / 1.0) *
                (input.weights?.cost || 0.1)
              : input.weights?.cost || 0.1,
          },
        };
      } catch (error) {
        console.error("Metrics calculation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Metrics calculation failed",
        });
      }
    }),

  // Compare two specific variants side-by-side
  compareVariants: protectedProjectProcedure
    .input(
      z.object({
        variant1: z.object({
          variantId: z.string(),
          variantName: z.string(),
          evaluations: z.array(
            z.object({
              datasetItemId: z.string(),
              overallScore: z.number(),
              passed: z.boolean(),
              latencyMs: z.number().optional(),
              executedAt: z.string(),
            }),
          ),
          summary: z.object({
            totalItems: z.number(),
            passedItems: z.number(),
            averageScore: z.number(),
            averageLatency: z.number().optional(),
            passRate: z.number(),
          }),
        }),
        variant2: z.object({
          variantId: z.string(),
          variantName: z.string(),
          evaluations: z.array(
            z.object({
              datasetItemId: z.string(),
              overallScore: z.number(),
              passed: z.boolean(),
              latencyMs: z.number().optional(),
              executedAt: z.string(),
            }),
          ),
          summary: z.object({
            totalItems: z.number(),
            passedItems: z.number(),
            averageScore: z.number(),
            averageLatency: z.number().optional(),
            passRate: z.number(),
          }),
        }),
        modelConfigs: z
          .array(
            z.object({
              variantId: z.string(),
              provider: z.string(),
              model: z.string(),
              temperature: z.number().optional(),
              maxTokens: z.number().optional(),
            }),
          )
          .optional(),
        weights: z
          .object({
            passRate: z.number().min(0).max(1).default(0.4),
            averageScore: z.number().min(0).max(1).default(0.3),
            latency: z.number().min(0).max(1).default(0.2),
            cost: z.number().min(0).max(1).default(0.1),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const comparison = PromptScoringService.rankPrompts({
          evaluationResults: [input.variant1, input.variant2],
          modelConfigs: input.modelConfigs,
          weights: input.weights,
        });

        const variant1Metrics = comparison.find(
          (r) => r.variantId === input.variant1.variantId,
        );
        const variant2Metrics = comparison.find(
          (r) => r.variantId === input.variant2.variantId,
        );

        if (!variant1Metrics || !variant2Metrics) {
          throw new Error("Failed to calculate metrics for comparison");
        }

        // Calculate differences and statistical significance
        const passRateDiff =
          variant1Metrics.metrics.passRate - variant2Metrics.metrics.passRate;
        const scoreDiff = variant1Metrics.score - variant2Metrics.score;
        const latencyDiff =
          variant1Metrics.metrics.averageLatency -
          variant2Metrics.metrics.averageLatency;

        // Determine which is better in each category
        const winner = {
          overall:
            variant1Metrics.score > variant2Metrics.score
              ? "variant1"
              : "variant2",
          passRate:
            variant1Metrics.metrics.passRate > variant2Metrics.metrics.passRate
              ? "variant1"
              : "variant2",
          latency:
            variant1Metrics.metrics.averageLatency <
            variant2Metrics.metrics.averageLatency
              ? "variant1"
              : "variant2",
          cost:
            variant1Metrics.metrics.estimatedCostPerRun &&
            variant2Metrics.metrics.estimatedCostPerRun
              ? variant1Metrics.metrics.estimatedCostPerRun <
                variant2Metrics.metrics.estimatedCostPerRun
                ? "variant1"
                : "variant2"
              : null,
        };

        return {
          variant1: variant1Metrics,
          variant2: variant2Metrics,
          differences: {
            passRate: passRateDiff,
            score: scoreDiff,
            latency: latencyDiff,
            cost:
              variant1Metrics.metrics.estimatedCostPerRun &&
              variant2Metrics.metrics.estimatedCostPerRun
                ? variant1Metrics.metrics.estimatedCostPerRun -
                  variant2Metrics.metrics.estimatedCostPerRun
                : null,
          },
          winner,
          recommendation: {
            preferred: winner.overall,
            reasoning: generateComparisonReasoning(
              variant1Metrics,
              variant2Metrics,
              winner,
            ),
          },
        };
      } catch (error) {
        console.error("Comparison failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Comparison failed",
        });
      }
    }),

  // Get available scoring weights presets
  getScoringPresets: protectedProjectProcedure.query(() => {
    return [
      {
        name: "Balanced",
        description: "Equal weight to accuracy, quality, speed, and cost",
        weights: { passRate: 0.4, averageScore: 0.3, latency: 0.2, cost: 0.1 },
      },
      {
        name: "Accuracy First",
        description: "Prioritize correctness over everything else",
        weights: { passRate: 0.6, averageScore: 0.3, latency: 0.1, cost: 0.0 },
      },
      {
        name: "Speed Optimized",
        description: "Fast responses are most important",
        weights: { passRate: 0.3, averageScore: 0.2, latency: 0.4, cost: 0.1 },
      },
      {
        name: "Cost Effective",
        description: "Minimize costs while maintaining quality",
        weights: { passRate: 0.3, averageScore: 0.2, latency: 0.1, cost: 0.4 },
      },
      {
        name: "Production Ready",
        description: "Focus on reliability and consistency",
        weights: { passRate: 0.5, averageScore: 0.3, latency: 0.1, cost: 0.1 },
      },
    ];
  }),

  // Get leaderboard of all variants from multiple evaluation runs
  getLeaderboard: protectedProjectProcedure
    .input(
      z.object({
        evaluationRuns: z.array(
          z.object({
            evaluationResults: z.array(
              z.object({
                variantId: z.string(),
                variantName: z.string(),
                evaluations: z.array(
                  z.object({
                    datasetItemId: z.string(),
                    overallScore: z.number(),
                    passed: z.boolean(),
                    latencyMs: z.number().optional(),
                    executedAt: z.string(),
                  }),
                ),
                summary: z.object({
                  totalItems: z.number(),
                  passedItems: z.number(),
                  averageScore: z.number(),
                  averageLatency: z.number().optional(),
                  passRate: z.number(),
                }),
              }),
            ),
            weights: z
              .object({
                passRate: z.number().min(0).max(1).default(0.4),
                averageScore: z.number().min(0).max(1).default(0.3),
                latency: z.number().min(0).max(1).default(0.2),
                cost: z.number().min(0).max(1).default(0.1),
              })
              .optional(),
            modelConfigs: z
              .array(
                z.object({
                  variantId: z.string(),
                  provider: z.string(),
                  model: z.string(),
                  temperature: z.number().optional(),
                  maxTokens: z.number().optional(),
                }),
              )
              .optional(),
          }),
        ),
        weights: z
          .object({
            passRate: z.number().min(0).max(1).default(0.4),
            averageScore: z.number().min(0).max(1).default(0.3),
            latency: z.number().min(0).max(1).default(0.2),
            cost: z.number().min(0).max(1).default(0.1),
          })
          .optional(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Combine results from multiple evaluation runs
        const allRankings: PromptRanking[] = [];

        for (const run of input.evaluationRuns) {
          const rankings = PromptScoringService.rankPrompts({
            ...run,
            weights: input.weights || run.weights,
          });
          allRankings.push(...rankings);
        }

        // Group by variant ID and calculate aggregate scores
        const variantMap = new Map<string, PromptRanking[]>();

        for (const ranking of allRankings) {
          if (!variantMap.has(ranking.variantId)) {
            variantMap.set(ranking.variantId, []);
          }
          variantMap.get(ranking.variantId)!.push(ranking);
        }

        // Calculate aggregate metrics for each variant
        const leaderboard = Array.from(variantMap.entries())
          .map(([variantId, rankings]) => {
            const avgScore =
              rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length;
            const avgPassRate =
              rankings.reduce((sum, r) => sum + r.metrics.passRate, 0) /
              rankings.length;
            const avgLatency =
              rankings.reduce((sum, r) => sum + r.metrics.averageLatency, 0) /
              rankings.length;

            // Use the most recent ranking for other details
            const latestRanking = rankings[rankings.length - 1];

            return {
              variantId,
              variantName: latestRanking.variantName,
              averageScore: Math.round(avgScore),
              evaluationCount: rankings.length,
              metrics: {
                ...latestRanking.metrics,
                passRate: avgPassRate,
                averageLatency: avgLatency,
              },
              tags: latestRanking.tags,
              recommendation: latestRanking.recommendation,
              trend:
                rankings.length > 1
                  ? rankings[rankings.length - 1].score - rankings[0].score
                  : 0,
            };
          })
          .sort((a, b) => b.averageScore - a.averageScore)
          .slice(0, input.limit)
          .map((variant, index) => ({ ...variant, rank: index + 1 }));

        return {
          leaderboard,
          metadata: {
            totalVariants: variantMap.size,
            totalEvaluations: input.evaluationRuns.length,
            weights: input.weights || {
              passRate: 0.4,
              averageScore: 0.3,
              latency: 0.2,
              cost: 0.1,
            },
            generatedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        console.error("Leaderboard generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Leaderboard generation failed",
        });
      }
    }),
});

// Helper function for comparison reasoning
function generateComparisonReasoning(
  variant1: PromptRanking,
  variant2: PromptRanking,
  winner: any,
): string {
  const reasons: string[] = [];

  if (winner.overall === "variant1") {
    if (winner.passRate === "variant1") {
      reasons.push(
        `${variant1.variantName} has a higher pass rate (${(variant1.metrics.passRate * 100).toFixed(1)}% vs ${(variant2.metrics.passRate * 100).toFixed(1)}%)`,
      );
    }
    if (winner.latency === "variant1") {
      reasons.push(
        `${variant1.variantName} is faster (${variant1.metrics.averageLatency.toFixed(0)}ms vs ${variant2.metrics.averageLatency.toFixed(0)}ms)`,
      );
    }
    if (winner.cost === "variant1") {
      reasons.push(`${variant1.variantName} is more cost-effective`);
    }
  } else {
    if (winner.passRate === "variant2") {
      reasons.push(
        `${variant2.variantName} has a higher pass rate (${(variant2.metrics.passRate * 100).toFixed(1)}% vs ${(variant1.metrics.passRate * 100).toFixed(1)}%)`,
      );
    }
    if (winner.latency === "variant2") {
      reasons.push(
        `${variant2.variantName} is faster (${variant2.metrics.averageLatency.toFixed(0)}ms vs ${variant1.metrics.averageLatency.toFixed(0)}ms)`,
      );
    }
    if (winner.cost === "variant2") {
      reasons.push(`${variant2.variantName} is more cost-effective`);
    }
  }

  if (reasons.length === 0) {
    return "Performance is very similar between both variants.";
  }

  return reasons.join(", and ");
}
