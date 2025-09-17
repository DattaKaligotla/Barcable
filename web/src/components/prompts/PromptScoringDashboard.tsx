import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Badge } from "@/src/components/ui/badge";
import { Progress } from "@/src/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Slider } from "@/src/components/ui/slider";
import { Label } from "@/src/components/ui/label";
import { api } from "@/src/utils/api";
import {
  Trophy,
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  Zap,
  CheckCircle,
  BarChart3,
  Crown,
  Medal,
  Award,
} from "lucide-react";

interface PromptScoringDashboardProps {
  evaluationResults: any[]; // Results from batch evaluation
  modelConfigs?: any[];
  onSelectVariant?: (variantId: string) => void;
}

export function PromptScoringDashboard({
  evaluationResults,
  modelConfigs = [],
  onSelectVariant,
}: PromptScoringDashboardProps) {
  const [selectedPreset, setSelectedPreset] = useState("Balanced");
  const [customWeights, setCustomWeights] = useState({
    passRate: 0.4,
    averageScore: 0.3,
    latency: 0.2,
    cost: 0.1,
  });
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [comparisonVariants, setComparisonVariants] = useState<string[]>([]);

  const scoringPresets = api.promptScoring.getScoringPresets.useQuery();

  const scoringQuery = api.promptScoring.scoreAndRank.useQuery(
    {
      evaluationResults,
      modelConfigs,
      weights:
        selectedPreset === "Custom"
          ? customWeights
          : scoringPresets.data?.find((p) => p.name === selectedPreset)
              ?.weights,
    },
    {
      enabled: evaluationResults.length > 0,
    },
  );

  const comparisonQuery = api.promptScoring.compareVariants.useQuery(
    {
      variant1: evaluationResults.find(
        (r) => r.variantId === comparisonVariants[0],
      ),
      variant2: evaluationResults.find(
        (r) => r.variantId === comparisonVariants[1],
      ),
      modelConfigs,
      weights:
        selectedPreset === "Custom"
          ? customWeights
          : scoringPresets.data?.find((p) => p.name === selectedPreset)
              ?.weights,
    },
    {
      enabled:
        comparisonVariants.length === 2 &&
        evaluationResults.some((r) => r.variantId === comparisonVariants[0]) &&
        evaluationResults.some((r) => r.variantId === comparisonVariants[1]),
    },
  );

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== "Custom") {
      const presetData = scoringPresets.data?.find((p) => p.name === preset);
      if (presetData) {
        setCustomWeights(presetData.weights);
      }
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case "production":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Production Ready
          </Badge>
        );
      case "candidate":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Candidate
          </Badge>
        );
      case "discard":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800">
            Needs Work
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const renderLeaderboard = () => {
    if (!scoringQuery.data) {
      return <div>Loading scoring data...</div>;
    }

    const { rankings } = scoringQuery.data;

    return (
      <div className="space-y-4">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {rankings[0]?.variantName || "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Top Performer
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {rankings[0]
                      ? `${(rankings[0].metrics.passRate * 100).toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Best Pass Rate
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {rankings
                      .reduce(
                        (min, r) =>
                          r.metrics.averageLatency < min
                            ? r.metrics.averageLatency
                            : min,
                        Infinity,
                      )
                      .toFixed(0)}
                    ms
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Fastest Response
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold">{rankings.length}</div>
                  <div className="text-sm text-muted-foreground">
                    Variants Tested
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {rankings.map((ranking) => (
          <Card
            key={ranking.variantId}
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              ranking.rank === 1 ? "ring-2 ring-yellow-200" : ""
            }`}
            onClick={() => onSelectVariant?.(ranking.variantId)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getRankIcon(ranking.rank)}
                  <div>
                    <CardTitle className="text-lg">
                      {ranking.variantName}
                    </CardTitle>
                    <CardDescription>
                      Rank #{ranking.rank} • Score: {ranking.score}/100
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getRecommendationBadge(ranking.recommendation || "unknown")}
                  <div
                    className={`text-2xl font-bold ${getScoreColor(ranking.score)}`}
                  >
                    {ranking.score}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center space-x-1">
                    <Target className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Pass Rate</span>
                  </div>
                  <div className="text-lg font-bold">
                    {(ranking.metrics.passRate * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center space-x-1">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Avg Latency</span>
                  </div>
                  <div className="text-lg font-bold">
                    {ranking.metrics.averageLatency.toFixed(0)}ms
                  </div>
                </div>

                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Avg Score</span>
                  </div>
                  <div className="text-lg font-bold">
                    {(ranking.metrics.averageScore * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center space-x-1">
                    <DollarSign className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Est. Cost</span>
                  </div>
                  <div className="text-lg font-bold">
                    {ranking.metrics.estimatedCostPerRun
                      ? `$${ranking.metrics.estimatedCostPerRun.toFixed(4)}`
                      : "N/A"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Performance</span>
                  <span>{ranking.score}/100</span>
                </div>
                <Progress value={ranking.score} className="h-2" />
              </div>

              {ranking.tags && ranking.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {ranking.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderComparison = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Select First Variant</Label>
            <Select
              value={comparisonVariants[0] || ""}
              onValueChange={(value) =>
                setComparisonVariants([value, comparisonVariants[1] || ""])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose variant..." />
              </SelectTrigger>
              <SelectContent>
                {evaluationResults.map((result) => (
                  <SelectItem key={result.variantId} value={result.variantId}>
                    {result.variantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Select Second Variant</Label>
            <Select
              value={comparisonVariants[1] || ""}
              onValueChange={(value) =>
                setComparisonVariants([comparisonVariants[0] || "", value])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose variant..." />
              </SelectTrigger>
              <SelectContent>
                {evaluationResults.map((result) => (
                  <SelectItem key={result.variantId} value={result.variantId}>
                    {result.variantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {comparisonQuery.data && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>Comparison Results</span>
                </CardTitle>
                <CardDescription>
                  {comparisonQuery.data.recommendation.reasoning}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <div className="mb-2 text-lg font-medium">
                    Recommended Choice
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {comparisonQuery.data.recommendation.preferred ===
                    "variant1"
                      ? comparisonQuery.data.variant1.variantName
                      : comparisonQuery.data.variant2.variantName}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {comparisonQuery.data.variant1.variantName}
                    <Badge
                      variant={
                        comparisonQuery.data.winner.overall === "variant1"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {comparisonQuery.data.winner.overall === "variant1"
                        ? "Winner"
                        : "Runner-up"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center space-x-1">
                        <Target className="h-4 w-4" />
                        <span>Pass Rate</span>
                        {comparisonQuery.data.winner.passRate ===
                          "variant1" && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="font-bold">
                        {(
                          comparisonQuery.data.variant1.metrics.passRate * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Latency</span>
                        {comparisonQuery.data.winner.latency === "variant1" && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="font-bold">
                        {comparisonQuery.data.variant1.metrics.averageLatency.toFixed(
                          0,
                        )}
                        ms
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Score</span>
                      </div>
                      <div className="font-bold">
                        {(
                          comparisonQuery.data.variant1.metrics.averageScore *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4" />
                        <span>Cost</span>
                        {comparisonQuery.data.winner.cost === "variant1" && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="font-bold">
                        {comparisonQuery.data.variant1.metrics
                          .estimatedCostPerRun
                          ? `$${comparisonQuery.data.variant1.metrics.estimatedCostPerRun.toFixed(4)}`
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>Overall Score</span>
                      <span>{comparisonQuery.data.variant1.score}/100</span>
                    </div>
                    <Progress value={comparisonQuery.data.variant1.score} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {comparisonQuery.data.variant2.variantName}
                    <Badge
                      variant={
                        comparisonQuery.data.winner.overall === "variant2"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {comparisonQuery.data.winner.overall === "variant2"
                        ? "Winner"
                        : "Runner-up"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center space-x-1">
                        <Target className="h-4 w-4" />
                        <span>Pass Rate</span>
                        {comparisonQuery.data.winner.passRate ===
                          "variant2" && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="font-bold">
                        {(
                          comparisonQuery.data.variant2.metrics.passRate * 100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Latency</span>
                        {comparisonQuery.data.winner.latency === "variant2" && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="font-bold">
                        {comparisonQuery.data.variant2.metrics.averageLatency.toFixed(
                          0,
                        )}
                        ms
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Score</span>
                      </div>
                      <div className="font-bold">
                        {(
                          comparisonQuery.data.variant2.metrics.averageScore *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4" />
                        <span>Cost</span>
                        {comparisonQuery.data.winner.cost === "variant2" && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="font-bold">
                        {comparisonQuery.data.variant2.metrics
                          .estimatedCostPerRun
                          ? `$${comparisonQuery.data.variant2.metrics.estimatedCostPerRun.toFixed(4)}`
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>Overall Score</span>
                      <span>{comparisonQuery.data.variant2.score}/100</span>
                    </div>
                    <Progress value={comparisonQuery.data.variant2.score} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWeightsConfig = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Scoring Configuration</CardTitle>
            <CardDescription>
              Adjust how different metrics are weighted in the overall scoring
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Scoring Preset</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scoringPresets.data?.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      {preset.name} - {preset.description}
                    </SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom Weights</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPreset === "Custom" && (
              <div className="space-y-4">
                <div>
                  <Label>
                    Pass Rate Weight:{" "}
                    {(customWeights.passRate * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[customWeights.passRate * 100]}
                    onValueChange={([value]) =>
                      setCustomWeights((prev) => ({
                        ...prev,
                        passRate: value / 100,
                      }))
                    }
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>
                    Average Score Weight:{" "}
                    {(customWeights.averageScore * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[customWeights.averageScore * 100]}
                    onValueChange={([value]) =>
                      setCustomWeights((prev) => ({
                        ...prev,
                        averageScore: value / 100,
                      }))
                    }
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>
                    Latency Weight: {(customWeights.latency * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[customWeights.latency * 100]}
                    onValueChange={([value]) =>
                      setCustomWeights((prev) => ({
                        ...prev,
                        latency: value / 100,
                      }))
                    }
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>
                    Cost Weight: {(customWeights.cost * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[customWeights.cost * 100]}
                    onValueChange={([value]) =>
                      setCustomWeights((prev) => ({
                        ...prev,
                        cost: value / 100,
                      }))
                    }
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <Alert>
                  <AlertDescription>
                    Total weight:{" "}
                    {(
                      (customWeights.passRate +
                        customWeights.averageScore +
                        customWeights.latency +
                        customWeights.cost) *
                      100
                    ).toFixed(0)}
                    %
                    {Math.abs(
                      customWeights.passRate +
                        customWeights.averageScore +
                        customWeights.latency +
                        customWeights.cost -
                        1,
                    ) > 0.01 && " - Weights should sum to 100%"}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (evaluationResults.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No evaluation results available. Please run an evaluation first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Prompt Scoring & Ranking</h2>
        <p className="text-muted-foreground">
          Compare and rank prompt variants based on performance metrics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leaderboard">
            <Trophy className="mr-2 h-4 w-4" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <BarChart3 className="mr-2 h-4 w-4" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="weights">
            <Target className="mr-2 h-4 w-4" />
            Scoring Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">{renderLeaderboard()}</TabsContent>

        <TabsContent value="comparison">{renderComparison()}</TabsContent>

        <TabsContent value="weights">{renderWeightsConfig()}</TabsContent>
      </Tabs>
    </div>
  );
}
