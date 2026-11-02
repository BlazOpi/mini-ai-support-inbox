import { z } from "zod";
import { CATEGORIES, type Category } from "@/lib/domain";

/** Structured output contract for classification — validated again after the provider parses it. */
export const classificationSchema = z.object({
  category: z.enum(CATEGORIES),
  confidence: z.number().min(0).max(1),
});
export type Classification = z.infer<typeof classificationSchema>;

export interface DraftReplyInput {
  message: string;
  category: Category;
  customerName?: string | null;
}

/**
 * Provider-agnostic LLM port. The service layer only depends on this interface,
 * so swapping Claude ↔ OpenAI ↔ mock (tests, local dev) is a config change.
 */
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  classify(message: string): Promise<Classification>;
  draftReply(input: DraftReplyInput): Promise<string>;
}
