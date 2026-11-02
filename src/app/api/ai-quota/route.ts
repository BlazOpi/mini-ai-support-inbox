import type { AiQuotaDto } from "@/lib/domain";
import { apiHandler } from "@/server/api";
import { getContainer } from "@/server/container";
import { json, rateLimitStatus } from "@/server/http";

/** GET /api/ai-quota — AI requests this client has left in the current window. Does not use one up. */
export const GET = apiHandler(async (request) => {
  const quota: AiQuotaDto = rateLimitStatus(getContainer().aiRateLimiter, request, "ai");
  return json({ data: quota }, { headers: { "Cache-Control": "no-store" } });
});
