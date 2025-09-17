import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import { PromptVariantGenerator } from "@/src/components/prompt-variants/PromptVariantGenerator";

export default function PromptVariantsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) {
    return <div>Loading...</div>;
  }

  return (
    <Page
      headerProps={{
        title: "Prompt Variants",
        help: {
          description:
            "Generate and test different variations of your prompts to optimize performance using rule-based transformations.",
          href: "https://docs.langfuse.com/prompt-engineering",
        },
      }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Prompt Variant Generator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create optimized variations of your prompts using rule-based
            transformations. Test different approaches to improve performance
            and find the best version for your use case.
          </p>
        </div>

        <PromptVariantGenerator
          projectId={projectId}
          onVariantSelect={(variant) => {
            // Could integrate with prompt creation workflow
            console.log("Selected variant:", variant);
          }}
        />
      </div>
    </Page>
  );
}
