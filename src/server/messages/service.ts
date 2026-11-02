import type { Category, MessageDto, MessageStatus } from "@/lib/domain";
import type { CreateMessageInput, ListMessagesQuery } from "@/lib/validation";
import { ConflictError, LLMError, NotFoundError } from "@/server/errors";
import { PROMPT_VERSION } from "@/server/llm/prompts";
import type { LLMProvider } from "@/server/llm/types";
import { logger } from "@/server/logger";
import { toMessageDto } from "./dto";
import type { MessageRepository, MessageWithReply } from "./repository";

/** A message stuck in `processing` this long (e.g. the function was killed) may be retried. */
export const STALE_PROCESSING_MS = 2 * 60 * 1000;

export type ErrorReporter = (err: unknown, context: Record<string, string>) => void;

export interface MessageServiceDeps {
  repo: MessageRepository;
  llm: LLMProvider;
  reportError?: ErrorReporter;
  now?: () => number;
}

/**
 * Business logic for the support inbox.
 *
 * Workflow: processing → draft_ready → approved, with failed as a recoverable side state.
 * The customer message is persisted *before* any LLM call, so an AI outage never loses data —
 * the message is marked `failed` with a user-safe reason and can be retried.
 */
export function createMessageService({ repo, llm, reportError = () => {}, now = Date.now }: MessageServiceDeps) {
  async function getOrThrow(id: string): Promise<MessageWithReply> {
    const message = await repo.findById(id);
    if (!message) throw new NotFoundError("Sporočilo ne obstaja.");
    return message;
  }

  async function runAiPipeline(message: MessageWithReply): Promise<void> {
    const startedAt = now();
    let stage: "classify" | "draft" | "persist" = "classify";
    try {
      // A human-corrected category is authoritative: regenerate the draft, don't re-classify.
      const keepHumanCategory = message.categorySource === "human" && message.category !== null;
      const classification = keepHumanCategory
        ? { category: message.category as Category, confidence: null }
        : await llm.classify(message.body);

      stage = "draft";
      const draft = await llm.draftReply({
        message: message.body,
        category: classification.category,
        customerName: message.customerName,
      });

      stage = "persist";
      await repo.saveAiResult(message.id, {
        category: classification.category,
        categoryConfidence: classification.confidence,
        categorySource: keepHumanCategory ? "human" : "ai",
        draft,
        model: `${llm.name}/${llm.model}`,
        promptVersion: PROMPT_VERSION,
      });

      logger.info("ai.processed", {
        messageId: message.id,
        provider: llm.name,
        model: llm.model,
        category: classification.category,
        durationMs: now() - startedAt,
      });
    } catch (err) {
      const publicMessage = err instanceof LLMError ? err.publicMessage : "Nepričakovana napaka pri AI obdelavi.";
      logger.error("ai.failed", { messageId: message.id, stage, provider: llm.name, model: llm.model, err });
      reportError(err, { messageId: message.id, stage, provider: llm.name, model: llm.model });
      await repo.markFailed(message.id, publicMessage);
    }
  }

  return {
    async list(query: ListMessagesQuery): Promise<MessageDto[]> {
      return (await repo.list(query)).map(toMessageDto);
    },

    async get(id: string): Promise<MessageDto> {
      return toMessageDto(await getOrThrow(id));
    },

    /** Saves the message, then classifies it and drafts a reply. Always returns the stored message. */
    async create(input: CreateMessageInput): Promise<MessageDto> {
      const row = await repo.insert(input);
      await runAiPipeline({ ...row, reply: null });
      return toMessageDto(await getOrThrow(row.id));
    },

    /** Retries a failed message or regenerates the draft of an unapproved one. */
    async process(id: string): Promise<MessageDto> {
      const message = await getOrThrow(id);
      if (message.status === "approved") {
        throw new ConflictError("Potrjenega odgovora ni mogoče ponovno generirati.");
      }
      const isStale = now() - message.updatedAt.getTime() > STALE_PROCESSING_MS;
      if (message.status === "processing" && !isStale) {
        throw new ConflictError("Sporočilo se že obdeluje.");
      }

      const allowedFrom: MessageStatus[] = ["draft_ready", "failed", ...(isStale ? (["processing"] as const) : [])];
      if (!(await repo.markProcessing(id, allowedFrom))) {
        throw new ConflictError("Stanje sporočila se je medtem spremenilo. Osveži stran.");
      }
      await runAiPipeline(message);
      return toMessageDto(await getOrThrow(id));
    },

    async updateCategory(id: string, category: Category): Promise<MessageDto> {
      await getOrThrow(id);
      if (!(await repo.updateCategory(id, category))) {
        throw new ConflictError("Kategorijo je mogoče spremeniti samo pred potrditvijo odgovora.");
      }
      return toMessageDto(await getOrThrow(id));
    },

    async updateReply(id: string, body: string): Promise<MessageDto> {
      await getOrThrow(id);
      if (!(await repo.updateReplyBody(id, body))) {
        throw new ConflictError("Urejati je mogoče samo osnutke, ki še niso potrjeni.");
      }
      return toMessageDto(await getOrThrow(id));
    },

    async approve(id: string): Promise<MessageDto> {
      await getOrThrow(id);
      if (!(await repo.approve(id))) {
        throw new ConflictError("Potrditi je mogoče samo pripravljen osnutek (morda je že potrjen).");
      }
      return toMessageDto(await getOrThrow(id));
    },
  };
}

export type MessageService = ReturnType<typeof createMessageService>;
