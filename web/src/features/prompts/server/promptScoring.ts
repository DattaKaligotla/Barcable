import { z } from "zod/v4";

// Scoring metrics for prompt evaluation
export const PromptScoreMetrics = z.object({
  // Test performance metrics
  passRate: z.number().min(0).max(1), // 0-1 (percentage of tests passed)
  averageScore: z.number().min(0).max(1), // 0-1 (weighted average of individual test scores)

  // Performance metrics
  averageLatency: z.number().min(0), // milliseconds
  medianLatency: z.number().min(0).optional(),
  p95Latency: z.number().min(0).optional(),

  // Cost metrics (estimated)
  estimatedCostPerRun: z.number().min(0).optional(), // USD
  totalTokensUsed: z.number().min(0).optional(),

  // Quality metrics
  consistencyScore: z.number().min(0).max(1).optional(), // 0-1 (how consistent are outputs)

  // Reliability metrics
  successRate: z.number().min(0).max(1), // 0-1 (percentage of successful LLM calls)
  errorRate: z.number().min(0).max(1), // 0-1 (percentage of failed calls)
});

export type PromptScoreMetrics = z.infer<typeof PromptScoreMetrics>;

export const PromptRanking = z.object({
  variantId: z.string(),
  variantName: z.string(),
  rank: z.number().min(1), // 1-based ranking
  score: z.number().min(0).max(100), // 0-100 composite score
  metrics: PromptScoreMetrics,
  tags: z.array(z.string()).optional(), // e.g., ["fast", "accurate", "cost-effective"]
  recommendation: z.enum(["production", "candidate", "discard"]).optional(),
});

export type PromptRanking = z.infer<typeof PromptRanking>;

export const ScoringWeights = z.object({
  passRate: z.number().min(0).max(1).default(0.4), // 40% weight for correctness
  averageScore: z.number().min(0).max(1).default(0.3), // 30% weight for quality
  latency: z.number().min(0).max(1).default(0.2), // 20% weight for speed (inverse)
  cost: z.number().min(0).max(1).default(0.1), // 10% weight for cost (inverse)
});

export type ScoringWeights = z.infer<typeof ScoringWeights>;

export const ComparisonRequest = z.object({
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
  weights: ScoringWeights.optional(),
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
});

export type ComparisonRequest = z.infer<typeof ComparisonRequest>;

