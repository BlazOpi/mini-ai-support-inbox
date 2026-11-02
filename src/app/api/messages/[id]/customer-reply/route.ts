import { customerReplySchema } from "@/lib/validation";
import { apiHandler, messageIdFrom } from "@/server/api";
import { getContainer } from "@/server/container";
import { enforceRateLimit, json, parseJsonBody } from "@/server/http";

/** POST /api/messages/:id/customer-reply — the customer answers: continues the conversation. Body: { body } */
export const POST = apiHandler<RouteContext<"/api/messages/[id]/customer-reply">>(async (request, ctx) => {
  const id = await messageIdFrom(ctx);
  const { messageService, aiRateLimiter } = getContainer();
  enforceRateLimit(aiRateLimiter, request, "ai");
  const { body } = await parseJsonBody(request, customerReplySchema);
  const message = await messageService.addCustomerReply(id, body);
  return json({ data: message }, { status: 201, headers: { Location: `/api/messages/${message.id}` } });
});
