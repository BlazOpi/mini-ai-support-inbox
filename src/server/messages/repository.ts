import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Category, CategorySource, MessageStatus } from "@/lib/domain";
import type { CreateMessageInput, ListMessagesQuery } from "@/lib/validation";
import { messages, replies, type MessageRow, type ReplyRow } from "@/server/db/schema";
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
 */
export function createMessageRepository(db: Database) {
  const selectWithReply = () =>
    db
      .select({ message: messages, reply: replies })
      .from(messages)
      .leftJoin(replies, eq(replies.messageId, messages.id));

  return {
    async insert(input: CreateMessageInput): Promise<MessageRow> {
      const [row] = await db
        .insert(messages)
        .values({
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail ?? null,
          body: input.body,
          status: "processing",
        })
        .returning();
      return row;
    },

    async findById(id: string): Promise<MessageWithReply | null> {
      const [row] = await selectWithReply().where(eq(messages.id, id)).limit(1);
      return row ? { ...row.message, reply: row.reply } : null;
    },

    async list(query: ListMessagesQuery): Promise<MessageWithReply[]> {
      const filters: SQL[] = [];
      if (query.category) filters.push(eq(messages.category, query.category));
      if (query.status) filters.push(eq(messages.status, query.status));
      const rows = await selectWithReply()
        .where(filters.length ? and(...filters) : undefined)
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
      await db.update(messages).set({ status: "failed", aiError }).where(eq(messages.id, id));
    },

    /** Stores classification + draft and moves the message to draft_ready in one transaction. */
    async saveAiResult(id: string, result: AiResult): Promise<void> {
      await db.transaction(async (tx) => {
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
      });
    },

    async updateCategory(id: string, category: Category): Promise<boolean> {
      const rows = await db
        .update(messages)
        .set({ category, categorySource: "human", categoryConfidence: null })
        .where(and(eq(messages.id, id), inArray(messages.status, ["draft_ready", "failed"])))
        .returning({ id: messages.id });
      return rows.length > 0;
    },

    async updateReplyBody(messageId: string, body: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ status: messages.status })
          .from(messages)
          .where(eq(messages.id, messageId))
          .for("update");
        if (locked?.status !== "draft_ready") return false;
        const rows = await tx
          .update(replies)
          .set({ body })
          .where(eq(replies.messageId, messageId))
          .returning({ id: replies.id });
        return rows.length > 0;
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
        await tx.update(replies).set({ approvedAt: new Date() }).where(eq(replies.messageId, messageId));
        return true;
      });
    },
  };
}

export type MessageRepository = ReturnType<typeof createMessageRepository>;
