import { z } from "zod";
import { logger } from "@langfuse/shared/src/server";

export const PromptMetricsSchema = z.object({
  promptId: z.string(),
  passRate: z.number().min(0).max(1),
  avgResponseTime: z.number().min(0),
  tokenEfficiency: z.number().min(0),
  costPerRequest: z.number().min(0),
  userSatisfaction: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
});

export const ScoringWeightsSchema = z.object({
  performance: z.number().min(0).max(1).default(0.3),
  quality: z.number().min(0).max(1).default(0.4),
  cost: z.number().min(0).max(1).default(0.3),
});

export const PromptScoreSchema = z.object({
  promptId: z.string(),
  compositeScore: z.number().min(0).max(1),
  performanceScore: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1),
  costScore: z.number().min(0).max(1),
  rank: z.number().min(1),
  recommendation: z.string(),
  tags: z.array(z.string()),
  calculatedAt: z.date(),
});

export type PromptMetrics = z.infer<typeof PromptMetricsSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type PromptScore = z.infer<typeof PromptScoreSchema>;

export interface PromptRankingInput {
  prompts: string[];
  weights?: ScoringWeights;
  projectId: string;
}

/**
 * Simple prompt scoring and ranking service
 */
export class PromptScoringService {
  /**
   * Calculate comprehensive scores for prompts
   */
  async scorePrompts(
    promptIds: string[],
    weights: Partial<ScoringWeights> = {},
  ): Promise<PromptScore[]> {
    const defaultWeights: ScoringWeights = {
      performance: weights.performance ?? 0.3,
      quality: weights.quality ?? 0.4,
      cost: weights.cost ?? 0.3,
    };

    const scores: PromptScore[] = [];

    try {
      for (const promptId of promptIds) {
        const metrics = await this.getPromptMetrics(promptId);
        const score = this.calculateScore(promptId, metrics, defaultWeights);
        scores.push(score);
      }

      // Rank the prompts
      const rankedScores = this.rankPrompts(scores);

      logger.info(`Scored ${rankedScores.length} prompts`);
      return rankedScores;
    } catch (error) {
      logger.error("Error scoring prompts:", error);
      throw new Error(
        `Prompt scoring failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get detailed metrics for a specific prompt
   */
  private async getPromptMetrics(promptId: string): Promise<PromptMetrics> {
    // In a real implementation, this would query the database for actual metrics
    // For now, return mock data
    return {
      promptId,
      passRate: Math.random() * 0.4 + 0.6, // 0.6-1.0
      avgResponseTime: Math.random() * 2000 + 500, // 500-2500ms
      tokenEfficiency: Math.random() * 0.5 + 0.5, // 0.5-1.0
      costPerRequest: Math.random() * 0.05, // 0-0.05
      userSatisfaction: Math.random() * 0.3 + 0.7, // 0.7-1.0
      accuracy: Math.random() * 0.2 + 0.8, // 0.8-1.0
    };
  }

  /**
   * Calculate composite score for a prompt
   */
  private calculateScore(
    promptId: string,
    metrics: PromptMetrics,
    weights: ScoringWeights,
  ): PromptScore {
    // Calculate component scores
    const performanceScore = this.calculatePerformanceScore(metrics);
    const qualityScore = this.calculateQualityScore(metrics);
    const costScore = this.calculateCostScore(metrics);

    // Calculate weighted composite score
    const compositeScore =
      performanceScore * weights.performance +
      qualityScore * weights.quality +
      costScore * weights.cost;

    // Generate recommendation and tags
    const recommendation = this.generateRecommendation(compositeScore, metrics);
    const tags = this.generateTags(metrics);

    return {
      promptId,
      compositeScore: Math.round(compositeScore * 100) / 100,
      performanceScore: Math.round(performanceScore * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
      costScore: Math.round(costScore * 100) / 100,
      rank: 1, // Will be set during ranking
      recommendation,
      tags,
      calculatedAt: new Date(),
    };
  }

  private calculatePerformanceScore(metrics: PromptMetrics): number {
    // Combine pass rate and response time
    const passRateScore = metrics.passRate;
    const responseTimeScore = Math.max(0, 1 - metrics.avgResponseTime / 5000); // Normalize to 5s max
    return passRateScore * 0.7 + responseTimeScore * 0.3;
  }

  private calculateQualityScore(metrics: PromptMetrics): number {
    // Combine accuracy and user satisfaction
    return metrics.accuracy * 0.6 + metrics.userSatisfaction * 0.4;
  }

  private calculateCostScore(metrics: PromptMetrics): number {
    // Lower cost = higher score, normalize to reasonable cost range
    const maxCost = 0.1; // $0.10 max
    return Math.max(0, 1 - metrics.costPerRequest / maxCost);
  }

  private generateRecommendation(
    compositeScore: number,
    _metrics: PromptMetrics,
  ): string {
    if (compositeScore >= 0.9) {
      return "Excellent performance - ready for production";
    } else if (compositeScore >= 0.8) {
      return "Good performance - consider for production";
    } else if (compositeScore >= 0.7) {
      return "Decent performance - needs optimization";
    } else if (compositeScore >= 0.6) {
      return "Below average - requires significant improvement";
    } else {
      return "Poor performance - not recommended for production";
    }
  }

  private generateTags(metrics: PromptMetrics): string[] {
    const tags: string[] = [];

    if (metrics.passRate >= 0.9) tags.push("high-accuracy");
    if (metrics.avgResponseTime <= 1000) tags.push("fast-response");
    if (metrics.costPerRequest <= 0.01) tags.push("cost-effective");
    if (metrics.userSatisfaction >= 0.9) tags.push("user-favorite");
    if (metrics.tokenEfficiency >= 0.8) tags.push("efficient");

    return tags;
  }

  /**
   * Rank prompts by composite score
   */
  private rankPrompts(scores: PromptScore[]): PromptScore[] {
    const sorted = scores.sort((a, b) => b.compositeScore - a.compositeScore);

    return sorted.map((score, index) => ({
      ...score,
      rank: index + 1,
    }));
  }

  /**
   * Generate comparison report between prompts
   */
  async generateComparisonReport(promptIds: string[]): Promise<{
    scores: PromptScore[];
    champion: PromptScore;
    insights: string[];
  }> {
    const scores = await this.scorePrompts(promptIds);
    const champion = scores[0]; // Highest ranked

    const insights: string[] = [];

    if (scores.length > 1) {
      const scoreDiff = champion.compositeScore - scores[1].compositeScore;
      if (scoreDiff > 0.1) {
        insights.push(
          `Clear winner: ${champion.promptId} outperforms by ${(scoreDiff * 100).toFixed(1)}%`,
        );
      } else {
        insights.push("Close competition - consider A/B testing");
      }
    }

    // Performance insights
    const avgPerformance =
      scores.reduce((sum, s) => sum + s.performanceScore, 0) / scores.length;
    if (avgPerformance < 0.7) {
      insights.push("Overall performance below target - review prompt design");
    }

    // Cost insights
    const avgCostScore =
      scores.reduce((sum, s) => sum + s.costScore, 0) / scores.length;
    if (avgCostScore < 0.8) {
      insights.push("Cost optimization needed - consider shorter prompts");
    }

    return {
      scores,
      champion,
      insights,
    };
  }
}

export const promptScoringService = new PromptScoringService();
