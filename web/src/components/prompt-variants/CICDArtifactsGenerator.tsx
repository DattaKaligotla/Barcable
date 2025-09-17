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
import { Badge } from "@/src/components/ui/badge";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Download,
  GitBranch,
  Package,
  FileCode,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface CICDArtifactsGeneratorProps {
  projectId: string;
}

interface ArtifactConfig {
  format: "json" | "yaml" | "env" | "docker";
  includePrompts: boolean;
  includeMetrics: boolean;
  includeTestCases: boolean;
  outputName: string;
  deployment: {
    environment: string;
    version: string;
    branch: string;
  };
}

interface GeneratedArtifact {
  name: string;
  type: string;
  content: string;
  size: string;
  description: string;
}

export function CICDArtifactsGenerator({
  projectId: _projectId,
}: CICDArtifactsGeneratorProps) {
  const [config, setConfig] = useState<ArtifactConfig>({
    format: "json",
    includePrompts: true,
    includeMetrics: true,
    includeTestCases: false,
    outputName: "langfuse-prompts",
    deployment: {
      environment: "production",
      version: "1.0.0",
      branch: "main",
    },
  });

  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateArtifacts = async () => {
    setIsGenerating(true);

    try {
      const newArtifacts: GeneratedArtifact[] = [];

      // Generate main configuration file
      if (config.format === "json") {
        const configContent = {
          project: {
            id: _projectId,
            version: config.deployment.version,
            environment: config.deployment.environment,
            branch: config.deployment.branch,
            generatedAt: new Date().toISOString(),
          },
          prompts: config.includePrompts
            ? [
                {
                  id: "customer-classifier",
                  name: "Customer Support Classifier",
                  template: "Classify the following customer inquiry: {input}",
                  version: "1.2.0",
                  labels: ["classification", "customer-support"],
                  performance: {
                    accuracy: 0.94,
                    latency: 120,
                    cost: 0.002,
                  },
                },
                {
                  id: "code-reviewer",
                  name: "Code Review Assistant",
                  template: "Review this code for issues: {code}",
                  version: "1.0.0",
                  labels: ["code-review", "development"],
                  performance: {
                    accuracy: 0.87,
                    latency: 450,
                    cost: 0.008,
                  },
                },
              ]
            : undefined,
          metrics: config.includeMetrics
            ? {
                totalPrompts: 15,
                avgAccuracy: 0.891,
                avgLatency: 285,
                totalCost: 0.045,
                lastUpdated: new Date().toISOString(),
              }
            : undefined,
          testCases: config.includeTestCases
            ? [
                {
                  input: "My billing seems incorrect this month",
                  expectedOutput: "billing",
                  promptId: "customer-classifier",
                },
                {
                  input: "The app keeps crashing on startup",
                  expectedOutput: "technical",
                  promptId: "customer-classifier",
                },
              ]
            : undefined,
        };

        newArtifacts.push({
          name: `${config.outputName}.json`,
          type: "JSON Configuration",
          content: JSON.stringify(configContent, null, 2),
          size: `${Math.round(JSON.stringify(configContent).length / 1024)}KB`,
          description:
            "Complete project configuration with prompts and metadata",
        });
      }

      // Generate Docker configuration
      if (config.format === "docker") {
        const dockerContent = `# Langfuse Prompts - ${config.deployment.environment}
FROM langfuse/langfuse:latest

# Set environment variables
ENV LANGFUSE_PROJECT_ID="${_projectId}"
ENV LANGFUSE_VERSION="${config.deployment.version}"
ENV LANGFUSE_ENVIRONMENT="${config.deployment.environment}"

# Copy prompt configurations
COPY prompts/ /app/prompts/
COPY metrics.json /app/metrics.json

# Set working directory
WORKDIR /app

# Install dependencies and build
RUN npm install --production
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]`;

        newArtifacts.push({
          name: "Dockerfile",
          type: "Docker Configuration",
          content: dockerContent,
          size: `${Math.round(dockerContent.length / 1024)}KB`,
          description: "Docker configuration for deployment",
        });
      }

      // Generate environment variables
      if (config.format === "env") {
        const envContent = `# Langfuse Environment Configuration
# Generated: ${new Date().toISOString()}

LANGFUSE_PROJECT_ID=${_projectId}
LANGFUSE_VERSION=${config.deployment.version}
LANGFUSE_ENVIRONMENT=${config.deployment.environment}
LANGFUSE_BRANCH=${config.deployment.branch}

# Prompt Configuration
PROMPTS_ENABLED=${config.includePrompts}
METRICS_ENABLED=${config.includeMetrics}
TEST_CASES_ENABLED=${config.includeTestCases}

# Performance Thresholds
MIN_ACCURACY_THRESHOLD=0.85
MAX_LATENCY_THRESHOLD=500
MAX_COST_THRESHOLD=0.01

# Deployment Settings
AUTO_DEPLOY=true
ROLLBACK_ON_FAILURE=true
HEALTH_CHECK_ENABLED=true`;

        newArtifacts.push({
          name: ".env.production",
          type: "Environment Variables",
          content: envContent,
          size: `${Math.round(envContent.length / 1024)}KB`,
          description: "Environment variables for production deployment",
        });
      }

      // Generate YAML configuration
      if (config.format === "yaml") {
        const yamlContent = `# Langfuse Prompts Configuration
# Generated: ${new Date().toISOString()}

project:
  id: ${_projectId}
  version: ${config.deployment.version}
  environment: ${config.deployment.environment}
  branch: ${config.deployment.branch}
  
deployment:
  strategy: rolling-update
  replicas: 3
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"

prompts:
  - id: customer-classifier
    name: "Customer Support Classifier"
    version: "1.2.0"
    template: "Classify the following customer inquiry: {input}"
    labels:
      - classification
      - customer-support
    performance:
      accuracy: 0.94
      latency: 120
      cost: 0.002

monitoring:
  metrics:
    enabled: ${config.includeMetrics}
    interval: 30s
  health_checks:
    enabled: true
    path: /health
    timeout: 5s
    
testing:
  enabled: ${config.includeTestCases}
  automated: true
  thresholds:
    accuracy: 0.85
    latency: 500`;

        newArtifacts.push({
          name: `${config.outputName}.yaml`,
          type: "YAML Configuration",
          content: yamlContent,
          size: `${Math.round(yamlContent.length / 1024)}KB`,
          description: "YAML configuration for Kubernetes deployment",
        });
      }

      // Generate GitHub Actions workflow
      const workflowContent = `name: Deploy Langfuse Prompts

on:
  push:
    branches: [${config.deployment.branch}]
  pull_request:
    branches: [${config.deployment.branch}]

env:
  LANGFUSE_PROJECT_ID: ${_projectId}
  ENVIRONMENT: ${config.deployment.environment}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run prompt tests
        run: npm run test:prompts
      - name: Validate configurations
        run: npm run validate:config

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/${config.deployment.branch}'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to ${config.deployment.environment}
        run: |
          echo "Deploying version ${config.deployment.version}"
          # Add your deployment commands here
      - name: Health check
        run: |
          curl -f \${{ secrets.DEPLOYMENT_URL }}/health || exit 1`;

      newArtifacts.push({
        name: ".github/workflows/deploy.yml",
        type: "GitHub Actions",
        content: workflowContent,
        size: `${Math.round(workflowContent.length / 1024)}KB`,
        description: "CI/CD workflow for automated deployment",
      });

      setArtifacts(newArtifacts);
    } catch (error) {
      console.error("Artifact generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadArtifact = (artifact: GeneratedArtifact) => {
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    artifacts.forEach((artifact) => {
      setTimeout(() => downloadArtifact(artifact), 100);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            CI/CD Artifacts Generator
          </CardTitle>
          <CardDescription>
            Generate deployment configurations and CI/CD artifacts for your
            prompt workflows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Form */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label htmlFor="format">Output Format</Label>
                <Select
                  value={config.format}
                  onValueChange={(value: "json" | "yaml" | "env" | "docker") =>
                    setConfig({ ...config, format: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON Configuration</SelectItem>
                    <SelectItem value="yaml">YAML (Kubernetes)</SelectItem>
                    <SelectItem value="env">Environment Variables</SelectItem>
                    <SelectItem value="docker">Docker Configuration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="outputName">Output Name</Label>
                <Input
                  id="outputName"
                  value={config.outputName}
                  onChange={(e) =>
                    setConfig({ ...config, outputName: e.target.value })
                  }
                  placeholder="langfuse-prompts"
                />
              </div>

              <div>
                <Label htmlFor="environment">Environment</Label>
                <Select
                  value={config.deployment.environment}
                  onValueChange={(value) =>
                    setConfig({
                      ...config,
                      deployment: { ...config.deployment, environment: value },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={config.deployment.version}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      deployment: {
                        ...config.deployment,
                        version: e.target.value,
                      },
                    })
                  }
                  placeholder="1.0.0"
                />
              </div>

              <div>
                <Label htmlFor="branch">Git Branch</Label>
                <Input
                  id="branch"
                  value={config.deployment.branch}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      deployment: {
                        ...config.deployment,
                        branch: e.target.value,
                      },
                    })
                  }
                  placeholder="main"
                />
              </div>

              <div className="space-y-3">
                <Label>Include in Artifacts</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includePrompts"
                      checked={config.includePrompts}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          includePrompts: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="includePrompts">Prompt Templates</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeMetrics"
                      checked={config.includeMetrics}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          includeMetrics: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="includeMetrics">Performance Metrics</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeTestCases"
                      checked={config.includeTestCases}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          includeTestCases: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="includeTestCases">Test Cases</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={generateArtifacts}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating
              ? "Generating Artifacts..."
              : "Generate CI/CD Artifacts"}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Artifacts */}
      {artifacts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Generated Artifacts
                </CardTitle>
                <CardDescription>
                  {artifacts.length} files ready for deployment
                </CardDescription>
              </div>
              <Button onClick={downloadAll} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {artifacts.map((artifact, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileCode className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{artifact.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {artifact.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{artifact.type}</Badge>
                      <Badge variant="secondary">{artifact.size}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadArtifact(artifact)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    value={artifact.content}
                    readOnly
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>

            {/* Deployment Instructions */}
            <div className="mt-6 rounded-lg bg-muted p-4">
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Next Steps
              </h4>
              <div className="space-y-1 text-sm">
                <p>
                  • Download the generated artifacts to your project repository
                </p>
                <p>
                  • Commit the files to your {config.deployment.branch} branch
                </p>
                <p>
                  • Configure your CI/CD pipeline with the provided workflow
                </p>
                <p>
                  • Set up environment variables in your deployment platform
                </p>
                <p>
                  • Test the deployment in {config.deployment.environment}{" "}
                  environment
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Important Notes
              </h4>
              <div className="space-y-1 text-sm text-yellow-800">
                <p>• Review all generated configurations before deployment</p>
                <p>
                  • Update secret keys and sensitive data in your CI/CD platform
                </p>
                <p>
                  • Test thoroughly in staging before deploying to production
                </p>
                <p>• Monitor performance metrics after deployment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
