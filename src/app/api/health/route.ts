import { connection } from "next/server";
import { getContainer } from "@/server/container";
import { logger } from "@/server/logger";

/** GET /api/health — liveness + database connectivity (public, reveals no configuration). */
export async function GET() {
  await connection(); // always evaluate at request time, never prerender
  try {
    await getContainer().pingDatabase();
    return Response.json({ status: "ok", database: "ok" });
  } catch (err) {
    logger.error("health.database_unreachable", { err });
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
