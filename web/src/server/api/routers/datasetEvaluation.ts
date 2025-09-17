import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { datasetBatchEvaluator } from "@/src/features/datasets/server/batchEvaluator";

export const datasetEvaluationRouter = createTRPCRouter({
  // Run batch evaluation of prompt variants against a dataset
  runBatchEvaluation: protectedProjectProcedure
    .input(
      z.object({
        datasetId: z.string(),
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
        sampleSize: z.number().min(1).optional(),
        // Test criteria inline for now
        testCriteria: z.array(
          z.object({
            id: z.string(),
            type: z.enum([
              "must_contain",
              "must_not_contain",
              "regex_match",
              "token_limit_max",
              "json_schema_valid",
              "similarity_threshold",
              "regex_not_match",
              "token_limit_min",
              "length_max_chars",
              "length_min_chars",
              "starts_with",
              "ends_with",
              "exact_match",
            ]),
            name: z.string(),
            config: z.record(z.string(), z.any()),
            weight: z.number().min(0).max(1).default(1),
            required: z.boolean().default(false),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate that the dataset exists and user has access
        const dataset = await ctx.prisma.dataset.findUnique({
          where: {
            id_projectId: {
              id: input.datasetId,
              projectId: ctx.session.projectId,
            },
          },
        });

        if (!dataset) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dataset not found",
          });
        }

        // Build test suite from input
        const testSuite = {
          id: input.testSuiteId,
          name: "Batch Evaluation",
          description: "Automated batch evaluation of prompt variants",
          datasetId: input.datasetId,
          projectId: ctx.session.projectId,
          criteria: input.testCriteria.map((c) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            description: `Test: ${c.name}`,
            config: c.config as any, // Type assertion for now
            weight: c.weight,
            required: c.required,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Build batch request
        const batchRequest = {
          datasetId: input.datasetId,
          projectId: ctx.session.projectId,
          testSuiteId: input.testSuiteId,
          promptVariants: input.promptVariants,
          sampleSize: input.sampleSize,
        };

        // Run the batch evaluation
        const result = await datasetBatchEvaluator.runBatchEvaluation(
          batchRequest,
          testSuite,
        );

        return result;
      } catch (error) {
        console.error("Batch evaluation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Batch evaluation failed",
        });
      }
    }),

  // Create a new test suite for a dataset
  createTestSuite: protectedProjectProcedure
    .input(
      z.object({
        datasetId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        criteria: z.array(
          z.object({
            id: z.string(),
            type: z.enum([
              "must_contain",
              "must_not_contain",
              "regex_match",
              "token_limit_max",
              "json_schema_valid",
              "similarity_threshold",
              "regex_not_match",
              "token_limit_min",
              "length_max_chars",
              "length_min_chars",
              "starts_with",
              "ends_with",
              "exact_match",
            ]),
            name: z.string(),
            config: z.record(z.string(), z.any()),
            weight: z.number().min(0).max(1).default(1),
            required: z.boolean().default(false),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Validate that the dataset exists and user has access
      const dataset = await ctx.prisma.dataset.findUnique({
        where: {
          id_projectId: {
            id: input.datasetId,
            projectId: ctx.session.projectId,
          },
        },
      });

      if (!dataset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dataset not found",
        });
      }

      // For now, store test suites as JSON in metadata
      // In a production system, you might want a separate table for test suites
      const testSuiteData = {
        id: `ts-${Date.now()}`,
        name: input.name,
        description: input.description,
        criteria: input.criteria,
        createdAt: new Date().toISOString(),
        projectId: ctx.session.projectId,
        datasetId: input.datasetId,
      };

      return testSuiteData;
    }),

  // Get evaluation results history for a dataset
  getEvaluationHistory: protectedProjectProcedure
    .input(
      z.object({
        datasetId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Validate that the dataset exists and user has access
      const dataset = await ctx.prisma.dataset.findUnique({
        where: {
          id_projectId: {
            id: input.datasetId,
            projectId: ctx.session.projectId,
          },
        },
      });

      if (!dataset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Dataset not found",
        });
      }

      // For now, return empty array
      // In production, you'd fetch from a dedicated evaluation results table
      return {
        evaluations: [],
        totalCount: 0,
      };
    }),

  // Get available test criteria types for the UI
  getTestCriteriaTypes: protectedProjectProcedure.query(() => {
    return [
      {
        type: "must_contain",
        name: "Must Contain",
        description: "Output must contain all specified strings",
        configSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "List of strings that must be present",
            },
            caseSensitive: {
              type: "boolean",
              description: "Whether the check is case sensitive",
              default: false,
            },
          },
          required: ["keywords"],
        },
      },
      {
        type: "must_not_contain",
        name: "Must Not Contain",
        description: "Output must not contain any of the specified strings",
        configSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "List of strings that must not be present",
            },
            caseSensitive: {
              type: "boolean",
              description: "Whether the check is case sensitive",
              default: false,
            },
          },
          required: ["keywords"],
        },
      },
      {
        type: "regex_match",
        name: "Regex Match",
        description: "Output must match the specified regular expression",
        configSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Regular expression pattern",
            },
            flags: {
              type: "string",
              description:
                "Regex flags (e.g., 'gi' for global, case-insensitive)",
              default: "",
            },
          },
          required: ["pattern"],
        },
      },
      {
        type: "token_limit_max",
        name: "Max Token Limit",
        description: "Output must not exceed the specified token count",
        configSchema: {
          type: "object",
          properties: {
            maxTokens: {
              type: "number",
              minimum: 1,
              description: "Maximum number of tokens allowed",
            },
          },
          required: ["maxTokens"],
        },
      },
      {
        type: "json_schema_valid",
        name: "Valid JSON Schema",
        description: "Output must be valid JSON matching the specified schema",
        configSchema: {
          type: "object",
          properties: {
            schema: {
              type: "object",
              description: "JSON Schema to validate against",
            },
          },
          required: ["schema"],
        },
      },
      {
        type: "similarity_threshold",
        name: "Similarity Threshold",
        description: "Output must meet minimum similarity to expected output",
        configSchema: {
          type: "object",
          properties: {
            threshold: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Minimum similarity score (0-1)",
            },
            algorithm: {
              type: "string",
              enum: ["cosine", "jaccard", "levenshtein"],
              description: "Similarity algorithm to use",
              default: "cosine",
            },
          },
          required: ["threshold"],
        },
      },
    ];
  }),
});
