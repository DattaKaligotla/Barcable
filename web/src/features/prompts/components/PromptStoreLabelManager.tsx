import React, { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
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
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Separator } from "@/src/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  ArrowUp,
  Tag,
  Clock,
  GitBranch,
  Rocket,
  Eye,
} from "lucide-react";
import { api } from "@/src/utils/api";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { type ProjectScope } from "@/src/features/rbac/constants/projectAccessRights";

interface PromptStoreLabelManagerProps {
  promptId: string;
  promptName: string;
  currentLabels: string[];
  onUpdate?: () => void;
}

export const PromptStoreLabelManager: React.FC<
  PromptStoreLabelManagerProps
> = ({ promptId, promptName: _promptName, currentLabels, onUpdate }) => {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  const [newLabels, setNewLabels] = useState<string[]>(currentLabels);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [publishToProduction, setPublishToProduction] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  const hasAccess = useHasProjectAccess({
    projectId,
    scope: "promptStore:write" as ProjectScope,
  });

  // API queries
  const labelsOverview = api.promptStore.getLabelsOverview.useQuery(undefined, {
    enabled: !!projectId,
  });

  const validateLabels = api.promptStore.validateLabels.useQuery(
    { labels: newLabels },
    { enabled: newLabels.length > 0 },
  );

  // API mutations
  const updateLabelsMutation = api.promptStore.updateLabels.useMutation({
    onSuccess: () => {
      onUpdate?.();
      setCommitMessage("");
    },
  });

  const publishMutation = api.promptStore.publishPrompt.useMutation({
    onSuccess: () => {
      onUpdate?.();
      setCommitMessage("");
    },
  });

  const promoteMutation = api.promptStore.promotePrompt.useMutation({
    onSuccess: () => {
      onUpdate?.();
      setCommitMessage("");
    },
  });

  const addLabel = () => {
    if (newLabelInput && !newLabels.includes(newLabelInput)) {
      setNewLabels([...newLabels, newLabelInput]);
      setNewLabelInput("");
    }
  };

  const removeLabel = (label: string) => {
    setNewLabels(newLabels.filter((l) => l !== label));
  };

  const handleUpdate = () => {
    if (!commitMessage) return;

    updateLabelsMutation.mutate({
      promptId,
      labels: newLabels,
      commitMessage,
      publishToProduction,
    });
  };

  const handleQuickPublish = (targetLabel: string) => {
    if (!commitMessage) return;

    publishMutation.mutate({
      sourcePromptId: promptId,
      targetLabel,
      commitMessage,
      createNewVersion: false,
      requiresApproval: targetLabel === "production",
      approvedBy: undefined, // Will be set automatically by the system
    });
  };

  const handlePromotion = (fromLabel: string, toLabel: string) => {
    if (!commitMessage) return;

    promoteMutation.mutate({
      promptId,
      fromLabel,
      toLabel,
      commitMessage,
      createNewVersion: false,
    });
  };

  const getLabelVariant = (label: string) => {
    if (label === "production") return "default";
    if (label === "staging") return "secondary";
    if (label.startsWith("candidate/")) return "outline";
    if (label === "deprecated") return "destructive";
    return "secondary";
  };

  const getLabelIcon = (label: string) => {
    if (label === "production") return <Rocket className="h-3 w-3" />;
    if (label === "staging") return <GitBranch className="h-3 w-3" />;
    if (label.startsWith("candidate/")) return <Eye className="h-3 w-3" />;
    if (label === "latest") return <Clock className="h-3 w-3" />;
    return <Tag className="h-3 w-3" />;
  };

  if (!hasAccess) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don&apos;t have permission to manage prompt store labels.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Prompt Store Label Manager
        </CardTitle>
        <CardDescription>
          Manage labels and publish prompts to the store. Use labels to organize
          and version your prompts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="labels" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="labels">Labels</TabsTrigger>
            <TabsTrigger value="publish">Quick Publish</TabsTrigger>
            <TabsTrigger value="promote">Promote</TabsTrigger>
          </TabsList>

          <TabsContent value="labels" className="space-y-4">
            {/* Current Labels */}
            <div>
              <Label className="text-sm font-medium">Current Labels</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentLabels.length > 0 ? (
                  currentLabels.map((label) => (
                    <Badge
                      key={label}
                      variant={getLabelVariant(label)}
                      className="flex items-center gap-1"
                    >
                      {getLabelIcon(label)}
                      {label}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No labels assigned
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Add Labels */}
            <div>
              <Label className="text-sm font-medium">Add Labels</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Enter label (e.g., candidate/experiment-1)"
                  value={newLabelInput}
                  onChange={(e) => setNewLabelInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addLabel()}
                />
                <Button onClick={addLabel} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick Label Suggestions */}
            <div>
              <Label className="text-sm font-medium">Quick Labels</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "staging",
                  "latest",
                  "candidate/test",
                  "experimental/new",
                ].map((label) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!newLabels.includes(label)) {
                        setNewLabels([...newLabels, label]);
                      }
                    }}
                    disabled={newLabels.includes(label)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* New Labels Preview */}
            {newLabels.length > 0 && (
              <div>
                <Label className="text-sm font-medium">New Labels</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newLabels.map((label) => (
                    <Badge
                      key={label}
                      variant={getLabelVariant(label)}
                      className="flex items-center gap-1"
                    >
                      {getLabelIcon(label)}
                      {label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-4 w-4 p-0"
                        onClick={() => removeLabel(label)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Validation */}
            {validateLabels.data && !validateLabels.data.valid && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Invalid labels: {validateLabels.data.errors.join(", ")}
                </AlertDescription>
              </Alert>
            )}

            {validateLabels.data?.valid && newLabels.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>All labels are valid</AlertDescription>
              </Alert>
            )}

            {/* Commit Message */}
            <div>
              <Label htmlFor="commit-message">Commit Message</Label>
              <Input
                id="commit-message"
                placeholder="Describe your changes..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="publish-production"
                  checked={publishToProduction}
                  onChange={(e) => setPublishToProduction(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="publish-production" className="text-sm">
                  Also publish to production
                </Label>
              </div>
              <Button
                onClick={handleUpdate}
                disabled={
                  !commitMessage ||
                  newLabels.length === 0 ||
                  updateLabelsMutation.isPending ||
                  (validateLabels.data && !validateLabels.data.valid)
                }
              >
                Update Labels
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="publish" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Label</Label>
                <Select value={selectedLabel} onValueChange={setSelectedLabel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select label" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">staging</SelectItem>
                    <SelectItem value="production">production</SelectItem>
                    <SelectItem value="latest">latest</SelectItem>
                    <SelectItem value="candidate/test">
                      candidate/test
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="publish-commit">Commit Message</Label>
                <Input
                  id="publish-commit"
                  placeholder="Publishing changes..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => handleQuickPublish(selectedLabel)}
              disabled={
                !selectedLabel || !commitMessage || publishMutation.isPending
              }
              className="w-full"
            >
              <Rocket className="mr-2 h-4 w-4" />
              Publish to {selectedLabel}
            </Button>
          </TabsContent>

          <TabsContent value="promote" className="space-y-4">
            <div className="space-y-4">
              {currentLabels
                .filter((label) => label !== "production")
                .map((label) => (
                  <Card key={label}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={getLabelVariant(label)}>
                            {getLabelIcon(label)}
                            {label}
                          </Badge>
                          <ArrowUp className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="default">
                            <Rocket className="h-3 w-3" />
                            production
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePromotion(label, "production")}
                          disabled={!commitMessage || promoteMutation.isPending}
                        >
                          Promote
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              {currentLabels.filter((label) => label !== "production")
                .length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No labels available for promotion
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="promote-commit">Commit Message</Label>
              <Input
                id="promote-commit"
                placeholder="Promoting to production..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Overview */}
        {labelsOverview.data && (
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">
              Project Label Overview
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(labelsOverview.data.labelCounts).map(
                ([label, count]) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    {getLabelIcon(label)}
                    {label} ({count})
                  </Badge>
                ),
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
