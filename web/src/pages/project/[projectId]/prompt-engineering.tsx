import { useState } from "react";
import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { PromptVariantGenerator } from "@/src/components/prompt-variants/PromptVariantGenerator";
import { PromptScoringDashboard } from "@/src/components/prompt-variants/PromptScoringDashboard";
import { PromptStoreManager } from "@/src/components/prompt-variants/PromptStoreManager";
import { CICDArtifactsGenerator } from "@/src/components/prompt-variants/CICDArtifactsGenerator";
import { Badge } from "@/src/components/ui/badge";
import { Wand2, BarChart3, Store, GitBranch } from "lucide-react";

export default function PromptEngineeringWorkflow() {
  const router = useRouter();
  const projectId = router.query.projectId as string;
  const [activeTab, setActiveTab] = useState("generate");

  if (!projectId) {
    return <div>Loading...</div>;
  }

  return (
    <Page
      headerProps={{
        title: "Prompt Engineering Workflow",
        help: {
          description:
            "Complete 5-phase workflow for prompt engineering: generate variants, evaluate performance, score and rank, manage in store, and deploy with CI/CD artifacts.",
          href: "https://docs.langfuse.com/prompt-engineering",
        },
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold tracking-tight">
            Prompt Engineering Workflow
          </h1>
          <p className="text-muted-foreground">
            Comprehensive toolkit for optimizing, testing, and deploying AI
            prompts through a structured 5-phase approach.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">Generate</span>
              <Badge variant="secondary" className="ml-1">
                1
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="score" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Score</span>
              <Badge variant="secondary" className="ml-1">
                2
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="store" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Store</span>
              <Badge variant="secondary" className="ml-1">
                3
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deploy" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Deploy</span>
              <Badge variant="secondary" className="ml-1">
                4
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold text-blue-900">
                Phase 1: Variant Generation
              </h3>
              <p className="text-sm text-blue-800">
                Transform your base prompt using rule-based techniques to create
                optimized variations. Experiment with different tones,
                structures, and lengths to find what works best.
              </p>
            </div>
            <PromptVariantGenerator
              projectId={projectId}
              onVariantSelect={(variant) => {
                console.log("Variant selected for next phase:", variant);
                // Could automatically move to scoring phase
              }}
            />
          </TabsContent>

          <TabsContent value="score" className="space-y-6">
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <h3 className="mb-2 font-semibold text-green-900">
                Phase 2: Performance Scoring
              </h3>
              <p className="text-sm text-green-800">
                Compare multiple prompt variants against test cases to measure
                performance. Get detailed metrics on accuracy, latency, cost,
                and overall effectiveness.
              </p>
            </div>
            <PromptScoringDashboard projectId={projectId} />
          </TabsContent>

          <TabsContent value="store" className="space-y-6">
            <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h3 className="mb-2 font-semibold text-purple-900">
                Phase 3: Prompt Store Management
              </h3>
              <p className="text-sm text-purple-800">
                Organize and manage your best-performing prompts in a
                centralized store. Add labels, ratings, and metadata for easy
                discovery and reuse across projects.
              </p>
            </div>
            <PromptStoreManager projectId={projectId} />
          </TabsContent>

          <TabsContent value="deploy" className="space-y-6">
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <h3 className="mb-2 font-semibold text-orange-900">
                Phase 4: CI/CD Integration
              </h3>
              <p className="text-sm text-orange-800">
                Generate deployment artifacts and configuration files for your
                prompt workflows. Create Docker configs, environment variables,
                and CI/CD pipelines for automated deployment.
              </p>
            </div>
            <CICDArtifactsGenerator projectId={projectId} />
          </TabsContent>
        </Tabs>

        {/* Progress Summary */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div
            className={`rounded-lg border p-4 ${activeTab === "generate" ? "border-blue-200 bg-blue-50" : "bg-gray-50"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              <span className="font-medium">Generate</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create optimized prompt variations using transformation rules
            </p>
          </div>

          <div
            className={`rounded-lg border p-4 ${activeTab === "score" ? "border-green-200 bg-green-50" : "bg-gray-50"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span className="font-medium">Score</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Test and compare prompts against golden datasets
            </p>
          </div>

          <div
            className={`rounded-lg border p-4 ${activeTab === "store" ? "border-purple-200 bg-purple-50" : "bg-gray-50"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <Store className="h-5 w-5" />
              <span className="font-medium">Store</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage and organize high-performing prompts
            </p>
          </div>

          <div
            className={`rounded-lg border p-4 ${activeTab === "deploy" ? "border-orange-200 bg-orange-50" : "bg-gray-50"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              <span className="font-medium">Deploy</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Generate CI/CD artifacts for automated deployment
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
