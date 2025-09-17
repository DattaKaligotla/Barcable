import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Tag, Package, History, Settings } from "lucide-react";
import { PromptStoreBrowser } from "@/src/features/prompts/components/PromptStoreBrowser";
import { PromptStoreLabelManager } from "@/src/features/prompts/components/PromptStoreLabelManager";
import { PromptHistoryViewer } from "@/src/features/prompts/components/PromptHistoryViewer";
import { useState } from "react";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function PromptStorePage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  // Demo state for label manager
  const [demoPromptId] = useState("demo-prompt-id");
  const [demoPromptName, setDemoPromptName] = useState(
    "customer-support-template",
  );
  const [demoCurrentLabels] = useState(["staging", "candidate/experiment-1"]);

  return (
    <Page
      headerProps={{
        title: "Prompt Store",
        help: {
          description:
            "Manage, version, and publish your prompts with labels and workflows",
        },
      }}
    >
      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Browse Store
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Label Manager
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <PromptStoreBrowser />
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demo: Label Manager</CardTitle>
              <CardDescription>
                This demo shows how to manage labels for a prompt. In a real
                implementation, this would be integrated into the prompt detail
                page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 space-y-4">
                <div>
                  <Label htmlFor="demo-prompt-name">Demo Prompt Name</Label>
                  <Input
                    id="demo-prompt-name"
                    value={demoPromptName}
                    onChange={(e) => setDemoPromptName(e.target.value)}
                    placeholder="Enter prompt name for demo"
                  />
                </div>
              </div>

              <PromptStoreLabelManager
                promptId={demoPromptId}
                promptName={demoPromptName}
                currentLabels={demoCurrentLabels}
                onUpdate={() => {
                  console.log(
                    "Labels updated - in real app, this would refresh the prompt data",
                  );
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demo: Prompt History</CardTitle>
              <CardDescription>
                This demo shows version and label history for a prompt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 space-y-4">
                <div>
                  <Label htmlFor="history-prompt-name">
                    Prompt Name for History
                  </Label>
                  <Input
                    id="history-prompt-name"
                    value={demoPromptName}
                    onChange={(e) => setDemoPromptName(e.target.value)}
                    placeholder="Enter prompt name to view history"
                  />
                </div>
              </div>

              <PromptHistoryViewer promptName={demoPromptName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Store Settings</CardTitle>
              <CardDescription>
                Configure global settings for your prompt store.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Label Policies</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Production:</strong> Requires approval and creates
                      audit log
                    </p>
                    <p>
                      <strong>Staging:</strong> Intermediate testing environment
                    </p>
                    <p>
                      <strong>Candidate/*:</strong> Experimental variations
                      (e.g., candidate/experiment-1)
                    </p>
                    <p>
                      <strong>Latest:</strong> Automatically updated to newest
                      version
                    </p>
                    <p>
                      <strong>Deprecated:</strong> Marked for removal
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-semibold">
                    Promotion Workflows
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      • <strong>candidate/* → staging:</strong> Basic validation
                    </p>
                    <p>
                      • <strong>staging → production:</strong> Requires approval
                    </p>
                    <p>
                      • <strong>candidate/* → production:</strong> Direct
                      promotion (with approval)
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-semibold">Access Control</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      • Label creation and updates require{" "}
                      <code>promptStore:write</code> permission
                    </p>
                    <p>
                      • Production publishing requires{" "}
                      <code>promptStore:publish</code> permission
                    </p>
                    <p>• Protected labels can only be modified by admins</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-semibold">
                    Available API Endpoints
                  </h3>
                  <div className="space-y-2 font-mono text-sm">
                    <p>
                      • <code>promptStore.browseStore</code> - Search and filter
                      prompts
                    </p>
                    <p>
                      • <code>promptStore.getPromptByLabel</code> - Get specific
                      labeled version
                    </p>
                    <p>
                      • <code>promptStore.updateLabels</code> - Add/remove
                      labels
                    </p>
                    <p>
                      • <code>promptStore.publishPrompt</code> - Publish with
                      workflow
                    </p>
                    <p>
                      • <code>promptStore.promotePrompt</code> - Promote between
                      labels
                    </p>
                    <p>
                      • <code>promptStore.getPromptHistory</code> - View version
                      history
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
