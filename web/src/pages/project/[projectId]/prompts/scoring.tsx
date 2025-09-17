import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";

export default function PromptScoringPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  return (
    <Page
      withPadding
      scrollable
      headerProps={{
        title: "Prompt Scoring",
        breadcrumb: [
          {
            name: "Prompts",
            href: `/project/${projectId}/prompts/`,
          },
          {
            name: "Scoring",
          },
        ],
      }}
    >
      <div className="p-4">
        <h2 className="mb-4 text-2xl font-bold">Prompt Scoring Dashboard</h2>
        <p>
          Comprehensive scoring and ranking metrics for your prompt variants
          will be displayed here.
        </p>
      </div>
    </Page>
  );
}
