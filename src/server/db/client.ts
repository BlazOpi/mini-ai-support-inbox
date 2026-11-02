import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/server/env";
import * as schema from "./schema";

/**
 * Single connection pool per server instance. On serverless (Vercel) each instance keeps
 * a tiny pool; use Supabase's transaction pooler URL (port 6543) for DATABASE_URL.
 * `prepare: false` is required by PgBouncer-style transaction poolers.
 */
const globalForDb = globalThis as unknown as { __inboxSql?: postgres.Sql };

export function createDb() {
  const { DATABASE_URL, NODE_ENV } = getEnv();
  const sql =
    globalForDb.__inboxSql ??
    postgres(DATABASE_URL, {
      prepare: false,
      max: NODE_ENV === "production" ? 3 : 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  // Reuse the pool across hot reloads in development.
  if (NODE_ENV !== "production") globalForDb.__inboxSql = sql;
  return drizzle(sql, { schema });
}
