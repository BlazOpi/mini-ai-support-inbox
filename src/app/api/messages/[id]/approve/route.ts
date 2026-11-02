import { apiHandler, messageIdFrom } from "@/server/api";
import { getContainer } from "@/server/container";
import { json } from "@/server/http";

/** POST /api/messages/:id/approve — lock the current draft as the approved reply. */
export const POST = apiHandler<RouteContext<"/api/messages/[id]/approve">>(async (_request, ctx) => {
  const id = await messageIdFrom(ctx);
  return json({ data: await getContainer().messageService.approve(id) });
});
