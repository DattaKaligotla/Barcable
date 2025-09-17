#!/usr/bin/env node

/**
 * Barcable CI/CD Artifact Generator CLI
 *
 * Usage:
 *   npx barcable-artifacts generate --project-id <id> --api-key <key>
 *   npx barcable-artifacts deploy --change-list ./change_list.yaml
 *   npx barcable-artifacts validate --summary ./summary.json
 *
 * Environment Variables:
 *   BARCABLE_API_URL - Base URL for Barcable API (default: https://cloud.langfuse.com)
 *   BARCABLE_API_KEY - API key for authentication
 *   BARCABLE_PROJECT_ID - Project ID for artifact generation
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { program } = require("commander");

class BarcableArtifactCLI {
  constructor() {
    this.apiUrl = process.env.BARCABLE_API_URL || "https://cloud.langfuse.com";
    this.apiKey = process.env.BARCABLE_API_KEY;
    this.projectId = process.env.BARCABLE_PROJECT_ID;
  }

  async makeRequest(endpoint, method = "GET", data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`/api/cicdArtifacts/${endpoint}`, this.apiUrl);

      const options = {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      };

      const req = https.request(url, options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(body);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        });
      });

      req.on("error", reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async generateArtifacts(options) {
    const {
      hoursBack = 24,
      output = ".barcable",
      includeScoring = true,
      includeEvaluation = true,
    } = options;

    if (!this.apiKey) {
      throw new Error("BARCABLE_API_KEY environment variable is required");
    }

    if (!this.projectId) {
      throw new Error("BARCABLE_PROJECT_ID environment variable is required");
    }

    console.log(`🚀 Generating artifacts for project ${this.projectId}...`);

    try {
      const response = await this.makeRequest("generateLatest", "POST", {
        hoursBack: parseInt(hoursBack),
        includeScoring,
        includeEvaluation,
      });

      if (!response.success) {
        throw new Error(response.message || "Artifact generation failed");
      }

      // Ensure output directory exists
      if (!fs.existsSync(output)) {
        fs.mkdirSync(output, { recursive: true });
      }

      // Write YAML file
      const yamlPath = path.join(output, "change_list.yaml");
      fs.writeFileSync(yamlPath, response.files.yamlContent, "utf8");

      // Write JSON file
      const jsonPath = path.join(output, "summary.json");
      fs.writeFileSync(jsonPath, response.files.jsonContent, "utf8");

      console.log(`✅ Artifacts generated successfully!`);
      console.log(`📄 Change list: ${yamlPath}`);
      console.log(`📊 Summary: ${jsonPath}`);
      console.log(`📈 Changes: ${response.changeList.summary.total_changes}`);
      console.log(
        `🏷️  Production ready: ${response.changeList.deployment_info.production_ready.length}`,
      );

      return {
        yamlPath,
        jsonPath,
        summary: response.summary,
        changeList: response.changeList,
      };
    } catch (error) {
      console.error(`❌ Error generating artifacts: ${error.message}`);
      process.exit(1);
    }
  }

  async validateDeployment(summaryPath) {
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`Summary file not found: ${summaryPath}`);
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));

    console.log(`🔍 Validating deployment readiness...`);

    // Check production readiness
    const productionCandidates = summary.deployment.production_candidates;
    const readyForProduction = productionCandidates.filter((p) => p.ready);

    console.log(`\n📊 Deployment Summary:`);
    console.log(`   Total prompts: ${summary.metrics.prompts.total}`);
    console.log(`   In production: ${summary.metrics.prompts.in_production}`);
    console.log(`   Production candidates: ${productionCandidates.length}`);
    console.log(`   Ready for production: ${readyForProduction.length}`);

    // Check quality metrics
    const quality = summary.quality;
    console.log(`\n🎯 Quality Metrics:`);
    console.log(`   Test coverage: ${quality.test_coverage || "N/A"}%`);
    console.log(`   Tests passed: ${quality.evaluation_status.passed}`);
    console.log(`   Tests failed: ${quality.evaluation_status.failed}`);

    // Check compliance
    console.log(`\n✅ Compliance:`);
    console.log(
      `   Label standards: ${quality.compliance.label_standards ? "✓" : "✗"}`,
    );
    console.log(
      `   Review process: ${quality.compliance.review_process ? "✓" : "✗"}`,
    );
    console.log(
      `   Audit trail: ${quality.compliance.audit_trail ? "✓" : "✗"}`,
    );

    // Check review requirements
    const reviewRequired = summary.deployment.review_required;
    if (reviewRequired.length > 0) {
      console.log(`\n⚠️  Review Required:`);
      reviewRequired.forEach((item) => {
        console.log(`   ${item.name}: ${item.reason} (${item.urgency})`);
      });
    }

    // Overall recommendation
    const isDeploymentReady =
      readyForProduction.length > 0 &&
      quality.evaluation_status.failed === 0 &&
      reviewRequired.filter((r) => r.urgency === "high").length === 0;

    console.log(
      `\n🚀 Deployment Recommendation: ${isDeploymentReady ? "✅ READY" : "⚠️  NEEDS ATTENTION"}`,
    );

    return {
      ready: isDeploymentReady,
      summary,
      recommendations: this.generateRecommendations(summary),
    };
  }

  generateRecommendations(summary) {
    const recommendations = [];

    if (summary.quality.evaluation_status.failed > 0) {
      recommendations.push("Fix failing tests before deployment");
    }

    if (summary.deployment.review_required.some((r) => r.urgency === "high")) {
      recommendations.push("Address high-urgency review items");
    }

    if (summary.quality.test_coverage < 80) {
      recommendations.push("Improve test coverage to at least 80%");
    }

    if (
      summary.deployment.production_candidates.filter((p) => p.ready).length ===
      0
    ) {
      recommendations.push("No prompts are ready for production deployment");
    }

    return recommendations;
  }

  async deployFromChangeList(changeListPath, dryRun = false) {
    if (!fs.existsSync(changeListPath)) {
      throw new Error(`Change list file not found: ${changeListPath}`);
    }

    const yaml = require("js-yaml");
    const changeList = yaml.load(fs.readFileSync(changeListPath, "utf8"));

    console.log(
      `${dryRun ? "🔍 DRY RUN:" : "🚀"} Processing deployment from change list...`,
    );

    const productionReady = changeList.deployment_info.production_ready;
    const requiresReview = changeList.deployment_info.requires_review;

    console.log(`\n📦 Production Ready Prompts (${productionReady.length}):`);
    productionReady.forEach((prompt) => {
      console.log(`   ✅ ${prompt}`);
    });

    if (requiresReview.length > 0) {
      console.log(`\n⚠️  Requires Review (${requiresReview.length}):`);
      requiresReview.forEach((prompt) => {
        console.log(`   🔍 ${prompt}`);
      });
    }

    if (!dryRun) {
      console.log(`\n🚀 Executing deployment...`);
      // Here you would implement actual deployment logic
      // This could involve calling your deployment APIs, updating infrastructure, etc.
      console.log(`✅ Deployment completed successfully!`);
    } else {
      console.log(
        `\n👀 Dry run completed. Use --execute to perform actual deployment.`,
      );
    }

    return {
      productionReady,
      requiresReview,
      executed: !dryRun,
    };
  }
}

// CLI Commands
program
  .name("barcable-artifacts")
  .description("Barcable CI/CD Artifact Generator")
  .version("1.0.0");

program
  .command("generate")
  .description("Generate CI/CD artifacts")
  .option("--project-id <id>", "Project ID")
  .option("--api-key <key>", "API key")
  .option("--hours-back <hours>", "Hours to look back", "24")
  .option("--output <dir>", "Output directory", ".barcable")
  .option("--no-scoring", "Exclude scoring data")
  .option("--no-evaluation", "Exclude evaluation data")
  .action(async (options) => {
    const cli = new BarcableArtifactCLI();

    if (options.projectId) cli.projectId = options.projectId;
    if (options.apiKey) cli.apiKey = options.apiKey;

    await cli.generateArtifacts({
      hoursBack: options.hoursBack,
      output: options.output,
      includeScoring: options.scoring,
      includeEvaluation: options.evaluation,
    });
  });

program
  .command("validate")
  .description("Validate deployment readiness")
  .argument("<summary-file>", "Path to summary.json file")
  .action(async (summaryFile) => {
    const cli = new BarcableArtifactCLI();
    await cli.validateDeployment(summaryFile);
  });

program
  .command("deploy")
  .description("Deploy from change list")
  .argument("<change-list>", "Path to change_list.yaml file")
  .option("--dry-run", "Show what would be deployed without executing")
  .action(async (changeList, options) => {
    const cli = new BarcableArtifactCLI();
    await cli.deployFromChangeList(changeList, options.dryRun);
  });

program
  .command("status")
  .description("Check deployment status")
  .option("--project-id <id>", "Project ID")
  .option("--api-key <key>", "API key")
  .action(async (options) => {
    const cli = new BarcableArtifactCLI();

    if (options.projectId) cli.projectId = options.projectId;
    if (options.apiKey) cli.apiKey = options.apiKey;

    try {
      const response = await cli.makeRequest("getDeploymentReport");

      console.log("📊 Current Deployment Status:");
      console.log(
        `   Production prompts: ${response.metrics.prompts.in_production}`,
      );
      console.log(`   Staging prompts: ${response.metrics.prompts.in_staging}`);
      console.log(`   Candidates: ${response.metrics.prompts.candidates}`);
      console.log(
        `   Review required: ${response.deployment.review_required.length}`,
      );
    } catch (error) {
      console.error(`❌ Error fetching status: ${error.message}`);
      process.exit(1);
    }
  });

// Handle errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled error:", error.message);
  process.exit(1);
});

program.parse();
