import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { idSchema, listMessagesQuerySchema } from "@/lib/validation";
import { MockProvider } from "@/server/llm/mock";
import { createMessageRepository } from "@/server/messages/repository";
import { createMessageService } from "@/server/messages/service";
import * as schema from "./schema";
import type { Database } from "./types";
import { buildSupabaseSetupSql } from "./supabase-setup-sql";

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const TABLES = ["messages", "replies", "message_events"];
const OPEN_TICKET = "10000000-0000-4000-8000-000000000001";

const setupFile = () => readFileSync("supabase/setup.sql", "utf8").replace(/\r\n/g, "\n");

describe("supabase/setup.sql", () => {
  let client: PGlite;

  const count = async (table: string) =>
    (await client.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
  const counts = () => Promise.all(TABLES.map(count));
  const service = () =>
    createMessageService({
      repo: createMessageRepository(drizzle(client, { schema }) as unknown as Database),
      llm: new MockProvider(),
    });

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(setupFile());
  });

  afterEach(async () => {
    await client.close();
  });

  it("matches the migrations and demo data (otherwise run `npm run db:supabase-sql`)", () => {
    expect(setupFile()).toBe(buildSupabaseSetupSql());
  });

  it("counts as migrated, so db:migrate doesn't try to create the tables again", async () => {
    const before = await count("drizzle.__drizzle_migrations");
    expect(before).toBeGreaterThan(0);

    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

    expect(await count("drizzle.__drizzle_migrations")).toBe(before);
  });

  it("stops on a second run and leaves the data alone", async () => {
    const before = await counts();

    await expect(client.exec(setupFile())).rejects.toThrow("already exist");
    await client.exec("rollback");

    expect(await counts()).toEqual(before);
  });

  it("hides every table from Supabase's public Data API", async () => {
    // Supabase grants these roles full table privileges by default, so only RLS stands in the way.
    await client.exec(`
      create role anon;
      grant usage on schema public to anon;
      grant all on all tables in schema public to anon;
      set role anon;
    `);

    expect(await counts()).toEqual([0, 0, 0]);
    await expect(client.query("insert into messages (body) values ('x')")).rejects.toThrow("row-level security");

    await client.exec("reset role");
    expect(await count("messages")).toBeGreaterThan(0);
  });

  describe("demo data", () => {
    it("has open tickets the app can show and open", async () => {
      const inbox = await service().list(listMessagesQuerySchema.parse({}));

      expect(inbox.filter((m) => m.status === "draft_ready").length).toBeGreaterThanOrEqual(5);
      expect(inbox.some((m) => m.status === "failed")).toBe(true);
      expect(inbox.some((m) => m.status === "approved")).toBe(true);
      for (const message of inbox) {
        expect(idSchema.safeParse(message.id).success).toBe(true);
        if (message.status === "draft_ready" || message.status === "approved") expect(message.reply).not.toBeNull();
      }
    });

    it("shows a conversation once, with the earlier exchange available", async () => {
      const inbox = await service().list(listMessagesQuerySchema.parse({}));
      const followUp = inbox.find((m) => m.threadId !== null);

      expect(followUp).toBeDefined();
      expect(inbox.some((m) => m.id === followUp?.threadId)).toBe(false);
      expect(await service().getThread(followUp!.id)).toHaveLength(2);
    });

    it("starts with a history for every message", async () => {
      const { rows } = await client.query<{ type: string; old_value: string | null; new_value: string | null }>(
        "select type, old_value, new_value from message_events",
      );
      const types = rows.map((r) => r.type);

      for (const type of [
        "message_received",
        "customer_replied",
        "ai_draft_created",
        "ai_failed",
        "category_changed",
        "reply_edited",
        "reply_approved",
      ]) {
        expect(types).toContain(type);
      }
      const edit = rows.find((r) => r.type === "reply_edited");
      expect(edit?.old_value).not.toBe(edit?.new_value);
    });

    it("adds nothing when the seed file runs again", async () => {
      const before = await counts();

      await client.exec(readFileSync("supabase/seed.sql", "utf8"));

      expect(await counts()).toEqual(before);
    });

    it("logs what an agent does to a demo ticket", async () => {
      const before = await count("message_events");

      await service().updateReply(OPEN_TICKET, "Urejen odgovor");
      await service().approve(OPEN_TICKET);

      expect(await count("message_events")).toBe(before + 2);
    });
  });
});
