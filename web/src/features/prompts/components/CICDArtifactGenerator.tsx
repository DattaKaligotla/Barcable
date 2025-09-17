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
  Download,
  FileText,
  Settings,
  Clock,
  GitBranch,
  Package,
  PlayCircle,
  Eye,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/src/utils/api";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { type ProjectScope } from "@/src/features/rbac/constants/projectAccessRights";
import { formatDistanceToNow } from "date-fns";

export const CICDArtifactGenerator: React.FC = () => {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  const [hoursBack, setHoursBack] = useState(24);
  const [format, setFormat] = useState<"yaml" | "json" | "both">("both");
  const [includeScoring, setIncludeScoring] = useState(true);
  const [includeEvaluation, setIncludeEvaluation] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const hasAccess = useHasProjectAccess({
    projectId,
    scope: "prompts:read" as ProjectScope,
  });

  // API queries
  const previewQuery = api.cicdArtifacts.previewArtifacts.useQuery(
    { hoursBack },
    { enabled: !!projectId },
  );

  const deploymentReport = api.cicdArtifacts.getDeploymentReport.useQuery(
    undefined,
    { enabled: !!projectId },
  );

  const configValidation = api.cicdArtifacts.validateConfig.useQuery(
    undefined,
    { enabled: !!projectId },
  );

  // API mutations
  const generateLatestMutation = api.cicdArtifacts.generateLatest.useMutation();
  const exportArtifactsMutation =
    api.cicdArtifacts.exportArtifacts.useMutation();
  const generateArtifactsMutation =
    api.cicdArtifacts.generateArtifacts.useMutation();

  const handleGenerateLatest = () => {
    generateLatestMutation.mutate({ hoursBack });
  };

  const handleExportCustom = () => {
    if (!startDate || !endDate) return;

    exportArtifactsMutation.mutate({
      startDate,
      endDate,
      format,
      includeScoring,
      includeEvaluation,
    });
  };

  const handleGenerateCustom = () => {
    if (startDate && endDate) {
      generateArtifactsMutation.mutate({
        startDate,
        endDate,
        includeScoring,
        includeEvaluation,
      });
    } else {
      generateArtifactsMutation.mutate({
        hoursBack,
        includeScoring,
        includeEvaluation,
      });
    }
  };

  const downloadContent = (
    content: string,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (!hasAccess) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don&apos;t have permission to generate CI/CD artifacts.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            CI/CD Artifact Generator
          </CardTitle>
          <CardDescription>
            Generate deployment artifacts (.barcable/change_list.yaml,
            summary.json) for your prompt engineering workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="quick" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quick">Quick Generate</TabsTrigger>
              <TabsTrigger value="custom">Custom Range</TabsTrigger>
              <TabsTrigger value="deployment">Deployment</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4">
              {/* Preview Section */}
              {previewQuery.data && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Preview (Last {hoursBack} hours)
                    </Label>
                    <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-2xl font-bold">
                          {previewQuery.data.preview.summary.total_changes}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total Changes
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-2xl font-bold">
                          {previewQuery.data.preview.summary.prompts_affected}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Prompts Affected
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-2xl font-bold">
                          {
                            previewQuery.data.preview.deployment_info
                              .production_ready.length
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Production Ready
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-2xl font-bold">
                          {
                            previewQuery.data.preview.deployment_info
                              .requires_review.length
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Needs Review
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />
                </div>
              )}

              {/* Quick Options */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="hours-back">Hours Back</Label>
                  <Select
                    value={hoursBack.toString()}
                    onValueChange={(value) => setHoursBack(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => previewQuery.refetch()}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Preview
                  </Button>
                </div>
              </div>

              {/* Generate Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateLatest}
                  disabled={generateLatestMutation.isPending}
                  className="flex-1"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Generate Latest Artifacts
                </Button>
              </div>

              {/* Results */}
              {generateLatestMutation.data && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {generateLatestMutation.data.message}
                    <div className="mt-2 space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadContent(
                            generateLatestMutation.data!.files.yamlContent,
                            `change_list_${new Date().toISOString().split("T")[0]}.yaml`,
                            "application/yaml",
                          )
                        }
                      >
                        <Download className="mr-1 h-3 w-3" />
                        YAML
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadContent(
                            generateLatestMutation.data!.files.jsonContent,
                            `summary_${new Date().toISOString().split("T")[0]}.json`,
                            "application/json",
                          )
                        }
                      >
                        <Download className="mr-1 h-3 w-3" />
                        JSON
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Export Format</Label>
                  <Select
                    value={format}
                    onValueChange={(value: "yaml" | "json" | "both") =>
                      setFormat(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yaml">YAML only</SelectItem>
                      <SelectItem value="json">JSON only</SelectItem>
                      <SelectItem value="both">Both formats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-scoring"
                        checked={includeScoring}
                        onChange={(e) => setIncludeScoring(e.target.checked)}
                      />
                      <Label htmlFor="include-scoring" className="text-sm">
                        Include scoring data
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-evaluation"
                        checked={includeEvaluation}
                        onChange={(e) => setIncludeEvaluation(e.target.checked)}
                      />
                      <Label htmlFor="include-evaluation" className="text-sm">
                        Include evaluation data
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateCustom}
                  disabled={generateArtifactsMutation.isPending}
                  className="flex-1"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Generate Custom Artifacts
                </Button>
                <Button
                  onClick={handleExportCustom}
                  disabled={
                    !startDate || !endDate || exportArtifactsMutation.isPending
                  }
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Only
                </Button>
              </div>

              {/* Custom Results */}
              {(generateArtifactsMutation.data ||
                exportArtifactsMutation.data) && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Custom artifacts generated successfully!
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="deployment" className="space-y-4">
              {deploymentReport.data && (
                <div className="space-y-4">
                  {/* Production Candidates */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Production Candidates
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {deploymentReport.data.deployment.production_candidates
                        .length > 0 ? (
                        <div className="space-y-2">
                          {deploymentReport.data.deployment.production_candidates.map(
                            (candidate, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between rounded border p-2"
                              >
                                <div>
                                  <span className="font-medium">
                                    {candidate.name}
                                  </span>
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    v{candidate.version}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {candidate.score && (
                                    <Badge variant="outline">
                                      {candidate.score.toFixed(1)}%
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      candidate.ready ? "default" : "secondary"
                                    }
                                  >
                                    {candidate.ready ? "Ready" : "Not Ready"}
                                  </Badge>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          No production candidates found
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Review Required */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Review Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {deploymentReport.data.deployment.review_required.length >
                      0 ? (
                        <div className="space-y-2">
                          {deploymentReport.data.deployment.review_required.map(
                            (item, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between rounded border p-2"
                              >
                                <div>
                                  <span className="font-medium">
                                    {item.name}
                                  </span>
                                  <p className="text-sm text-muted-foreground">
                                    {item.reason}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getUrgencyIcon(item.urgency)}
                                  <Badge variant="outline">
                                    {item.urgency}
                                  </Badge>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          No items require review
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              {configValidation.data && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {configValidation.data.isValid ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        Configuration Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(configValidation.data.validation).map(
                          ([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              {value ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span
                                className={
                                  value ? "text-green-700" : "text-red-700"
                                }
                              >
                                {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                              </span>
                            </div>
                          ),
                        )}
                      </div>

                      {configValidation.data.recommendations.length > 0 && (
                        <div className="mt-4">
                          <Label className="text-sm font-medium">
                            Recommendations:
                          </Label>
                          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                            {configValidation.data.recommendations.map(
                              (rec, index) => (
                                <li key={index}>{rec}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertDescription>
                      <strong>CI/CD Integration Guide:</strong>
                      <br />
                      1. Use the generated YAML for automated deployment
                      pipelines
                      <br />
                      2. Include the JSON summary in PR descriptions
                      <br />
                      3. Set up webhooks to trigger artifact generation on
                      prompt changes
                      <br />
                      4. Configure approval workflows for production deployments
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
