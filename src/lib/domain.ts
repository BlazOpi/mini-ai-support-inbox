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

export interface ReplyDto {
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

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
