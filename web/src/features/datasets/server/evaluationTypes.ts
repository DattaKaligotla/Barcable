import { z } from "zod/v4";

// Deterministic test types for golden dataset evaluation
export const EvaluationCriteriaType = z.enum([
  "must_contain",
  "must_not_contain",
  "regex_match",
  "regex_not_match",
  "token_limit_max",
  "token_limit_min",
  "length_max_chars",
  "length_min_chars",
  "json_schema_valid",
  "starts_with",
  "ends_with",
  "exact_match",
  "similarity_threshold",
]);

export type EvaluationCriteriaType = z.infer<typeof EvaluationCriteriaType>;

export const EvaluationCriteria = z.object({
  id: z.string(),
  type: EvaluationCriteriaType,
  name: z.string(),
  description: z.string().optional(),
  config: z.object({
    // For text-based criteria
    text: z.string().optional(),
    texts: z.array(z.string()).optional(),

    // For regex
    pattern: z.string().optional(),
    flags: z.string().optional(),

    // For numeric limits
    value: z.number().optional(),

    // For JSON schema validation
    schema: z.record(z.string(), z.any()).optional(),

    // For similarity
    threshold: z.number().min(0).max(1).optional(),
    referenceText: z.string().optional(),

    // Case sensitivity
    caseSensitive: z.boolean().default(true),
  }),
  weight: z.number().min(0).max(1).default(1), // For weighted scoring
  required: z.boolean().default(true), // If false, failure doesn't fail entire test
});

export type EvaluationCriteria = z.infer<typeof EvaluationCriteria>;

export const DatasetTestSuite = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  datasetId: z.string(),
  projectId: z.string(),
  criteria: z.array(EvaluationCriteria),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DatasetTestSuite = z.infer<typeof DatasetTestSuite>;

export const EvaluationResult = z.object({
  criteriaId: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1), // 0-1 score
  message: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

export type EvaluationResult = z.infer<typeof EvaluationResult>;

export const DatasetItemEvaluation = z.object({
  datasetItemId: z.string(),
  input: z.any(),
  actualOutput: z.any(),
  expectedOutput: z.any().optional(),
  results: z.array(EvaluationResult),
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  executedAt: z.string(),
  latencyMs: z.number().optional(),
});

export type DatasetItemEvaluation = z.infer<typeof DatasetItemEvaluation>;

export const BatchEvaluationRequest = z.object({
  datasetId: z.string(),
  projectId: z.string(),
  testSuiteId: z.string(),
  promptVariants: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      content: z.string(),
      modelConfig: z
        .object({
          provider: z.string(),
          model: z.string(),
          temperature: z.number().optional(),
          maxTokens: z.number().optional(),
        })
        .optional(),
    }),
  ),
  sampleSize: z.number().min(1).optional(), // If provided, randomly sample items
});

export type BatchEvaluationRequest = z.infer<typeof BatchEvaluationRequest>;

export const BatchEvaluationResult = z.object({
  batchId: z.string(),
  datasetId: z.string(),
  testSuiteId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(["running", "completed", "failed"]),
  variantResults: z.array(
    z.object({
      variantId: z.string(),
      variantName: z.string(),
      evaluations: z.array(DatasetItemEvaluation),
      summary: z.object({
        totalItems: z.number(),
        passedItems: z.number(),
        failedItems: z.number(),
        averageScore: z.number(),
        averageLatency: z.number().optional(),
        passRate: z.number().min(0).max(1),
      }),
    }),
  ),
});

export type BatchEvaluationResult = z.infer<typeof BatchEvaluationResult>;

// Helper function to count tokens (simple approximation)
export function countTokens(text: string): number {
  // Simple approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

// Helper function for text similarity (basic implementation)
export function calculateSimilarity(text1: string, text2: string): number {
  // Very basic Jaccard similarity using word sets
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersectionArray = words1.filter((x) => set2.has(x));
  const unionArray = [...words1, ...words2.filter((x) => !set1.has(x))];

  return unionArray.length === 0
    ? 0
    : intersectionArray.length / unionArray.length;
}
