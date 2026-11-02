import { z } from "zod";
import { CATEGORIES, LIMITS, MESSAGE_STATUSES } from "./domain";

/** Trims and turns empty strings into `undefined` so optional fields stay optional. */
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Največ ${max} znakov.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createMessageSchema = z.object({
  customerName: optionalTrimmed(LIMITS.nameMax),
  customerEmail: optionalTrimmed(LIMITS.emailMax).pipe(
    z.email("Neveljaven e-poštni naslov.").optional(),
  ),
  body: z
    .string({ error: "Sporočilo je obvezno." })
    .trim()
    .min(LIMITS.bodyMin, `Sporočilo mora imeti vsaj ${LIMITS.bodyMin} znake.`)
    .max(LIMITS.bodyMax, `Sporočilo ima lahko največ ${LIMITS.bodyMax} znakov.`),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const updateReplySchema = z.object({
  body: z
    .string({ error: "Odgovor je obvezen." })
    .trim()
    .min(1, "Odgovor ne sme biti prazen.")
    .max(LIMITS.replyMax, `Odgovor ima lahko največ ${LIMITS.replyMax} znakov.`),
});
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;

export const updateCategorySchema = z.object({
  category: z.enum(CATEGORIES, { error: "Neveljavna kategorija." }),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const listMessagesQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional().catch(undefined),
  status: z.enum(MESSAGE_STATUSES).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(100).default(50).catch(50),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const idSchema = z.uuid("Neveljaven ID.");
