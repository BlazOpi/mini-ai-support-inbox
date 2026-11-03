import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  CATEGORIES,
  CATEGORY_SOURCES,
  MESSAGE_EVENT_ACTORS,
  MESSAGE_EVENT_TYPES,
  MESSAGE_STATUSES,
} from "@/lib/domain";

export const messageCategory = pgEnum("message_category", CATEGORIES);
export const messageStatus = pgEnum("message_status", MESSAGE_STATUSES);
export const categorySource = pgEnum("category_source", CATEGORY_SOURCES);
export const messageEventType = pgEnum("message_event_type", MESSAGE_EVENT_TYPES);
export const messageEventActor = pgEnum("message_event_actor", MESSAGE_EVENT_ACTORS);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Every table enables RLS without adding policies. The app connects as the table owner, which
 * RLS doesn't apply to, while Supabase's public Data API (the anon and authenticated roles) can
 * read and change nothing. Without this, anyone with the project's public key could read messages.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** First message of the conversation this one continues; null on the first message itself. */
    threadId: uuid("thread_id").references((): AnyPgColumn => messages.id, { onDelete: "cascade" }),
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
    index("messages_thread_id_idx").on(t.threadId),
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

/**
 * History of every change to a message, written in the same transaction as the change, so the
 * two can't disagree. `old_value` and `new_value` keep the text exactly as it was, so a replaced
 * draft can still be read here. Rows are deleted with their message, so erasing a customer's
 * message (GDPR) erases its history too.
 */
export const messageEvents = pgTable(
  "message_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    type: messageEventType("type").notNull(),
    actor: messageEventActor("actor").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("message_events_message_id_created_at_idx").on(t.messageId, t.createdAt)],
).enableRLS();

export type MessageRow = typeof messages.$inferSelect;
export type ReplyRow = typeof replies.$inferSelect;
export type MessageEventRow = typeof messageEvents.$inferSelect;
