# Barcable CI/CD CLI

A command-line tool for generating and managing CI/CD artifacts in Barcable prompt engineering workflows.

## Installation

```bash
npm install -g barcable-artifacts
# or
npx barcable-artifacts --help
```

## Configuration

Set environment variables or pass options directly:

```bash
export BARCABLE_API_URL="https://your-barcable-instance.com"
export BARCABLE_API_KEY="your-api-key"
export BARCABLE_PROJECT_ID="your-project-id"
```

## Commands

### Generate Artifacts

Generate CI/CD artifacts (change_list.yaml + summary.json) for recent prompt changes:

```bash
# Generate artifacts for last 24 hours
barcable-artifacts generate

# Generate for specific time period
barcable-artifacts generate --hours-back 48 --output ./artifacts

# Generate with specific project
barcable-artifacts generate --project-id abc123 --api-key your-key
```

**Options:**

- `--project-id <id>`: Project ID (overrides env var)
- `--api-key <key>`: API key (overrides env var)
- `--hours-back <hours>`: Hours to look back (default: 24)
- `--output <dir>`: Output directory (default: .barcable)
- `--no-scoring`: Exclude scoring data
- `--no-evaluation`: Exclude evaluation data

### Validate Deployment

Check deployment readiness from a summary file:

```bash
barcable-artifacts validate ./summary.json
```

**Output:**

```
🔍 Validating deployment readiness...

📊 Deployment Summary:
   Total prompts: 15
   In production: 8
   Production candidates: 4
   Ready for production: 2

🎯 Quality Metrics:
   Test coverage: 85%
   Tests passed: 12
   Tests failed: 0

✅ Compliance:
   Label standards: ✓
   Review process: ✓
   Audit trail: ✓

🚀 Deployment Recommendation: ✅ READY
```

### Deploy from Change List

Process deployment using a change list file:

```bash
# Dry run (preview what would be deployed)
barcable-artifacts deploy ./change_list.yaml --dry-run

# Execute deployment
barcable-artifacts deploy ./change_list.yaml
```

### Check Status

Get current deployment status:

```bash
barcable-artifacts status
```

## CI/CD Integration Examples

### GitHub Actions

```yaml
name: Prompt Engineering CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  prompt-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install Barcable CLI
        run: npm install -g barcable-artifacts

      - name: Generate artifacts
        env:
          BARCABLE_API_KEY: ${{ secrets.BARCABLE_API_KEY }}
          BARCABLE_PROJECT_ID: ${{ secrets.BARCABLE_PROJECT_ID }}
        run: barcable-artifacts generate --hours-back 168

      - name: Validate deployment
        run: barcable-artifacts validate .barcable/summary.json

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: barcable-artifacts
          path: .barcable/

      - name: Deploy to production (main branch only)
        if: github.ref == 'refs/heads/main'
        run: barcable-artifacts deploy .barcable/change_list.yaml
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        BARCABLE_API_KEY = credentials('barcable-api-key')
        BARCABLE_PROJECT_ID = credentials('barcable-project-id')
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g barcable-artifacts'
            }
        }

        stage('Generate Artifacts') {
            steps {
                sh 'barcable-artifacts generate --hours-back 24'
                archiveArtifacts artifacts: '.barcable/*', fingerprint: true
            }
        }

        stage('Validate') {
            steps {
                sh 'barcable-artifacts validate .barcable/summary.json'
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    def deployApproval = input(
                        message: 'Deploy prompt changes to production?',
                        parameters: [
                            [$class: 'BooleanParameterDefinition',
                             defaultValue: false,
                             description: 'Confirm deployment',
                             name: 'Deploy']
                        ]
                    )

                    if (deployApproval) {
                        sh 'barcable-artifacts deploy .barcable/change_list.yaml'
                    }
                }
            }
        }
    }

    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.barcable',
                reportFiles: 'summary.json',
                reportName: 'Prompt Engineering Report'
            ])
        }
    }
}
```

### GitLab CI

```yaml
stages:
  - validate
  - deploy

variables:
  BARCABLE_API_URL: "https://your-instance.com"

before_script:
  - npm install -g barcable-artifacts

prompt_validation:
  stage: validate
  script:
    - barcable-artifacts generate
    - barcable-artifacts validate .barcable/summary.json
  artifacts:
    paths:
      - .barcable/
    reports:
      junit: .barcable/test-results.xml
  only:
    - merge_requests
    - main

prompt_deployment:
  stage: deploy
  script:
    - barcable-artifacts deploy .barcable/change_list.yaml
  environment:
    name: production
  when: manual
  only:
    - main
```

## Output Files

### change_list.yaml

Contains detailed change tracking and deployment information:

```yaml
version: "1.0"
generated_at: "2024-01-15T10:30:00Z"
project:
  id: "cm123456"
  name: "My AI Project"

changes:
  - id: "cm789012"
    type: "created"
    prompt_name: "customer_support_v2"
    # ... detailed change info

deployment_info:
  production_ready:
    - "customer_support_v2"
  requires_review:
    - "experimental_prompt"
```

### summary.json

Contains comprehensive metrics and quality assessment:

```json
{
  "workflow": {
    "type": "ci_cd_artifacts",
    "generated_at": "2024-01-15T10:30:00Z"
  },
  "project": {
    "id": "cm123456",
    "name": "My AI Project"
  },
  "metrics": {
    "prompts": {
      "total": 15,
      "in_production": 8,
      "candidates": 4
    }
  },
  "quality": {
    "test_coverage": 85,
    "evaluation_status": {
      "passed": 12,
      "failed": 0
    }
  },
  "deployment": {
    "production_candidates": [...],
    "review_required": [...]
  }
}
```

## Error Handling

The CLI provides detailed error messages and appropriate exit codes:

- `0`: Success
- `1`: General error (API failure, validation failure, etc.)
- `2`: Configuration error (missing credentials, invalid options)

## Development

To contribute to the CLI:

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse/packages/cicd-cli
npm install
npm test
npm run lint
```

## License

MIT - see LICENSE file for details.
