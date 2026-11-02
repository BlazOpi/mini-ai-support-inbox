/**
 * Applies SQL migrations from ./drizzle to DATABASE_URL.
 * Usage: npm run db:migrate   (reads .env.local / .env like Next.js does)
 */
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DATABASE_MIGRATION_URL) is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("✓ Migrations applied");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
