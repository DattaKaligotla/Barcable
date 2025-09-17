import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import { Progress } from "@/src/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { api } from "@/src/utils/api";
import { Loader2, Play, Plus, Trash2, CheckCircle } from "lucide-react";

interface EvaluationCriterion {
  id: string;
  type:
    | "starts_with"
    | "ends_with"
    | "must_contain"
    | "must_not_contain"
    | "regex_match"
    | "token_limit_max"
    | "json_schema_valid"
    | "similarity_threshold"
    | "regex_not_match"
    | "token_limit_min"
    | "length_max_chars"
    | "length_min_chars"
    | "exact_match";
  name: string;
  config: Record<string, any>;
  weight?: number;
  required?: boolean;
}

interface PromptVariant {
  id: string;
  name: string;
  content: string;
  modelConfig?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
}

interface DatasetEvaluatorProps {
  datasetId: string;
  datasetName: string;
  onClose?: () => void;
}

export function DatasetEvaluator({
  datasetId,
  datasetName,
  onClose,
}: DatasetEvaluatorProps) {
  const [activeTab, setActiveTab] = useState("variants");
  const [variants, setVariants] = useState<PromptVariant[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [sampleSize, setSampleSize] = useState(10);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const criteriaTypes = api.datasetEvaluation.getTestCriteriaTypes.useQuery();
  const runEvaluation = api.datasetEvaluation.runBatchEvaluation.useMutation();

  const addVariant = () => {
    const newVariant: PromptVariant = {
      id: `variant-${Date.now()}`,
      name: `Variant ${variants.length + 1}`,
      content: "",
      modelConfig: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        maxTokens: 1000,
      },
    };
    setVariants([...variants, newVariant]);
  };

  const updateVariant = (id: string, updates: Partial<PromptVariant>) => {
    setVariants(variants.map((v) => (v.id === id ? { ...v, ...updates } : v)));
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
  };

  const addCriterion = () => {
    if (!criteriaTypes.data || criteriaTypes.data.length === 0) return;

    const firstType = criteriaTypes.data[0];
    const newCriterion: EvaluationCriterion = {
      id: `criterion-${Date.now()}`,
      type: firstType.type as EvaluationCriterion["type"],
      name: firstType.name,
      config: {},
      weight: 1,
      required: false,
    };
    setCriteria([...criteria, newCriterion]);
  };

  const updateCriterion = (
    id: string,
    updates: Partial<EvaluationCriterion>,
  ) => {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCriterion = (id: string) => {
    setCriteria(criteria.filter((c) => c.id !== id));
  };

  const handleRunEvaluation = async () => {
    if (variants.length === 0 || criteria.length === 0) {
      alert("Please add at least one prompt variant and one test criterion");
      return;
    }

    setIsRunning(true);
    try {
      const result = await runEvaluation.mutateAsync({
        datasetId,
        testSuiteId: `ts-${Date.now()}`,
        promptVariants: variants,
        testCriteria: criteria,
        sampleSize,
      });
      setEvaluationResult(result);
      setActiveTab("results");
    } catch (error) {
      console.error("Evaluation failed:", error);
      alert("Evaluation failed. Please check the console for details.");
    } finally {
      setIsRunning(false);
    }
  };

  const renderVariantTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Prompt Variants</h3>
        <Button onClick={addVariant} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Variant
        </Button>
      </div>

      {variants.length === 0 && (
        <Alert>
          <AlertDescription>
            Add prompt variants to evaluate against your dataset. Each variant
            will be tested with the same inputs.
          </AlertDescription>
        </Alert>
      )}

      {variants.map((variant) => (
        <Card key={variant.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Input
                value={variant.name}
                onChange={(e) =>
                  updateVariant(variant.id, { name: e.target.value })
                }
                className="font-medium"
                placeholder="Variant name"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeVariant(variant.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Prompt Content</Label>
              <Textarea
                value={variant.content}
                onChange={(e) =>
                  updateVariant(variant.id, { content: e.target.value })
                }
                placeholder="Enter your prompt template here. Use {{variable}} for substitutions."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Model</Label>
                <Select
                  value={variant.modelConfig?.model}
                  onValueChange={(model) =>
                    updateVariant(variant.id, {
                      modelConfig: { ...variant.modelConfig!, model },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3-sonnet">
                      Claude 3 Sonnet
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Temperature</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={variant.modelConfig?.temperature}
                  onChange={(e) =>
                    updateVariant(variant.id, {
                      modelConfig: {
                        ...variant.modelConfig!,
                        temperature: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderCriteriaTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Test Criteria</h3>
        <Button onClick={addCriterion} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Criterion
        </Button>
      </div>

      {criteria.length === 0 && (
        <Alert>
          <AlertDescription>
            Add test criteria to evaluate your prompt variants. Each criterion
            will be applied to the outputs.
          </AlertDescription>
        </Alert>
      )}

      {criteria.map((criterion) => {
        const typeConfig = criteriaTypes.data?.find(
          (t) => t.type === criterion.type,
        );

        return (
          <Card key={criterion.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Input
                  value={criterion.name}
                  onChange={(e) =>
                    updateCriterion(criterion.id, { name: e.target.value })
                  }
                  placeholder="Criterion name"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCriterion(criterion.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Test Type</Label>
                <Select
                  value={criterion.type}
                  onValueChange={(type) => {
                    const newTypeConfig = criteriaTypes.data?.find(
                      (t) => t.type === type,
                    );
                    updateCriterion(criterion.id, {
                      type: type as EvaluationCriterion["type"],
                      name: newTypeConfig?.name || type,
                      config: {}, // Reset config when type changes
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {criteriaTypes.data?.map((type) => (
                      <SelectItem key={type.type} value={type.type}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {typeConfig && (
                <div className="text-sm text-muted-foreground">
                  {typeConfig.description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Weight (0-1)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={criterion.weight}
                    onChange={(e) =>
                      updateCriterion(criterion.id, {
                        weight: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={criterion.required}
                    onChange={(e) =>
                      updateCriterion(criterion.id, {
                        required: e.target.checked,
                      })
                    }
                  />
                  <Label>Required (must pass)</Label>
                </div>
              </div>

              {/* Simplified config for demo - in production, render dynamic form based on schema */}
              <div>
                <Label>Configuration (JSON)</Label>
                <Textarea
                  value={JSON.stringify(criterion.config, null, 2)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value);
                      updateCriterion(criterion.id, { config });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{"keywords": ["required", "terms"]}'
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderResultsTab = () => {
    if (!evaluationResult) {
      return (
        <Alert>
          <AlertDescription>
            No evaluation results yet. Run an evaluation to see results here.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-lg font-medium">Evaluation Results</h3>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {evaluationResult.variantResults?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Variants Tested
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {evaluationResult.variantResults?.[0]?.summary.totalItems ||
                    0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Dataset Items
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {evaluationResult.status === "completed"
                    ? "Complete"
                    : evaluationResult.status}
                </div>
                <div className="text-sm text-muted-foreground">Status</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {evaluationResult.variantResults?.map((result: any) => (
          <Card key={result.variantId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{result.variantName}</span>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      result.summary.passRate > 0.8 ? "default" : "secondary"
                    }
                  >
                    {Math.round(result.summary.passRate * 100)}% Pass Rate
                  </Badge>
                  <Badge variant="outline">
                    Score: {result.summary.averageScore.toFixed(2)}
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                {result.summary.passedItems}/{result.summary.totalItems} tests
                passed
                {result.summary.averageLatency && (
                  <span className="ml-4">
                    Avg. Latency: {Math.round(result.summary.averageLatency)}ms
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Progress
                  value={result.summary.passRate * 100}
                  className="h-2"
                />

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Passed:</span>
                    <span className="text-green-600">
                      {result.summary.passedItems}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed:</span>
                    <span className="text-red-600">
                      {result.summary.failedItems}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Score:</span>
                    <span>{result.summary.averageScore.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dataset Evaluation</h2>
          <p className="text-muted-foreground">
            Test prompt variants against dataset: {datasetName}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div>
          <Label>Sample Size</Label>
          <Input
            type="number"
            min="1"
            max="1000"
            value={sampleSize}
            onChange={(e) => setSampleSize(parseInt(e.target.value))}
            className="w-24"
          />
        </div>

        <Button
          onClick={handleRunEvaluation}
          disabled={isRunning || variants.length === 0 || criteria.length === 0}
          className="ml-auto"
        >
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run Evaluation
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="variants">
            Prompt Variants ({variants.length})
          </TabsTrigger>
          <TabsTrigger value="criteria">
            Test Criteria ({criteria.length})
          </TabsTrigger>
          <TabsTrigger value="results">
            Results{" "}
            {evaluationResult && <CheckCircle className="ml-1 h-4 w-4" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variants">{renderVariantTab()}</TabsContent>

        <TabsContent value="criteria">{renderCriteriaTab()}</TabsContent>

        <TabsContent value="results">{renderResultsTab()}</TabsContent>
      </Tabs>
    </div>
  );
}
