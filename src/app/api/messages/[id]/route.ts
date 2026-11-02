import { updateCategorySchema } from "@/lib/validation";
import { apiHandler, messageIdFrom } from "@/server/api";
import { getContainer } from "@/server/container";
import { json, parseJsonBody } from "@/server/http";

type Ctx = RouteContext<"/api/messages/[id]">;

/** GET /api/messages/:id */
export const GET = apiHandler<Ctx>(async (_request, ctx) => {
  const id = await messageIdFrom(ctx);
  return json({ data: await getContainer().messageService.get(id) });
});

/** PATCH /api/messages/:id — human override of the AI category. Body: { category } */
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const id = await messageIdFrom(ctx);
  const { category } = await parseJsonBody(request, updateCategorySchema);
  return json({ data: await getContainer().messageService.updateCategory(id, category) });
});
