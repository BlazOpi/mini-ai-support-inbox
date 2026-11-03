import { and, asc, desc, eq, gt, inArray, notExists, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Category, CategorySource, MessageStatus } from "@/lib/domain";
import type { CreateMessageInput, ListMessagesQuery } from "@/lib/validation";
import {
  messageEvents,
  messages,
  replies,
  type MessageEventRow,
  type MessageRow,
  type ReplyRow,
} from "@/server/db/schema";
import type { Database } from "@/server/db/types";

export type MessageWithReply = MessageRow & { reply: ReplyRow | null };

export interface AiResult {
  category: Category;
  categoryConfidence: number | null;
  categorySource: CategorySource;
  draft: string;
  model: string;
  promptVersion: string;
}

/**
 * Data access only — no business rules. State-changing updates are conditional on the
 * current status (optimistic concurrency) and report whether a row was actually changed.
 * Each change also adds a `message_events` row in the same transaction: if either write fails,
 * neither is kept, so the history can't miss a change or record one that didn't happen.
 */
export function createMessageRepository(db: Database) {
  const selectWithReply = () =>
    db
      .select({ message: messages, reply: replies })
      .from(messages)
      .leftJoin(replies, eq(replies.messageId, messages.id));

  return {
    async insert(input: CreateMessageInput & { threadId?: string }): Promise<MessageRow> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(messages)
          .values({
            threadId: input.threadId ?? null,
            customerName: input.customerName ?? null,
            customerEmail: input.customerEmail ?? null,
            body: input.body,
            status: "processing",
          })
          .returning();
        await tx.insert(messageEvents).values({
          messageId: row.id,
          type: input.threadId ? "customer_replied" : "message_received",
          actor: "customer",
          newValue: input.body,
        });
        return row;
      });
    },

    async findById(id: string): Promise<MessageWithReply | null> {
      const [row] = await selectWithReply().where(eq(messages.id, id)).limit(1);
      return row ? { ...row.message, reply: row.reply } : null;
    },

    /** All messages of a conversation, oldest first. */
    async findThread(threadId: string): Promise<MessageWithReply[]> {
      const rows = await selectWithReply()
        .where(or(eq(messages.id, threadId), eq(messages.threadId, threadId)))
        .orderBy(asc(messages.createdAt));
      return rows.map((r) => ({ ...r.message, reply: r.reply }));
    },

    /**
     * A conversation's change log, oldest first. Changes can share a timestamp (`now()` is fixed per
     * transaction), and sorting by type then keeps them in the order they happen: the enum's order.
     */
    async findThreadEvents(threadId: string): Promise<MessageEventRow[]> {
      const rows = await db
        .select({ event: messageEvents })
        .from(messageEvents)
        .innerJoin(messages, eq(messageEvents.messageId, messages.id))
        .where(or(eq(messages.id, threadId), eq(messages.threadId, threadId)))
        .orderBy(asc(messageEvents.createdAt), asc(messageEvents.type));
      return rows.map((r) => r.event);
    },

    /** One row per conversation: its latest message, which is the one that needs attention. */
    async list(query: ListMessagesQuery): Promise<MessageWithReply[]> {
      const later = alias(messages, "later");
      const filters: SQL[] = [
        notExists(
          db
            .select({ id: later.id })
            .from(later)
            .where(
              and(
                eq(later.threadId, sql`coalesce(${messages.threadId}, ${messages.id})`),
                gt(later.createdAt, messages.createdAt),
              ),
            ),
        ),
      ];
      if (query.category) filters.push(eq(messages.category, query.category));
      if (query.status) filters.push(eq(messages.status, query.status));
      const rows = await selectWithReply()
        .where(and(...filters))
        .orderBy(desc(messages.createdAt))
        .limit(query.limit);
      return rows.map((r) => ({ ...r.message, reply: r.reply }));
    },

    /** Atomically claims a message for AI processing; returns false if it is not in an allowed state. */
    async markProcessing(id: string, from: MessageStatus[]): Promise<boolean> {
      const rows = await db
        .update(messages)
        .set({ status: "processing", aiError: null })
        .where(and(eq(messages.id, id), inArray(messages.status, from)))
        .returning({ id: messages.id });
      return rows.length > 0;
    },

    async markFailed(id: string, aiError: string): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.update(messages).set({ status: "failed", aiError }).where(eq(messages.id, id));
        await tx
          .insert(messageEvents)
          .values({ messageId: id, type: "ai_failed", actor: "ai", details: { error: aiError } });
      });
    },

    /**
     * Stores classification + draft and moves the message to draft_ready in one transaction.
     * Regenerating overwrites the reply, so the text it replaces is kept in the history.
     */
    async saveAiResult(id: string, result: AiResult): Promise<void> {
      await db.transaction(async (tx) => {
        const [previous] = await tx.select({ body: replies.body }).from(replies).where(eq(replies.messageId, id));

        await tx
          .update(messages)
          .set({
            category: result.category,
            categoryConfidence: result.categoryConfidence,
            categorySource: result.categorySource,
            status: "draft_ready",
            aiError: null,
          })
          .where(eq(messages.id, id));

        const reply = {
          aiDraft: result.draft,
          body: result.draft,
          model: result.model,
          promptVersion: result.promptVersion,
          approvedAt: null,
        };
        await tx
          .insert(replies)
          .values({ messageId: id, ...reply })
          .onConflictDoUpdate({ target: replies.messageId, set: reply });

        await tx.insert(messageEvents).values({
          messageId: id,
          type: "ai_draft_created",
          actor: "ai",
          oldValue: previous?.body ?? null,
          newValue: result.draft,
          details: {
            model: result.model,
            promptVersion: result.promptVersion,
            category: result.category,
            confidence: result.categoryConfidence,
          },
        });
      });
    },

    async updateCategory(id: string, category: Category): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ category: messages.category })
          .from(messages)
          .where(and(eq(messages.id, id), inArray(messages.status, ["draft_ready", "failed"])))
          .for("update");
        if (!locked) return false;
        await tx
          .update(messages)
          .set({ category, categorySource: "human", categoryConfidence: null })
          .where(eq(messages.id, id));
        if (locked.category !== category) {
          await tx.insert(messageEvents).values({
            messageId: id,
            type: "category_changed",
            actor: "agent",
            oldValue: locked.category,
            newValue: category,
          });
        }
        return true;
      });
    },

    async updateReplyBody(messageId: string, body: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ status: messages.status })
          .from(messages)
          .where(eq(messages.id, messageId))
          .for("update");
        if (locked?.status !== "draft_ready") return false;
        const [current] = await tx.select({ body: replies.body }).from(replies).where(eq(replies.messageId, messageId));
        if (!current) return false;
        await tx.update(replies).set({ body }).where(eq(replies.messageId, messageId));
        if (current.body !== body) {
          await tx.insert(messageEvents).values({
            messageId,
            type: "reply_edited",
            actor: "agent",
            oldValue: current.body,
            newValue: body,
          });
        }
        return true;
      });
    },

    /** Approves the current draft; the status condition makes double-approval impossible. */
    async approve(messageId: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const rows = await tx
          .update(messages)
          .set({ status: "approved" })
          .where(and(eq(messages.id, messageId), eq(messages.status, "draft_ready")))
          .returning({ id: messages.id });
        if (rows.length === 0) return false;
        const [reply] = await tx
          .update(replies)
          .set({ approvedAt: new Date() })
          .where(eq(replies.messageId, messageId))
          .returning({ body: replies.body });
        await tx.insert(messageEvents).values({
          messageId,
          type: "reply_approved",
          actor: "agent",
          newValue: reply?.body ?? null,
        });
        return true;
      });
    },
  };
}

export type MessageRepository = ReturnType<typeof createMessageRepository>;
