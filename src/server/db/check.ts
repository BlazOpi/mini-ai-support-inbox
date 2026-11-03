/**
 * Tests the database in DATABASE_URL: connection, tables, migrations, reading and writing.
 * The test write is rolled back, so nothing is left behind.
 * Usage: npm run db:check   (reads .env.local / .env like Next.js does)
 */
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const TABLES = ["message_events", "messages", "replies"];
const TEST_TEXT = "db:check test, rolled back";

/** Thrown on purpose to undo the test write. */
class UndoTestWrite extends Error {}

let failed = false;

function report(ok: boolean, label: string, detail = "") {
  if (!ok) failed = true;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local, or uncomment it there.");

  const { hostname, port } = new URL(url);
  console.log(`Testing ${hostname}:${port}`);

  // The same client options as the app (src/server/db/client.ts), so this tests what the app will use.
  const sql = postgres(url, { prepare: false, max_pipeline: 1, max: 1, connect_timeout: 15, onnotice: () => {} });
  try {
    const [server] = await sql`select split_part(version(), ' ', 2) as version`;
    report(true, "Connection", `Postgres ${server.version}`);

    const tables = await sql`select tablename from pg_tables where schemaname = 'public'`;
    const missing = TABLES.filter((name) => !tables.some((t) => t.tablename === name));
    report(missing.length === 0, "Tables", missing.length ? `missing ${missing.join(", ")}` : TABLES.join(", "));
    if (missing.length > 0) {
      console.log("  Run `npm run db:migrate` to create them.");
      return;
    }

    const expected = (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] }).entries;
    const [applied] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    report(applied.n === expected.length, "Migrations", `${applied.n} of ${expected.length} applied`);

    const [rows] = await sql`
      select (select count(*)::int from messages) as messages,
             (select count(*)::int from replies) as replies,
             (select count(*)::int from message_events) as events`;
    report(true, "Reading", `${rows.messages} messages, ${rows.replies} replies, ${rows.events} history entries`);

    let wrote = false;
    await sql
      .begin(async (tx) => {
        const [message] = await tx`insert into messages (body) values (${TEST_TEXT}) returning id`;
        await tx`insert into message_events (message_id, type, actor, new_value)
                 values (${message.id}, 'message_received', 'customer', ${TEST_TEXT})`;
        wrote = true;
        throw new UndoTestWrite();
      })
      .catch((err: unknown) => {
        if (!(err instanceof UndoTestWrite)) throw err;
      });
    const [left] = await sql`select count(*)::int as n from messages where body = ${TEST_TEXT}`;
    report(wrote && left.n === 0, "Writing", wrote ? "works, and the test row was undone" : "failed");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .catch((err) => {
    report(false, "Database", err instanceof Error ? err.message : String(err));
  })
  .finally(() => {
    console.log(failed ? "\nThe database is NOT ready." : "\nThe database works.");
    process.exitCode = failed ? 1 : 0;
  });
