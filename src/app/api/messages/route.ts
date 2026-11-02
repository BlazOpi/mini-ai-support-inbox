import { createMessageSchema, listMessagesQuerySchema } from "@/lib/validation";
import { apiHandler } from "@/server/api";
import { getContainer } from "@/server/container";
import { enforceRateLimit, json, parseJsonBody, parseWith } from "@/server/http";

/** GET /api/messages?category=&status=&limit= — message history, newest first. */
export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const query = parseWith(listMessagesQuerySchema, Object.fromEntries(searchParams));
  const messages = await getContainer().messageService.list(query);
  return json({ data: messages });
});

/**
 * POST /api/messages — stores a customer message, classifies it and drafts a reply.
 * Responds 201 even if the AI step fails: the message is saved with status "failed" and can be retried.
 */
export const POST = apiHandler(async (request) => {
  const { messageService, aiRateLimiter } = getContainer();
  enforceRateLimit(aiRateLimiter, request, "ai");
  const input = await parseJsonBody(request, createMessageSchema);
  const message = await messageService.create(input);
  return json({ data: message }, { status: 201, headers: { Location: `/api/messages/${message.id}` } });
});
