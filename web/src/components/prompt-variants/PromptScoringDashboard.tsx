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
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import {
  AlertCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
// import { api } from "@/src/utils/api";

interface PromptScoringDashboardProps {
  projectId: string;
}

interface ScoreResult {
  promptId: string;
  promptContent: string;
  score: number;
  metrics: {
    accuracy: number;
    latency: number;
    cost: number;
    coherence: number;
    relevance: number;
  };
  ranking: number;
}

export function PromptScoringDashboard({
  projectId: _projectId,
}: PromptScoringDashboardProps) {
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [testCases, setTestCases] = useState<string[]>([""]);
  const [isScoring, setIsScoring] = useState(false);
  const [results, setResults] = useState<ScoreResult[]>([]);
  const [comparisonReport, setComparisonReport] = useState<string | null>(null);

  // Mock scoring mutation - replace with actual tRPC call
  // const scorePrompts = api.promptScoring?.scorePrompts.useMutation?.();

  const addPrompt = () => {
    setPrompts([...prompts, ""]);
  };

  const updatePrompt = (index: number, value: string) => {
    const updated = [...prompts];
    updated[index] = value;
    setPrompts(updated);
  };

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index));
    }
  };

  const addTestCase = () => {
    setTestCases([...testCases, ""]);
  };

  const updateTestCase = (index: number, value: string) => {
    const updated = [...testCases];
    updated[index] = value;
    setTestCases(updated);
  };

  const removeTestCase = (index: number) => {
    if (testCases.length > 1) {
      setTestCases(testCases.filter((_, i) => i !== index));
    }
  };

  const runScoring = async () => {
    setIsScoring(true);

    try {
      // Mock scoring - replace with actual API call
      const mockResults: ScoreResult[] = prompts
        .filter((p) => p.trim())
        .map((prompt, index) => ({
          promptId: `prompt-${index + 1}`,
          promptContent: prompt,
          score: Math.random() * 100,
          metrics: {
            accuracy: Math.random() * 100,
            latency: Math.random() * 1000,
            cost: Math.random() * 10,
            coherence: Math.random() * 100,
            relevance: Math.random() * 100,
          },
          ranking: index + 1,
        }))
        .sort((a, b) => b.score - a.score)
        .map((result, index) => ({ ...result, ranking: index + 1 }));

      setResults(mockResults);

      // Generate comparison report
      const report = generateComparisonReport(mockResults);
      setComparisonReport(report);
    } catch (error) {
      console.error("Scoring failed:", error);
    } finally {
      setIsScoring(false);
    }
  };

  const generateComparisonReport = (results: ScoreResult[]) => {
    if (results.length < 2) return "Need at least 2 prompts for comparison";

    const best = results[0];
    const worst = results[results.length - 1];
    const scoreDiff = best.score - worst.score;

    return `## Scoring Report

**Best Performing Prompt** (Rank #${best.ranking})
- Overall Score: ${best.score.toFixed(2)}
- Accuracy: ${best.metrics.accuracy.toFixed(2)}%
- Latency: ${best.metrics.latency.toFixed(0)}ms
- Cost: $${best.metrics.cost.toFixed(3)}

**Worst Performing Prompt** (Rank #${worst.ranking})
- Overall Score: ${worst.score.toFixed(2)}
- Performance Gap: ${scoreDiff.toFixed(2)} points

**Key Insights:**
${results.length > 2 ? `- Tested ${results.length} prompt variants` : "- Head-to-head comparison"}
- Best prompt outperforms worst by ${((scoreDiff / worst.score) * 100).toFixed(1)}%
- Average latency: ${(results.reduce((sum, r) => sum + r.metrics.latency, 0) / results.length).toFixed(0)}ms
- Cost efficiency leader: Prompt #${results.sort((a, b) => a.metrics.cost - b.metrics.cost)[0].ranking}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (score >= 60) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Prompt Scoring & Comparison
          </CardTitle>
          <CardDescription>
            Compare multiple prompts against test cases to find the best
            performing version
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompts Section */}
          <div>
            <Label className="text-base font-medium">Prompts to Compare</Label>
            <div className="mt-2 space-y-3">
              {prompts.map((prompt, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`prompt-${index}`} className="text-sm">
                      Prompt {index + 1}
                    </Label>
                    <Textarea
                      id={`prompt-${index}`}
                      value={prompt}
                      onChange={(e) => updatePrompt(index, e.target.value)}
                      placeholder="Enter your prompt here..."
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-1 pt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removePrompt(index)}
                      disabled={prompts.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addPrompt}>
                Add Prompt
              </Button>
            </div>
          </div>

          {/* Test Cases Section */}
          <div>
            <Label className="text-base font-medium">Test Cases</Label>
            <div className="mt-2 space-y-3">
              {testCases.map((testCase, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`testcase-${index}`} className="text-sm">
                      Test Case {index + 1}
                    </Label>
                    <Input
                      id={`testcase-${index}`}
                      value={testCase}
                      onChange={(e) => updateTestCase(index, e.target.value)}
                      placeholder="Enter test input or scenario..."
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeTestCase(index)}
                      disabled={testCases.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addTestCase}>
                Add Test Case
              </Button>
            </div>
          </div>

          <Button
            onClick={runScoring}
            disabled={isScoring || prompts.filter((p) => p.trim()).length < 2}
            className="w-full"
          >
            {isScoring ? "Scoring Prompts..." : "Run Scoring Analysis"}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Results</CardTitle>
            <CardDescription>
              Ranked by overall performance score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.promptId} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={result.ranking === 1 ? "default" : "secondary"}
                      >
                        Rank #{result.ranking}
                      </Badge>
                      {getScoreIcon(result.score)}
                      <span
                        className={`font-semibold ${getScoreColor(result.score)}`}
                      >
                        {result.score.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3 rounded bg-muted p-2 text-sm text-muted-foreground">
                    {result.promptContent.slice(0, 150)}
                    {result.promptContent.length > 150 && "..."}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                    <div>
                      <div className="font-medium">Accuracy</div>
                      <div className={getScoreColor(result.metrics.accuracy)}>
                        {result.metrics.accuracy.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Latency</div>
                      <div>{result.metrics.latency.toFixed(0)}ms</div>
                    </div>
                    <div>
                      <div className="font-medium">Cost</div>
                      <div>${result.metrics.cost.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="font-medium">Coherence</div>
                      <div className={getScoreColor(result.metrics.coherence)}>
                        {result.metrics.coherence.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Relevance</div>
                      <div className={getScoreColor(result.metrics.relevance)}>
                        {result.metrics.relevance.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Report */}
      {comparisonReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Analysis Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {comparisonReport}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
