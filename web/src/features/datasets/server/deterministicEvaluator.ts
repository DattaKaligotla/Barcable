import {
  type EvaluationCriteria,
  type EvaluationResult,
  countTokens,
  calculateSimilarity,
} from "./evaluationTypes";

export class DeterministicEvaluator {
  async evaluateOutput(
    actualOutput: string,
    expectedOutput: string | null,
    criteria: EvaluationCriteria[],
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const criterion of criteria) {
      try {
        const result = await this.evaluateSingleCriterion(
          actualOutput,
          expectedOutput,
          criterion,
        );
        results.push(result);
      } catch (error) {
        results.push({
          criteriaId: criterion.id,
          passed: false,
          score: 0,
          message: `Evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    return results;
  }

  private async evaluateSingleCriterion(
    actualOutput: string,
    expectedOutput: string | null,
    criterion: EvaluationCriteria,
  ): Promise<EvaluationResult> {
    const { type, config } = criterion;

    switch (type) {
      case "must_contain":
        return this.evaluateMustContain(actualOutput, config, criterion.id);

      case "must_not_contain":
        return this.evaluateMustNotContain(actualOutput, config, criterion.id);

      case "regex_match":
        return this.evaluateRegexMatch(actualOutput, config, criterion.id);

      case "regex_not_match":
        return this.evaluateRegexNotMatch(actualOutput, config, criterion.id);

      case "token_limit_max":
        return this.evaluateTokenLimitMax(actualOutput, config, criterion.id);

      case "token_limit_min":
        return this.evaluateTokenLimitMin(actualOutput, config, criterion.id);

      case "length_max_chars":
        return this.evaluateLengthMaxChars(actualOutput, config, criterion.id);

      case "length_min_chars":
        return this.evaluateLengthMinChars(actualOutput, config, criterion.id);

      case "json_schema_valid":
        return this.evaluateJsonSchema(actualOutput, config, criterion.id);

      case "starts_with":
        return this.evaluateStartsWith(actualOutput, config, criterion.id);

      case "ends_with":
        return this.evaluateEndsWith(actualOutput, config, criterion.id);

      case "exact_match":
        return this.evaluateExactMatch(
          actualOutput,
          expectedOutput,
          config,
          criterion.id,
        );

      case "similarity_threshold":
        return this.evaluateSimilarityThreshold(
          actualOutput,
          expectedOutput,
          config,
          criterion.id,
        );

      default:
        throw new Error(`Unknown evaluation criterion type: ${type}`);
    }
  }

  private evaluateMustContain(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const text = config.text as string;
    const texts = config.texts as string[] | undefined;
    const caseSensitive = config.caseSensitive !== false;

    const checkText = caseSensitive ? output : output.toLowerCase();

    if (text) {
      const searchText = caseSensitive ? text : text.toLowerCase();
      const passed = checkText.includes(searchText);
      return {
        criteriaId,
        passed,
        score: passed ? 1 : 0,
        message: passed
          ? `Contains "${text}"`
          : `Missing required text: "${text}"`,
      };
    }

    if (texts && texts.length > 0) {
      const foundTexts = texts.filter((t) => {
        const searchText = caseSensitive ? t : t.toLowerCase();
        return checkText.includes(searchText);
      });

      const passed = foundTexts.length === texts.length;
      return {
        criteriaId,
        passed,
        score: foundTexts.length / texts.length,
        message: passed
          ? `Contains all required texts`
          : `Missing ${texts.length - foundTexts.length} required texts`,
        details: {
          foundTexts,
          missingTexts: texts.filter((t) => !foundTexts.includes(t)),
        },
      };
    }

    throw new Error(
      "Must provide either 'text' or 'texts' for must_contain criterion",
    );
  }

  private evaluateMustNotContain(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const text = config.text as string;
    const texts = config.texts as string[] | undefined;
    const caseSensitive = config.caseSensitive !== false;

    const checkText = caseSensitive ? output : output.toLowerCase();

    if (text) {
      const searchText = caseSensitive ? text : text.toLowerCase();
      const passed = !checkText.includes(searchText);
      return {
        criteriaId,
        passed,
        score: passed ? 1 : 0,
        message: passed
          ? `Correctly excludes "${text}"`
          : `Contains forbidden text: "${text}"`,
      };
    }

    if (texts && texts.length > 0) {
      const foundTexts = texts.filter((t) => {
        const searchText = caseSensitive ? t : t.toLowerCase();
        return checkText.includes(searchText);
      });

      const passed = foundTexts.length === 0;
      return {
        criteriaId,
        passed,
        score: 1 - foundTexts.length / texts.length,
        message: passed
          ? `Correctly excludes all forbidden texts`
          : `Contains ${foundTexts.length} forbidden texts`,
        details: { foundForbiddenTexts: foundTexts },
      };
    }

    throw new Error(
      "Must provide either 'text' or 'texts' for must_not_contain criterion",
    );
  }

  private evaluateRegexMatch(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const pattern = config.pattern as string;
    const flags = config.flags as string | undefined;

    if (!pattern) {
      throw new Error("Must provide 'pattern' for regex_match criterion");
    }

    try {
      const regex = new RegExp(pattern, flags);
      const match = regex.test(output);

      return {
        criteriaId,
        passed: match,
        score: match ? 1 : 0,
        message: match
          ? `Matches pattern: ${pattern}`
          : `Does not match pattern: ${pattern}`,
      };
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }
  }

  private evaluateRegexNotMatch(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const pattern = config.pattern as string;
    const flags = config.flags as string | undefined;

    if (!pattern) {
      throw new Error("Must provide 'pattern' for regex_not_match criterion");
    }

    try {
      const regex = new RegExp(pattern, flags);
      const match = regex.test(output);

      return {
        criteriaId,
        passed: !match,
        score: !match ? 1 : 0,
        message: !match
          ? `Correctly avoids pattern: ${pattern}`
          : `Matches forbidden pattern: ${pattern}`,
      };
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }
  }

  private evaluateTokenLimitMax(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const maxTokens = config.value as number;

    if (typeof maxTokens !== "number") {
      throw new Error(
        "Must provide 'value' (number) for token_limit_max criterion",
      );
    }

    const tokenCount = countTokens(output);
    const passed = tokenCount <= maxTokens;

    return {
      criteriaId,
      passed,
      score: passed ? 1 : Math.max(0, 1 - (tokenCount - maxTokens) / maxTokens),
      message: `Token count: ${tokenCount}/${maxTokens}`,
      details: { tokenCount, maxTokens, exceeded: tokenCount - maxTokens },
    };
  }

  private evaluateTokenLimitMin(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const minTokens = config.value as number;

    if (typeof minTokens !== "number") {
      throw new Error(
        "Must provide 'value' (number) for token_limit_min criterion",
      );
    }

    const tokenCount = countTokens(output);
    const passed = tokenCount >= minTokens;

    return {
      criteriaId,
      passed,
      score: passed ? 1 : tokenCount / minTokens,
      message: `Token count: ${tokenCount}/${minTokens} minimum`,
      details: { tokenCount, minTokens, shortfall: minTokens - tokenCount },
    };
  }

  private evaluateLengthMaxChars(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const maxChars = config.value as number;

    if (typeof maxChars !== "number") {
      throw new Error(
        "Must provide 'value' (number) for length_max_chars criterion",
      );
    }

    const charCount = output.length;
    const passed = charCount <= maxChars;

    return {
      criteriaId,
      passed,
      score: passed ? 1 : Math.max(0, 1 - (charCount - maxChars) / maxChars),
      message: `Character count: ${charCount}/${maxChars}`,
      details: { charCount, maxChars, exceeded: charCount - maxChars },
    };
  }

  private evaluateLengthMinChars(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const minChars = config.value as number;

    if (typeof minChars !== "number") {
      throw new Error(
        "Must provide 'value' (number) for length_min_chars criterion",
      );
    }

    const charCount = output.length;
    const passed = charCount >= minChars;

    return {
      criteriaId,
      passed,
      score: passed ? 1 : charCount / minChars,
      message: `Character count: ${charCount}/${minChars} minimum`,
      details: { charCount, minChars, shortfall: minChars - charCount },
    };
  }

  private evaluateJsonSchema(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    try {
      const parsed = JSON.parse(output);

      // Basic JSON validity check (schema validation would require a library like AJV)
      const passed = typeof parsed === "object" && parsed !== null;

      return {
        criteriaId,
        passed,
        score: passed ? 1 : 0,
        message: passed ? "Valid JSON format" : "Invalid JSON format",
      };
    } catch (error) {
      return {
        criteriaId,
        passed: false,
        score: 0,
        message: "Invalid JSON format",
        details: {
          error: error instanceof Error ? error.message : "Unknown JSON error",
        },
      };
    }
  }

  private evaluateStartsWith(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const text = config.text as string;
    const caseSensitive = config.caseSensitive !== false;

    if (!text) {
      throw new Error("Must provide 'text' for starts_with criterion");
    }

    const checkOutput = caseSensitive ? output : output.toLowerCase();
    const checkText = caseSensitive ? text : text.toLowerCase();
    const passed = checkOutput.startsWith(checkText);

    return {
      criteriaId,
      passed,
      score: passed ? 1 : 0,
      message: passed
        ? `Starts with "${text}"`
        : `Does not start with "${text}"`,
    };
  }

  private evaluateEndsWith(
    output: string,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const text = config.text as string;
    const caseSensitive = config.caseSensitive !== false;

    if (!text) {
      throw new Error("Must provide 'text' for ends_with criterion");
    }

    const checkOutput = caseSensitive ? output : output.toLowerCase();
    const checkText = caseSensitive ? text : text.toLowerCase();
    const passed = checkOutput.endsWith(checkText);

    return {
      criteriaId,
      passed,
      score: passed ? 1 : 0,
      message: passed ? `Ends with "${text}"` : `Does not end with "${text}"`,
    };
  }

  private evaluateExactMatch(
    output: string,
    expectedOutput: string | null,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const referenceText = config.text as string | undefined;
    const caseSensitive = config.caseSensitive !== false;

    const target = referenceText || expectedOutput;

    if (!target) {
      throw new Error(
        "Must provide either 'text' in config or expectedOutput for exact_match criterion",
      );
    }

    const checkOutput = caseSensitive ? output : output.toLowerCase();
    const checkTarget = caseSensitive ? target : target.toLowerCase();
    const passed = checkOutput === checkTarget;

    return {
      criteriaId,
      passed,
      score: passed ? 1 : 0,
      message: passed ? "Exact match" : "Does not match exactly",
    };
  }

  private evaluateSimilarityThreshold(
    output: string,
    expectedOutput: string | null,
    config: any,
    criteriaId: string,
  ): EvaluationResult {
    const threshold = config.threshold as number;
    const referenceText = config.referenceText as string | undefined;

    if (typeof threshold !== "number" || threshold < 0 || threshold > 1) {
      throw new Error(
        "Must provide 'threshold' (0-1) for similarity_threshold criterion",
      );
    }

    const target = referenceText || expectedOutput;

    if (!target) {
      throw new Error(
        "Must provide either 'referenceText' in config or expectedOutput for similarity_threshold criterion",
      );
    }

    const similarity = calculateSimilarity(output, target);
    const passed = similarity >= threshold;

    return {
      criteriaId,
      passed,
      score: similarity,
      message: `Similarity: ${(similarity * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
      details: {
        similarity,
        threshold,
        target: referenceText ? "referenceText" : "expectedOutput",
      },
    };
  }
}

export const deterministicEvaluator = new DeterministicEvaluator();
