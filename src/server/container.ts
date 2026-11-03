import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import OpenAI from "openai";
import { createDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { AnthropicProvider } from "@/server/llm/anthropic";
import { MockProvider } from "@/server/llm/mock";
import { OpenAIProvider } from "@/server/llm/openai";
import type { LLMProvider } from "@/server/llm/types";
import { logger } from "@/server/logger";
import { createMessageRepository } from "@/server/messages/repository";
import { createMessageService, type ErrorReporter, type MessageService } from "@/server/messages/service";
import { createRateLimiter, type RateLimiter } from "@/server/rate-limit";

/**
 * Composition root: the only place that knows about concrete implementations.
 * Everything else receives its dependencies, which keeps the service layer unit-testable.
 */
function createLLMProvider(): LLMProvider {
  const env = getEnv();
  // Sentry AI monitoring: spans with model, latency and token usage — prompts/outputs are
  // NOT recorded because they contain customer personal data.
  const sentryOptions = { recordInputs: false, recordOutputs: false };

  switch (env.LLM_PROVIDER) {
    case "anthropic": {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: env.LLM_TIMEOUT_MS, maxRetries: 2 });
      return new AnthropicProvider(Sentry.instrumentAnthropicAiClient(client, sentryOptions), env.ANTHROPIC_MODEL);
    }
    case "openai": {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: env.LLM_TIMEOUT_MS, maxRetries: 2 });
      return new OpenAIProvider(Sentry.instrumentOpenAiClient(client, sentryOptions), env.OPENAI_MODEL);
    }
    case "groq": {
      // Groq implements the OpenAI Responses API, so only the base URL differs.
      const client = new OpenAI({
        apiKey: env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
        timeout: env.LLM_TIMEOUT_MS,
        maxRetries: 2,
      });
      return new OpenAIProvider(Sentry.instrumentOpenAiClient(client, sentryOptions), env.GROQ_MODEL, "groq");
    }
    case "mock":
      logger.warn("llm.mock_provider_active", {
        hint: "Set ANTHROPIC_API_KEY, OPENAI_API_KEY or GROQ_API_KEY for real AI.",
      });
      return new MockProvider();
  }
}

const reportToSentry: ErrorReporter = (err, context) => {
  Sentry.captureException(err, { tags: { area: "ai", ...context } });
};

interface Container {
  messageService: MessageService;
  pingDatabase: () => Promise<void>;
  aiRateLimiter: RateLimiter;
  llmInfo: { provider: string; model: string };
}

let container: Container | undefined;
let containerSettings: string | undefined;

export function getContainer(): Container {
  const env = getEnv();
  // Rebuilt when the settings change, so an edited .env.local applies in development without a restart.
  const settings = JSON.stringify(env);
  if (container && settings === containerSettings) return container;
  containerSettings = settings;

  const llm = createLLMProvider();
  const db = createDb();
  container = {
    pingDatabase: async () => {
      await db.execute(sql`select 1`);
    },
    messageService: createMessageService({
      repo: createMessageRepository(db),
      llm,
      reportError: reportToSentry,
    }),
    aiRateLimiter: createRateLimiter({ limit: env.RATE_LIMIT_AI_PER_MINUTE, windowMs: 60_000 }),
    llmInfo: { provider: llm.name, model: llm.model },
  };
  return container;
}

export const reportUnhandled = (err: unknown) => Sentry.captureException(err);
