/**
 * Postgres without Docker: starts a real PostgreSQL 16 server (binaries come from the
 * embedded-postgres npm package) with the same port and credentials as docker-compose.yml,
 * so DATABASE_URL from .env.example works with either. Applies the migrations on start.
 * Data stays in ./.pgdata.
 * Usage: npm run db:local   (keep it running next to `npm run dev`, stop with Ctrl+C)
 */
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";

const PORT = 5432;
const DATA_DIR = resolve(".pgdata");

function isPortTaken(): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect(PORT, "localhost");
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

async function main() {
  if (await isPortTaken()) {
    throw new Error(`Port ${PORT} is already in use. Stop the other Postgres first (docker compose stop).`);
  }

  const isNew = !existsSync(join(DATA_DIR, "PG_VERSION"));
  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: "inbox",
    password: "inbox",
    authMethod: "scram-sha-256",
    // Explicit, because on Windows initdb would otherwise inherit the system's legacy encoding.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (isNew) await server.initialise();
  await server.start();

  try {
    if (isNew) await server.createDatabase("inbox");
    const sql = postgres(`postgres://inbox:inbox@localhost:${PORT}/inbox`, { max: 1 });
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    await sql.end();
  } catch (err) {
    await server.stop();
    throw err;
  }

  console.log(`✓ Postgres listening on localhost:${PORT}. Stop with Ctrl+C.`);
}

main().catch((err) => {
  console.error(
    "✗ Local database failed:",
    err instanceof Error ? err.message : "Postgres stopped, see the log above.",
  );
  process.exit(1);
});
