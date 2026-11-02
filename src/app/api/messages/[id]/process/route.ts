import { apiHandler, messageIdFrom } from "@/server/api";
import { getContainer } from "@/server/container";
import { enforceRateLimit, json } from "@/server/http";

/** POST /api/messages/:id/process — retry after an AI failure or regenerate an unapproved draft. */
export const POST = apiHandler<RouteContext<"/api/messages/[id]/process">>(async (request, ctx) => {
  const id = await messageIdFrom(ctx);
  const { messageService, aiRateLimiter } = getContainer();
  enforceRateLimit(aiRateLimiter, request, "ai");
  return json({ data: await messageService.process(id) });
});
