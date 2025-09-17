import { useState } from "react";
import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Label } from "@/src/components/ui/label";
import { Loader2, Wand2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PromptVariantGeneratorProps {
  projectId: string;
  initialPrompt?: string;
  onVariantSelect?: (variant: any) => void;
}

const AVAILABLE_RULES = [
  {
    value: "tone_formal",
    label: "Formal Tone",
    description: "Make the prompt more professional",
  },
  {
    value: "tone_casual",
    label: "Casual Tone",
    description: "Make the prompt more conversational",
  },
  {
    value: "structure_step_by_step",
    label: "Step-by-Step",
    description: "Add structured format",
  },
  {
    value: "include_examples",
    label: "Include Examples",
    description: "Request examples in response",
  },
  {
    value: "length_shorter",
    label: "Shorter",
    description: "Make the prompt more concise",
  },
  {
    value: "length_longer",
    label: "Longer",
    description: "Add more detail and context",
  },
];

export function PromptVariantGenerator({
  projectId,
  initialPrompt = "",
  onVariantSelect,
}: PromptVariantGeneratorProps) {
  const [sourcePrompt, setSourcePrompt] = useState(initialPrompt);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [variantCount, setVariantCount] = useState(3);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateVariants = api.promptVariants.generateVariants.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Successfully generated ${data.variants.length} prompt variants`,
      );
    },
    onError: (error) => {
      toast.error(`Generation Failed: ${error.message}`);
    },
  });

  const handleGenerate = async () => {
    if (!sourcePrompt.trim()) {
      toast.error("Please enter a source prompt to generate variants");
      return;
    }

    if (selectedRules.length === 0) {
      toast.error("Please select at least one transformation rule");
      return;
    }

    await generateVariants.mutateAsync({
      basePrompt: sourcePrompt,
      rules: selectedRules as any[],
      maxVariants: variantCount,
      projectId,
    });
  };

  const handleRuleToggle = (ruleValue: string) => {
    setSelectedRules((prev) =>
      prev.includes(ruleValue)
        ? prev.filter((r) => r !== ruleValue)
        : [...prev, ruleValue],
    );
  };

  const handleCopyVariant = async (variant: any, index: number) => {
    try {
      await navigator.clipboard.writeText(variant.generatedPrompt);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);

      toast.success("Variant copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      {/* Source Prompt Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Prompt Variant Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="source-prompt">Source Prompt</Label>
            <Textarea
              id="source-prompt"
              placeholder="Enter your base prompt here..."
              value={sourcePrompt}
              onChange={(e) => setSourcePrompt(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>

          {/* Rule Selection */}
          <div>
            <Label>Transformation Rules</Label>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {AVAILABLE_RULES.map((rule) => (
                <div key={rule.value} className="flex items-start space-x-3">
                  <Checkbox
                    id={rule.value}
                    checked={selectedRules.includes(rule.value)}
                    onCheckedChange={() => handleRuleToggle(rule.value)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor={rule.value}
                      className="cursor-pointer text-sm font-medium"
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

          {/* Generation Settings */}
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="variant-count">Number of Variants</Label>
              <select
                id="variant-count"
                value={variantCount}
                onChange={(e) => setVariantCount(Number(e.target.value))}
                className="ml-2 rounded border px-3 py-1"
              >
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={
                generateVariants.isPending ||
                !sourcePrompt.trim() ||
                selectedRules.length === 0
              }
              className="ml-auto"
            >
              {generateVariants.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Variants
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Variants */}
      {generateVariants.data?.variants &&
        generateVariants.data.variants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Variants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generateVariants.data.variants.map((variant, index) => (
                  <div
                    key={variant.id}
                    className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-900"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex flex-wrap gap-1">
                        {((variant as any).appliedRules || []).map(
                          (rule: any, index: number) => (
                            <Badge
                              key={`${typeof rule === "string" ? rule : rule.type || rule}-${index}`}
                              variant="secondary"
                              className="text-xs"
                            >
                              {typeof rule === "string"
                                ? rule.replace(/_/g, " ")
                                : (rule.type || rule).replace(/_/g, " ")}
                            </Badge>
                          ),
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyVariant(variant, index)}
                        >
                          {copiedIndex === index ? (
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

                    <div className="rounded border bg-white p-3 dark:bg-gray-800">
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {(variant as any).generatedPrompt ||
                          (variant as any).content ||
                          "No content available"}
                      </pre>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Confidence:{" "}
                        {(
                          ((variant as any).metadata?.confidence || 0.5) * 100
                        ).toFixed(0)}
                        %
                      </span>
                      <span>
                        Generated in{" "}
                        {(variant as any).metadata?.generationTime || 0}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Empty State */}
      {!generateVariants.data && !generateVariants.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wand2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-muted-foreground">
              Ready to Generate Variants
            </h3>
            <p className="max-w-md text-center text-sm text-muted-foreground">
              Enter a source prompt, select transformation rules, and click
              generate to create optimized variants of your prompt.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
