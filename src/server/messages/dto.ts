import type { MessageDto, MessageEventDto } from "@/lib/domain";
import type { MessageEventRow } from "@/server/db/schema";
import type { MessageWithReply } from "./repository";

export function toMessageEventDto(row: MessageEventRow): MessageEventDto {
  const error = row.details?.error;
  return {
    id: row.id,
    type: row.type,
    actor: row.actor,
    oldValue: row.oldValue,
    newValue: row.newValue,
    error: typeof error === "string" ? error : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Maps DB rows to the public API shape (ISO dates, derived `edited` flag). */
export function toMessageDto(row: MessageWithReply): MessageDto {
  return {
    id: row.id,
    threadId: row.threadId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    body: row.body,
    category: row.category,
    categoryConfidence: row.categoryConfidence,
    categorySource: row.categorySource,
    status: row.status,
    aiError: row.aiError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reply: row.reply
      ? {
          id: row.reply.id,
          aiDraft: row.reply.aiDraft,
          body: row.reply.body,
          model: row.reply.model,
          promptVersion: row.reply.promptVersion,
          edited: row.reply.body !== row.reply.aiDraft,
          approvedAt: row.reply.approvedAt?.toISOString() ?? null,
          updatedAt: row.reply.updatedAt.toISOString(),
        }
      : null,
  };
}
