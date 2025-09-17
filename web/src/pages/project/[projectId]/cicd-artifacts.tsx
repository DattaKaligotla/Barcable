import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Package, GitBranch, Settings, Download } from "lucide-react";
import { CICDArtifactGenerator } from "@/src/features/prompts/components/CICDArtifactGenerator";

export default function CICDPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  return (
    <Page
      headerProps={{
        title: "CI/CD Artifacts",
        help: {
          description:
            "Generate deployment artifacts and integration files for your prompt engineering workflow",
        },
        breadcrumb: [
          {
            name: "Prompts",
            href: `/project/${projectId}/prompts/`,
          },
          {
            name: "CI/CD Artifacts",
          },
        ],
      }}
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Artifact Types
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">
                YAML + JSON formats
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Integration Ready
              </CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">100%</div>
              <p className="text-xs text-muted-foreground">
                CI/CD pipeline compatible
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Export Formats
              </CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Both</div>
              <p className="text-xs text-muted-foreground">
                YAML & JSON available
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Artifact Generator */}
        <CICDArtifactGenerator />

        {/* Documentation and Examples */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              CI/CD Integration Guide
            </CardTitle>
            <CardDescription>
              How to integrate Barcable prompt artifacts into your deployment
              pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Artifact Files</h3>
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium">📄 change_list.yaml</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete change log with prompt modifications, label
                    updates, and deployment readiness status. Perfect for
                    automated deployment scripts and PR reviews.
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium">📊 summary.json</h4>
                  <p className="text-sm text-muted-foreground">
                    High-level metrics and deployment report including
                    performance data, quality metrics, and production readiness
                    assessment.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">
                GitHub Actions Integration
              </h3>
              <div className="rounded-lg bg-muted p-4">
                <pre className="overflow-x-auto text-sm">
                  {`name: Deploy Prompts
on:
  push:
    branches: [main]

jobs:
  deploy-prompts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate Barcable Artifacts
        run: |
          curl -X POST "$BARCABLE_API/cicdArtifacts/generateLatest" \\
            -H "Authorization: Bearer $BARCABLE_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d '{"hoursBack": 24}'
            
      - name: Review Production Changes
        run: |
          if grep -q "production_ready" .barcable/change_list.yaml; then
            echo "🚀 Production deployment ready"
            # Deploy to production
          else
            echo "⏳ No production changes detected"
          fi`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">Jenkins Pipeline</h3>
              <div className="rounded-lg bg-muted p-4">
                <pre className="overflow-x-auto text-sm">
                  {`pipeline {
    agent any
    
    stages {
        stage('Generate Artifacts') {
            steps {
                script {
                    def artifacts = sh(
                        script: "curl -s $BARCABLE_API/cicdArtifacts/generateLatest",
                        returnStdout: true
                    )
                    
                    writeFile file: '.barcable/artifacts.json', text: artifacts
                }
            }
        }
        
        stage('Deploy Changes') {
            when {
                expression {
                    return fileExists('.barcable/change_list.yaml')
                }
            }
            steps {
                sh 'python deploy_prompts.py .barcable/change_list.yaml'
            }
        }
    }
}`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">API Endpoints</h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <code>POST /cicdArtifacts/generateLatest</code>
                  <span>Generate artifacts for recent changes</span>
                  <span className="text-green-600">✓ Quick setup</span>
                </div>
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <code>POST /cicdArtifacts/generateArtifacts</code>
                  <span>Custom date range generation</span>
                  <span className="text-blue-600">⚙️ Flexible</span>
                </div>
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <code>GET /cicdArtifacts/previewArtifacts</code>
                  <span>Preview changes before generation</span>
                  <span className="text-yellow-600">👁️ Preview</span>
                </div>
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <code>GET /cicdArtifacts/getDeploymentReport</code>
                  <span>Current deployment status</span>
                  <span className="text-purple-600">📊 Status</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">
                Webhook Configuration
              </h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Set up webhooks to automatically generate artifacts when prompts
                change:
              </p>
              <div className="rounded-lg bg-muted p-4">
                <pre className="text-sm">
                  {`{
  "webhook_url": "https://your-ci-system.com/trigger",
  "events": ["prompt.updated", "prompt.labeled", "prompt.promoted"],
  "payload": {
    "project_id": "{{project_id}}",
    "trigger": "barcable_artifact_generation",
    "changes": "{{change_summary}}"
  }
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
