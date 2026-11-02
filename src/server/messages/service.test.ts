import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextCustomerReply, SCENARIOS, startScenario } from "@/lib/scenarios";
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
  let repo: ReturnType<typeof createMessageRepository>;
  let reportError: ReturnType<typeof vi.fn<ErrorReporter>>;

  const build = (llm: LLMProvider = stubProvider(), now?: () => number): MessageService =>
    createMessageService({ repo, llm, reportError, now });

  beforeEach(async () => {
    const testDb = await createTestDb();
    close = testDb.close;
    repo = createMessageRepository(testDb.db);
    reportError = vi.fn<ErrorReporter>();
  });

  afterEach(async () => {
    await close();
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
