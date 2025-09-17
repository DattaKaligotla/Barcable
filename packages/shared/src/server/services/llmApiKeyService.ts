import { PrismaClient } from "@prisma/client";
import { LLMAdapter } from "../llm/types";
import { decrypt } from "@langfuse/shared/encryption";
import { logger } from "../logger";

export interface LLMApiKeyInfo {
  id: string;
  provider: string;
  adapter: LLMAdapter;
  secretKey: string;
  baseURL?: string | null;
  customModels: string[];
  withDefaultModels: boolean;
  extraHeaders?: Record<string, string>;
  config?: Record<string, any> | null;
}

/**
 * Retrieves the first available LLM API key for a project, preferring OpenAI.
 * This is used by services that need to make LLM API calls.
 */
export async function getProjectLLMApiKey(
  prisma: PrismaClient,
  projectId: string,
  preferredProvider?: string,
): Promise<LLMApiKeyInfo | null> {
  try {
    // First try to get the preferred provider (default to OpenAI)
    const preferredProviderName = preferredProvider || "openai";

    const preferredKey = await prisma.llmApiKeys.findFirst({
      where: {
        projectId,
        provider: preferredProviderName,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (preferredKey) {
      return transformLLMApiKey(preferredKey);
    }

    // If no preferred provider found, get any available key
    const anyKey = await prisma.llmApiKeys.findFirst({
      where: {
        projectId,
      },
      orderBy: [
        // Prefer OpenAI, then Anthropic, then others
        { provider: "asc" },
        { createdAt: "desc" },
      ],
    });

    if (anyKey) {
      return transformLLMApiKey(anyKey);
    }

    logger.warn(`No LLM API keys found for project ${projectId}`);
    return null;
  } catch (error) {
    logger.error("Failed to retrieve LLM API key", {
      error,
      projectId,
      preferredProvider,
    });
    return null;
  }
}

/**
 * Gets all LLM API keys for a project
 */
export async function getProjectLLMApiKeys(
  prisma: PrismaClient,
  projectId: string,
): Promise<LLMApiKeyInfo[]> {
  try {
    const keys = await prisma.llmApiKeys.findMany({
      where: {
        projectId,
      },
      orderBy: [{ provider: "asc" }, { createdAt: "desc" }],
    });

    return keys.map(transformLLMApiKey);
  } catch (error) {
    logger.error("Failed to retrieve LLM API keys", { error, projectId });
    return [];
  }
}

/**
 * Transforms a raw LLM API key from the database into a usable format
 */
function transformLLMApiKey(key: any): LLMApiKeyInfo {
  let extraHeaders: Record<string, string> | undefined;

  if (key.extraHeaders) {
    try {
      extraHeaders = JSON.parse(key.extraHeaders);
    } catch (error) {
      logger.warn("Failed to parse extra headers for LLM API key", {
        keyId: key.id,
        error,
      });
    }
  }

  return {
    id: key.id,
    provider: key.provider,
    adapter: key.adapter as LLMAdapter,
    secretKey: decrypt(key.secretKey),
    baseURL: key.baseURL,
    customModels: key.customModels || [],
    withDefaultModels: key.withDefaultModels ?? true,
    extraHeaders,
    config: key.config,
  };
}

/**
 * Gets LLM API key by provider for a project
 */
export async function getProjectLLMApiKeyByProvider(
  prisma: PrismaClient,
  projectId: string,
  provider: string,
): Promise<LLMApiKeyInfo | null> {
  try {
    const key = await prisma.llmApiKeys.findFirst({
      where: {
        projectId,
        provider,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (key) {
      return transformLLMApiKey(key);
    }

    return null;
  } catch (error) {
    logger.error("Failed to retrieve LLM API key by provider", {
      error,
      projectId,
      provider,
    });
    return null;
  }
}
