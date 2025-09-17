import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Label } from "@/src/components/ui/label";
import { Switch } from "@/src/components/ui/switch";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import { Loader2, Wand2, Copy, Check } from "lucide-react";
import { api } from "@/src/utils/api";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { showErrorToast } from "@/src/features/notifications/showErrorToast";
import type { PromptVariantRule } from "@/src/features/prompts/server/promptVariantGenerator";

const VARIANT_RULES: {
  value: PromptVariantRule;
  label: string;
  description: string;
}[] = [
  {
    value: "strict",
    label: "Strict",
    description: "Add explicit instructions to follow requirements exactly",
  },
  {
    value: "bullet_points",
    label: "Bullet Points",
    description: "Format response as bullet points",
  },
  {
    value: "numbered_list",
    label: "Numbered List",
    description: "Format response as numbered list",
  },
  {
    value: "concise",
    label: "Concise",
    description: "Make response brief and to the point",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Request comprehensive, thorough response",
  },
  {
    value: "formal",
    label: "Formal",
    description: "Use professional, formal language",
  },
  {
    value: "casual",
    label: "Casual",
    description: "Use conversational, casual language",
  },
  {
    value: "step_by_step",
    label: "Step by Step",
    description: "Break down into clear steps",
  },
  {
    value: "json_format",
    label: "JSON Format",
    description: "Request JSON-only response",
  },
];

interface PromptVariant {
  id: string;
  name: string;
  content: string;
  generationMethod: "rule-based" | "llm-assisted";
  rule?: string;
  metadata: {
    basePromptHash: string;
    generatedAt: string;
    method: string;
  };
}

interface PromptVariantGeneratorProps {
  basePrompt: string;
  projectId: string;
  onVariantSelect?: (variant: PromptVariant) => void;
}

export function PromptVariantGenerator({
  basePrompt,
  projectId,
  onVariantSelect,
}: PromptVariantGeneratorProps) {
  const [selectedRules, setSelectedRules] = useState<PromptVariantRule[]>([]);
  const [llmAssisted, setLlmAssisted] = useState(false);
  const [maxVariants] = useState(5);
  const [variants, setVariants] = useState<PromptVariant[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateVariants = api.promptVariants.generateVariants.useMutation({
    onSuccess: (data) => {
      setVariants(data.variants);
      showSuccessToast({
        title: "Generated variants",
        description: `Generated ${data.variants.length} prompt variants`,
      });
    },
    onError: (error) => {
      showErrorToast("Failed to generate variants", error.message);
    },
  });

  const handleRuleToggle = (rule: PromptVariantRule, checked: boolean) => {
    if (checked) {
      setSelectedRules((prev) => [...prev, rule]);
    } else {
      setSelectedRules((prev) => prev.filter((r) => r !== rule));
    }
  };

  const handleGenerate = () => {
    if (!basePrompt.trim()) {
      showErrorToast("Validation Error", "Please provide a base prompt");
      return;
    }

    if (selectedRules.length === 0 && !llmAssisted) {
      showErrorToast(
        "Validation Error",
        "Please select at least one rule or enable LLM-assisted generation",
      );
      return;
    }

    generateVariants.mutate({
      basePrompt,
      projectId,
      rules: selectedRules.length > 0 ? selectedRules : undefined,
      llmAssisted,
      maxVariants,
    });
  };

  const copyToClipboard = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showSuccessToast({
        title: "Copied to clipboard",
        description: "Prompt variant copied successfully",
      });
    } catch (error) {
      showErrorToast("Copy Error", "Failed to copy to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      {/* Generation Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Prompt Variants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rule Selection */}
          <div>
            <Label className="mb-3 block text-sm font-medium">
              Rule-based Transformations
            </Label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {VARIANT_RULES.map((rule) => (
                <div key={rule.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={rule.value}
                    checked={selectedRules.includes(rule.value)}
                    onCheckedChange={(checked) =>
                      handleRuleToggle(rule.value, checked as boolean)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor={rule.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {rule.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LLM-Assisted Generation */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                LLM-Assisted Generation
              </Label>
              <p className="text-xs text-muted-foreground">
                Use AI to generate creative prompt variants
              </p>
            </div>
            <Switch checked={llmAssisted} onCheckedChange={setLlmAssisted} />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={
              generateVariants.isPending ||
              (!selectedRules.length && !llmAssisted)
            }
            className="w-full"
          >
            {generateVariants.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate Variants
          </Button>
        </CardContent>
      </Card>

      {/* Generated Variants */}
      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Variants ({variants.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.map((variant) => (
              <div key={variant.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{variant.name}</h4>
                    <Badge
                      variant={
                        variant.generationMethod === "rule-based"
                          ? "secondary"
                          : "default"
                      }
                    >
                      {variant.generationMethod}
                    </Badge>
                    {variant.rule && (
                      <Badge variant="outline">
                        {variant.rule.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(variant.content, variant.id)
                      }
                    >
                      {copiedId === variant.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    {onVariantSelect && (
                      <Button
                        size="sm"
                        onClick={() => onVariantSelect(variant)}
                      >
                        Use This
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={variant.content}
                  readOnly
                  className="resize-none"
                  rows={Math.min(8, variant.content.split("\n").length + 2)}
                />
                <div className="text-xs text-muted-foreground">
                  Generated:{" "}
                  {new Date(variant.metadata.generatedAt).toLocaleString()} |
                  Method: {variant.metadata.method}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
