import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/server/env";
import * as schema from "./schema";

/**
 * One small connection pool per server instance. On Supabase, DATABASE_URL should be the
 * transaction pooler (port 6543), which lends a server connection for one transaction at a time,
 * so no query may rely on getting the same connection as the one before it:
 * - `prepare: false`: a prepared statement exists on one connection only.
 * - `max_pipeline: 1`: one query at a time per connection. Supabase warns that the default
 *   pipelining can hang queries or mix up their results through this pooler. 0 is not an option
 *   here: it breaks `sql.begin()`, which every write in this app uses.
 */
const globalForDb = globalThis as unknown as { __inboxDb?: { url: string; sql: postgres.Sql } };

export function createDb() {
  const { DATABASE_URL, NODE_ENV } = getEnv();
  const existing = globalForDb.__inboxDb;

  // Reuse the pool across hot reloads in development, but only for the same database:
  // reusing it after DATABASE_URL changed would keep the app on the old database without saying so.
  if (existing?.url === DATABASE_URL) return drizzle(existing.sql, { schema });
  void existing?.sql.end({ timeout: 5 });

  const sql = postgres(DATABASE_URL, {
    prepare: false,
    max_pipeline: 1,
    max: NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  if (NODE_ENV !== "production") globalForDb.__inboxDb = { url: DATABASE_URL, sql };
  return drizzle(sql, { schema });
}
