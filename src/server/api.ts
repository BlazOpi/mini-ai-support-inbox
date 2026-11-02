import "server-only";
import { idSchema } from "@/lib/validation";
import { reportUnhandled } from "@/server/container";
import { assertSameOrigin, errorResponse, parseWith } from "@/server/http";

/**
 * Wraps a route handler with the cross-cutting concerns every endpoint needs:
 * same-origin check for mutations and uniform error → JSON mapping (+ Sentry for 5xx).
 */
export function apiHandler<Ctx>(fn: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    try {
      assertSameOrigin(request);
      return await fn(request, ctx);
    } catch (err) {
      return errorResponse(err, reportUnhandled);
    }
  };
}

/** Validates the dynamic `[id]` segment before it reaches the database. */
export async function messageIdFrom(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  return parseWith(idSchema, id);
}
