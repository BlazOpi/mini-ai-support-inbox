import { asc, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextCustomerReply, SCENARIOS, startScenario } from "@/lib/scenarios";
import { messageEvents } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { ConflictError, LLMError, NotFoundError } from "@/server/errors";
import { MockProvider } from "@/server/llm/mock";
import type { LLMProvider } from "@/server/llm/types";
import { createTestDb } from "../../../tests/test-db";
import { createMessageRepository } from "./repository";
import { createMessageService, STALE_PROCESSING_MS, type ErrorReporter, type MessageService } from "./service";

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

/** Provider whose behaviour each test can override. */
function stubProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  const mock = new MockProvider();
  return {
    name: "stub",
    model: "stub-1",
    classify: (m) => mock.classify(m),
    draftReply: (i) => mock.draftReply(i),
    ...overrides,
  };
}

describe("message service", () => {
  let close: () => Promise<void>;
  let db: Database;
  let repo: ReturnType<typeof createMessageRepository>;
  let reportError: ReturnType<typeof vi.fn<ErrorReporter>>;

  const build = (llm: LLMProvider = stubProvider(), now?: () => number): MessageService =>
    createMessageService({ repo, llm, reportError, now });

  beforeEach(async () => {
    const testDb = await createTestDb();
    close = testDb.close;
    db = testDb.db;
    repo = createMessageRepository(db);
    reportError = vi.fn<ErrorReporter>();
  });

  afterEach(async () => {
    await close();
  });

  describe("change history", () => {
    const history = (messageId: string) =>
      db
        .select()
        .from(messageEvents)
        .where(eq(messageEvents.messageId, messageId))
        .orderBy(asc(messageEvents.createdAt));

    it("records an incoming message word for word, then the AI's draft", async () => {
      const message = await build().create({ body: "Kdaj bo dostava?  " });

      const [received, draft] = await history(message.id);

      expect(received).toMatchObject({ type: "message_received", actor: "customer", newValue: message.body });
      expect(draft).toMatchObject({ type: "ai_draft_created", actor: "ai", oldValue: null });
      expect(draft.newValue).toBe(message.reply?.body);
      expect(draft.details).toMatchObject({ model: "stub/stub-1", category: message.category });
    });

    it("records the customer's reply word for word", async () => {
      const service = build();
      const first = await service.create({ body: "Kdaj bo dostava?" });
      await service.approve(first.id);

      const second = await service.addCustomerReply(first.id, "Paket je poškodovan.");

      expect((await history(second.id))[0]).toMatchObject({
        type: "customer_replied",
        actor: "customer",
        newValue: "Paket je poškodovan.",
      });
    });

    it("records an edit with the text before and after, and nothing if the text didn't change", async () => {
      const service = build();
      const message = await service.create({ body: "Kdaj bo dostava?" });
      const original = message.reply?.body;

      await service.updateReply(message.id, "Urejen odgovor");
      await service.updateReply(message.id, "Urejen odgovor");

      const edits = (await history(message.id)).filter((e) => e.type === "reply_edited");
      expect(edits).toHaveLength(1);
      expect(edits[0]).toMatchObject({ actor: "agent", oldValue: original, newValue: "Urejen odgovor" });
    });

    it("records the exact text of an approved reply", async () => {
      const service = build();
      const message = await service.create({ body: "Kdaj bo dostava?" });
      await service.updateReply(message.id, "Končni odgovor");

      await service.approve(message.id);

      const events = await history(message.id);
      expect(events[events.length - 1]).toMatchObject({
        type: "reply_approved",
        actor: "agent",
        newValue: "Končni odgovor",
      });
    });

    it("records a category correction, and nothing if the category stays the same", async () => {
      const service = build();
      const message = await service.create({ body: "Kdaj bo dostava?" });
      const original = message.category;
      const corrected = original === "praise" ? "other" : "praise";

      await service.updateCategory(message.id, corrected);
      await service.updateCategory(message.id, corrected);

      const changes = (await history(message.id)).filter((e) => e.type === "category_changed");
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ actor: "agent", oldValue: original, newValue: corrected });
    });

    it("keeps the text that regenerating a draft replaces", async () => {
      const service = build();
      const message = await service.create({ body: "Kdaj bo dostava?" });
      await service.updateReply(message.id, "Ročno napisan odgovor");

      await service.process(message.id);

      const events = await history(message.id);
      expect(events[events.length - 1]).toMatchObject({
        type: "ai_draft_created",
        oldValue: "Ročno napisan odgovor",
      });
    });

    it("records an AI failure with the user-safe reason", async () => {
      const llm = stubProvider({
        classify: async () => {
          throw new LLMError("AI storitev ni dosegljiva.");
        },
      });

      const message = await build(llm).create({ body: "Kdaj bo dostava?" });

      const events = await history(message.id);
      expect(events[events.length - 1]).toMatchObject({
        type: "ai_failed",
        actor: "ai",
        details: { error: "AI storitev ni dosegljiva." },
      });
    });

    it("returns the whole conversation's history for the app to show, oldest first", async () => {
      const service = build();
      const first = await service.create({ body: "Kdaj bo dostava?" });
      await service.updateReply(first.id, "Urejen odgovor");
      await service.approve(first.id);
      const second = await service.addCustomerReply(first.id, "Hvala!");

      const types = ["message_received", "ai_draft_created", "reply_edited", "reply_approved"];
      const expected = [...types, "customer_replied", "ai_draft_created"];
      expect((await service.getHistory(first.id)).map((e) => e.type)).toEqual(expected);
      expect((await service.getHistory(second.id)).map((e) => e.type)).toEqual(expected);
    });

    it("gives the app the safe reason an AI step failed", async () => {
      const llm = stubProvider({
        classify: async () => {
          throw new LLMError("AI storitev ni dosegljiva.");
        },
      });
      const message = await build(llm).create({ body: "Kdaj bo dostava?" });

      const history = await build(llm).getHistory(message.id);

      expect(history[history.length - 1]).toMatchObject({ type: "ai_failed", error: "AI storitev ni dosegljiva." });
    });

    it("doesn't keep a change if its history row can't be written", async () => {
      const service = build();
      const message = await service.create({ body: "Kdaj bo dostava?" });
      await db.execute(sql`drop table message_events`);

      await expect(service.updateReply(message.id, "Urejen odgovor")).rejects.toThrow();

      expect((await service.get(message.id)).reply?.body).toBe(message.reply?.body);
    });
  });

  describe("conversations", () => {
    it("continues the thread with the earlier exchange as context for the draft", async () => {
      const draftReply = vi.fn<LLMProvider["draftReply"]>(async () => "Osnutek");
      const service = build(stubProvider({ draftReply }));

      const first = await service.create({
        body: "Kdaj bo dostava?",
        customerName: "Ana",
        customerEmail: "a@example.com",
      });
      await service.updateReply(first.id, "Urejen odgovor agenta");
      await service.approve(first.id);
      const second = await service.addCustomerReply(first.id, "Paket je poškodovan.");

      expect(second.threadId).toBe(first.id);
      expect(second.customerName).toBe("Ana");
      expect(second.customerEmail).toBe("a@example.com");
      expect(second.status).toBe("draft_ready");
      expect(draftReply).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: "Paket je poškodovan.",
          history: [{ customerMessage: "Kdaj bo dostava?", agentReply: "Urejen odgovor agenta" }],
        }),
      );
    });

    it("does not let the customer reply while the last draft is unapproved", async () => {
      const service = build();
      const first = await service.create({ body: "Kdaj bo dostava?" });

      await expect(service.addCustomerReply(first.id, "Halo?")).rejects.toBeInstanceOf(ConflictError);

      await service.approve(first.id);
      await service.addCustomerReply(first.id, "Halo?");
      // The first message is approved, but its thread now has an open draft.
      await expect(service.addCustomerReply(first.id, "Še vedno nič?")).rejects.toBeInstanceOf(ConflictError);
    });

    it("lists one row per conversation and returns the whole thread from any of its messages", async () => {
      const service = build();
      const first = await service.create({ body: "Kdaj bo dostava?" });
      await service.approve(first.id);
      const second = await service.addCustomerReply(first.id, "Paket je poškodovan.");
      const other = await service.create({ body: "Hvala za vse." });

      const listed = await service.list({ limit: 50 });
      expect(listed.map((m) => m.id)).toEqual([other.id, second.id]);
      expect((await service.list({ limit: 50, category: "question" })).map((m) => m.id)).toEqual([]);

      for (const id of [first.id, second.id]) {
        expect((await service.getThread(id)).map((m) => m.id)).toEqual([first.id, second.id]);
      }
    });

    it.each(SCENARIOS)("plays the $title scenario from start to end", async (scenario) => {
      const service = build();
      const sample = startScenario(scenario);
      let current = await service.create(sample);
      const said = [sample.body];

      for (const [index, turn] of scenario.turns.entries()) {
        expect(current.status).toBe("draft_ready");
        expect(current.category).toBe(turn.expectedCategory);
        expect(current.reply?.body).toContain(sample.customerName);
        await service.approve(current.id);

        const next = nextCustomerReply(said);
        if (index === scenario.turns.length - 1) {
          expect(next).toBeNull();
        } else {
          said.push(next as string);
          current = await service.addCustomerReply(current.id, next as string);
        }
      }

      expect(await service.getThread(current.id)).toHaveLength(scenario.turns.length);
      expect(await service.list({ limit: 50 })).toHaveLength(1);
    });
  });

  it("stores the message, classifies it and drafts a reply", async () => {
    const service = build();
    const message = await service.create({
      body: "Paket je prispel pokvarjen, zelo sem razočarana.",
      customerName: "Ana",
    });

    expect(message.status).toBe("draft_ready");
    expect(message.category).toBe("complaint");
    expect(message.categorySource).toBe("ai");
    expect(message.reply?.body).toContain("Pozdravljeni, Ana");
    expect(message.reply?.aiDraft).toBe(message.reply?.body);
    expect(message.reply?.model).toBe("stub/stub-1");
    expect(message.reply?.edited).toBe(false);
  });

  it("keeps the message and marks it failed when the LLM fails", async () => {
    const service = build(
      stubProvider({
        classify: async () => {
          throw new LLMError("AI storitev trenutno ni dosegljiva.");
        },
      }),
    );

    const message = await service.create({ body: "Kdaj odprete trgovino?" });

    expect(message.status).toBe("failed");
    expect(message.aiError).toBe("AI storitev trenutno ni dosegljiva.");
    expect(message.reply).toBeNull();
    expect(reportError).toHaveBeenCalledOnce();
    expect((await service.list({ limit: 10 })).map((m) => m.id)).toContain(message.id);
  });

  it("does not leak internal error details for unexpected failures", async () => {
    const service = build(
      stubProvider({
        draftReply: async () => {
          throw new Error("ECONNRESET 10.0.0.12:5432 secret-internal-detail");
        },
      }),
    );
    const message = await service.create({ body: "Kako lahko spremenim naslov?" });
    expect(message.status).toBe("failed");
    expect(message.aiError).toBe("Nepričakovana napaka pri AI obdelavi.");
  });

  it("can retry a failed message", async () => {
    let fail = true;
    const mock = new MockProvider();
    const service = build(
      stubProvider({
        classify: async (m) => {
          if (fail) throw new LLMError("Časovna omejitev.");
          return mock.classify(m);
        },
      }),
    );
    const failed = await service.create({ body: "Kako lahko vrnem izdelek?" });
    expect(failed.status).toBe("failed");

    fail = false;
    const retried = await service.process(failed.id);
    expect(retried.status).toBe("draft_ready");
    expect(retried.aiError).toBeNull();
    expect(retried.reply).not.toBeNull();
  });

  it("tracks human edits and approves the edited reply", async () => {
    const service = build();
    const created = await service.create({ body: "Hvala za odlično storitev!" });

    const edited = await service.updateReply(created.id, "Najlepša hvala, veseli nas!");
    expect(edited.reply?.body).toBe("Najlepša hvala, veseli nas!");
    expect(edited.reply?.edited).toBe(true);
    expect(edited.reply?.aiDraft).toBe(created.reply?.aiDraft);

    const approved = await service.approve(created.id);
    expect(approved.status).toBe("approved");
    expect(approved.reply?.approvedAt).not.toBeNull();
  });

  it("locks the reply after approval", async () => {
    const service = build();
    const created = await service.create({ body: "Kdaj bo paket dostavljen?" });
    await service.approve(created.id);

    await expect(service.approve(created.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.updateReply(created.id, "spremenjeno")).rejects.toBeInstanceOf(ConflictError);
    await expect(service.process(created.id)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.updateCategory(created.id, "other")).rejects.toBeInstanceOf(ConflictError);
  });

  it("keeps a human-corrected category when regenerating the draft", async () => {
    const classify = vi.fn(async () => ({ category: "question" as const, confidence: 0.9 }));
    const service = build(stubProvider({ classify }));
    const created = await service.create({ body: "Ali imate tudi trgovino v Mariboru?" });

    const corrected = await service.updateCategory(created.id, "complaint");
    expect(corrected.categorySource).toBe("human");

    const regenerated = await service.process(created.id);
    expect(regenerated.category).toBe("complaint");
    expect(regenerated.categorySource).toBe("human");
    expect(classify).toHaveBeenCalledTimes(1); // not re-classified
  });

  it("rejects processing a message that is already being processed, unless it is stale", async () => {
    let clock = Date.now();
    const service = build(stubProvider(), () => clock);
    const row = await repo.insert({ body: "Kako se registriram?" }); // stuck in "processing"

    await expect(service.process(row.id)).rejects.toBeInstanceOf(ConflictError);

    clock += STALE_PROCESSING_MS + 1_000;
    const recovered = await service.process(row.id);
    expect(recovered.status).toBe("draft_ready");
  });

  it("filters history by category and status", async () => {
    const service = build();
    await service.create({ body: "Paket je pokvarjen!" });
    const question = await service.create({ body: "Kdaj ste odprti?" });
    await service.approve(question.id);

    expect((await service.list({ category: "complaint", limit: 50 })).length).toBe(1);
    expect((await service.list({ status: "approved", limit: 50 })).map((m) => m.id)).toEqual([question.id]);
    expect((await service.list({ limit: 50 })).length).toBe(2);
  });

  it("throws NotFoundError for unknown ids", async () => {
    await expect(build().get("00000000-0000-4000-8000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });
});
