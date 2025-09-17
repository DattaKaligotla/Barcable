import { z } from "zod/v4";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import {
  promptVariantGenerator,
  GenerateVariantsRequest,
} from "../promptVariantGenerator";

export const promptVariantsRouter = createTRPCRouter({
  generateVariants: protectedProjectProcedure
    .input(
      GenerateVariantsRequest.extend({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "prompts:CUD",
      });

      const { projectId, ...variantRequest } = input;
      // projectId is used for access control above
      void projectId;
      const variants =
        await promptVariantGenerator.generateVariants(variantRequest);

      return {
        variants,
        basePromptHash: variants[0]?.metadata.basePromptHash || "",
        generatedAt: new Date().toISOString(),
      };
    }),
});