export class PromptScoringService {
  // Token costs per 1K tokens (approximate pricing)
  private static TOKEN_COSTS = {
    "gpt-4": { input: 0.03, output: 0.06 },
    "gpt-4-turbo": { input: 0.01, output: 0.03 },
    "gpt-3.5-turbo": { input: 0.0015, output: 0.002 },
    "claude-3-opus": { input: 0.015, output: 0.075 },
    "claude-3-sonnet": { input: 0.003, output: 0.015 },
    "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  } as const;

  static calculateMetrics(
    variantResults: ComparisonRequest["evaluationResults"][0],
    modelConfig?: {
      variantId: string;
      provider: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): PromptScoreMetrics {
    const { evaluations, summary } = variantResults;

    // Basic test metrics
    const passRate = summary.passRate;
    const averageScore = summary.averageScore;

    // Latency metrics
    const latencies = evaluations
      .map((e) => e.latencyMs)
      .filter((l): l is number => l !== undefined)
      .sort((a, b) => a - b);

    const averageLatency = summary.averageLatency || 0;
    const medianLatency =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length / 2)]
        : undefined;
    const p95Latency =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length * 0.95)]
        : undefined;

    // Success/error rates
    const successfulEvaluations = evaluations.filter(
      (e) => e.latencyMs !== undefined,
    );
    const successRate =
      evaluations.length > 0
        ? successfulEvaluations.length / evaluations.length
        : 0;
    const errorRate = 1 - successRate;

    // Cost estimation (if model config available)
    let estimatedCostPerRun: number | undefined;
    let totalTokensUsed: number | undefined;

    if (modelConfig && modelConfig.model in this.TOKEN_COSTS) {
      const costs =
        this.TOKEN_COSTS[modelConfig.model as keyof typeof this.TOKEN_COSTS];

      // Rough estimation: input tokens ≈ prompt length/4, output tokens ≈ average response length/4
      const avgPromptTokens = 100; // Placeholder - would need actual token counting
      const avgResponseTokens = modelConfig.maxTokens || 1000;

      totalTokensUsed =
        (avgPromptTokens + avgResponseTokens) * evaluations.length;
      estimatedCostPerRun =
        (avgPromptTokens * costs.input) / 1000 +
        (avgResponseTokens * costs.output) / 1000;
    }

    // Consistency score (variance of scores)
    const scores = evaluations.map((e) => e.overallScore);
    const variance =
      scores.length > 1
        ? scores.reduce(
            (sum, score) => sum + Math.pow(score - averageScore, 2),
            0,
          ) /
          (scores.length - 1)
        : 0;
    const consistencyScore = Math.max(0, 1 - Math.sqrt(variance)); // Higher consistency = lower variance

    return {
      passRate,
      averageScore,
      averageLatency,
      medianLatency,
      p95Latency,
      estimatedCostPerRun,
      totalTokensUsed,
      consistencyScore,
      successRate,
      errorRate,
    };
  }

  static calculateCompositeScore(
    metrics: PromptScoreMetrics,
    weights: ScoringWeights = {
      passRate: 0.4,
      averageScore: 0.3,
      latency: 0.2,
      cost: 0.1,
    },
  ): number {
    // Normalize latency (lower is better) - normalize to 0-1 scale
    const maxReasonableLatency = 10000; // 10 seconds
    const normalizedLatency = Math.max(
      0,
      1 - metrics.averageLatency / maxReasonableLatency,
    );

    // Normalize cost (lower is better) - normalize to 0-1 scale
    const maxReasonableCost = 1.0; // $1 per run
    const normalizedCost = metrics.estimatedCostPerRun
      ? Math.max(0, 1 - metrics.estimatedCostPerRun / maxReasonableCost)
      : 1; // If no cost data, assume best case

    // Calculate weighted composite score
    const compositeScore =
      metrics.passRate * weights.passRate +
      metrics.averageScore * weights.averageScore +
      normalizedLatency * weights.latency +
      normalizedCost * weights.cost;

    // Account for reliability (success rate affects everything)
    const reliabilityAdjustedScore = compositeScore * metrics.successRate;

    // Convert to 0-100 scale
    return Math.round(reliabilityAdjustedScore * 100);
  }

  static generateTags(metrics: PromptScoreMetrics): string[] {
    const tags: string[] = [];

    // Performance tags
    if (metrics.passRate >= 0.9) tags.push("highly-accurate");
    else if (metrics.passRate >= 0.8) tags.push("accurate");
    else if (metrics.passRate < 0.6) tags.push("needs-improvement");

    // Speed tags
    if (metrics.averageLatency < 1000) tags.push("fast");
    else if (metrics.averageLatency < 3000) tags.push("moderate-speed");
    else tags.push("slow");

    // Cost tags
    if (metrics.estimatedCostPerRun) {
      if (metrics.estimatedCostPerRun < 0.01) tags.push("cost-effective");
      else if (metrics.estimatedCostPerRun > 0.1) tags.push("expensive");
    }

    // Reliability tags
    if (metrics.successRate >= 0.99) tags.push("reliable");
    else if (metrics.successRate < 0.9) tags.push("unreliable");

    // Consistency tags
    if (metrics.consistencyScore && metrics.consistencyScore >= 0.9) {
      tags.push("consistent");
    } else if (metrics.consistencyScore && metrics.consistencyScore < 0.7) {
      tags.push("inconsistent");
    }

    return tags;
  }

  static generateRecommendation(
    metrics: PromptScoreMetrics,
    score: number,
  ): "production" | "candidate" | "discard" {
    // Production criteria: high pass rate, good reliability, reasonable performance
    if (
      metrics.passRate >= 0.85 &&
      metrics.successRate >= 0.95 &&
      score >= 75
    ) {
      return "production";
    }

    // Discard criteria: poor performance across the board
    if (metrics.passRate < 0.6 || metrics.successRate < 0.8 || score < 40) {
      return "discard";
    }

    // Everything else is a candidate for improvement
    return "candidate";
  }

  static rankPrompts(request: ComparisonRequest): PromptRanking[] {
    const weights = request.weights || {
      passRate: 0.4,
      averageScore: 0.3,
      latency: 0.2,
      cost: 0.1,
    };

    // Calculate metrics and scores for each variant
    const rankings = request.evaluationResults.map((result) => {
      const modelConfig = request.modelConfigs?.find(
        (config) => config.variantId === result.variantId,
      );

      const metrics = this.calculateMetrics(result, modelConfig);
      const score = this.calculateCompositeScore(metrics, weights);
      const tags = this.generateTags(metrics);
      const recommendation = this.generateRecommendation(metrics, score);

      return {
        variantId: result.variantId,
        variantName: result.variantName,
        score,
        metrics,
        tags,
        recommendation,
      };
    });

    // Sort by score (highest first) and assign ranks
    rankings.sort((a, b) => b.score - a.score);

    return rankings.map((ranking, index) => ({
      ...ranking,
      rank: index + 1,
    }));
  }
}

export const promptScoringService = new PromptScoringService();
