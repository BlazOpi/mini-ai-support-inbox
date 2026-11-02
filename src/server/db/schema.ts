import { index, pgEnum, pgTable, real, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { CATEGORIES, CATEGORY_SOURCES, MESSAGE_STATUSES } from "@/lib/domain";

export const messageCategory = pgEnum("message_category", CATEGORIES);
export const messageStatus = pgEnum("message_status", MESSAGE_STATUSES);
export const categorySource = pgEnum("category_source", CATEGORY_SOURCES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * RLS is enabled without policies: the app connects as the table owner (bypasses RLS),
 * while Supabase's public Data API (anon / authenticated roles) gets no access at all.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerName: varchar("customer_name", { length: 120 }),
    customerEmail: varchar("customer_email", { length: 254 }),
    body: text("body").notNull(),
    category: messageCategory("category"),
    categoryConfidence: real("category_confidence"),
    categorySource: categorySource("category_source"),
    status: messageStatus("status").notNull().default("processing"),
    aiError: text("ai_error"),
    ...timestamps,
  },
  (t) => [
    index("messages_created_at_idx").on(t.createdAt.desc()),
    index("messages_category_idx").on(t.category),
    index("messages_status_idx").on(t.status),
  ],
).enableRLS();

export const replies = pgTable("replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .unique()
    .references(() => messages.id, { onDelete: "cascade" }),
  aiDraft: text("ai_draft").notNull(),
  body: text("body").notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 20 }).notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ...timestamps,
}).enableRLS();

export type MessageRow = typeof messages.$inferSelect;
export type ReplyRow = typeof replies.$inferSelect;
