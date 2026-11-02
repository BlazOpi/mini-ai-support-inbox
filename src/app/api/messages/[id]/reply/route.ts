import { updateReplySchema } from "@/lib/validation";
import { apiHandler, messageIdFrom } from "@/server/api";
import { getContainer } from "@/server/container";
import { json, parseJsonBody } from "@/server/http";

/** PATCH /api/messages/:id/reply — save a human edit of the draft. Body: { body } */
export const PATCH = apiHandler<RouteContext<"/api/messages/[id]/reply">>(async (request, ctx) => {
  const id = await messageIdFrom(ctx);
  const { body } = await parseJsonBody(request, updateReplySchema);
  return json({ data: await getContainer().messageService.updateReply(id, body) });
});
