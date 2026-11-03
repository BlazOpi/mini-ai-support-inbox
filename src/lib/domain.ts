/**
 * Domain constants and DTO types shared by the server and the browser.
 * Keep this file free of server-only imports.
 */

export const CATEGORIES = ["question", "complaint", "praise", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const MESSAGE_STATUSES = ["processing", "draft_ready", "approved", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const CATEGORY_SOURCES = ["ai", "human"] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];

/** What can happen to a message; each change adds one row to the `message_events` history table. */
export const MESSAGE_EVENT_TYPES = [
  "message_received",
  "customer_replied",
  "ai_draft_created",
  "ai_failed",
  "category_changed",
  "reply_edited",
  "reply_approved",
] as const;
export type MessageEventType = (typeof MESSAGE_EVENT_TYPES)[number];

/** Who caused a change. There are no per-agent accounts yet, so every human action is "agent". */
export const MESSAGE_EVENT_ACTORS = ["customer", "ai", "agent"] as const;
export type MessageEventActor = (typeof MESSAGE_EVENT_ACTORS)[number];

export const EVENT_LABELS: Record<MessageEventType, string> = {
  message_received: "Sporočilo prejeto",
  customer_replied: "Stranka je odgovorila",
  ai_draft_created: "AI je pripravil osnutek",
  ai_failed: "AI obdelava ni uspela",
  category_changed: "Kategorija popravljena",
  reply_edited: "Osnutek urejen",
  reply_approved: "Odgovor potrjen",
};

export const ACTOR_LABELS: Record<MessageEventActor, string> = {
  customer: "Stranka",
  ai: "AI",
  agent: "Agent",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  question: "Vprašanje",
  complaint: "Pritožba",
  praise: "Pohvala",
  other: "Drugo",
};

export const STATUS_LABELS: Record<MessageStatus, string> = {
  processing: "V obdelavi",
  draft_ready: "Osnutek pripravljen",
  approved: "Potrjeno",
  failed: "Napaka AI",
};

/** Input limits — enforced by zod on the server and mirrored in the form. */
export const LIMITS = {
  nameMax: 120,
  emailMax: 254,
  bodyMin: 3,
  bodyMax: 5000,
  replyMax: 8000,
} as const;

interface ReplyDto {
  id: string;
  /** Original text produced by the LLM — kept to measure how much humans edit. */
  aiDraft: string;
  /** Current (possibly human-edited) text. */
  body: string;
  model: string;
  promptVersion: string;
  edited: boolean;
  approvedAt: string | null;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  /** First message of the conversation this one continues; null on the first message itself. */
  threadId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  body: string;
  category: Category | null;
  categoryConfidence: number | null;
  categorySource: CategorySource | null;
  status: MessageStatus;
  aiError: string | null;
  createdAt: string;
  updatedAt: string;
  reply: ReplyDto | null;
}

/** One entry of a conversation's change log. */
export interface MessageEventDto {
  id: string;
  type: MessageEventType;
  actor: MessageEventActor;
  /** Text before and after the change, exactly as it was. */
  oldValue: string | null;
  newValue: string | null;
  /** Why the AI step failed; only set on `ai_failed`, and always safe to show. */
  error: string | null;
  createdAt: string;
}

/** How many AI requests this client has left; the server's rate limiter is the source of truth. */
export interface AiQuotaDto {
  limit: number;
  remaining: number;
  /** Seconds until the counter refills; 0 when no request was used in the current window. */
  resetInSeconds: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
