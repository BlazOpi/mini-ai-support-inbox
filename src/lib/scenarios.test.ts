import { describe, expect, it } from "vitest";
import { nextCustomerReply, pickScenario, SCENARIOS, startScenario } from "./scenarios";
import { createMessageSchema } from "./validation";

// Walks a fixed random source over [0, 1) so every customer and product gets picked.
const randoms = Array.from({ length: 100 }, (_, i) => () => i / 100);

describe("scenarios", () => {
  it("have unique ids and at least one follow-up", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    expect(SCENARIOS.every((s) => s.turns.length >= 2)).toBe(true);
  });

  it.each(SCENARIOS)("$title starts with a valid message and no leftover placeholders", (scenario) => {
    for (const random of randoms) {
      const sample = startScenario(scenario, random);
      expect(() => createMessageSchema.parse(sample)).not.toThrow();
      expect(sample.body).not.toMatch(/\{\w+\}/);
    }
  });

  it("uses ASCII example.com addresses for customers with diacritics", () => {
    const emails = randoms.map((random) => startScenario(SCENARIOS[0], random).customerEmail);
    expect(emails).toContain("marko.kovac@example.com");
    expect(emails.every((email) => /^[a-z.]+@example\.com$/.test(email))).toBe(true);
  });

  it("can pick every scenario at random", () => {
    expect(new Set(randoms.map((random) => pickScenario(random).id)).size).toBe(SCENARIOS.length);
  });
});

describe("nextCustomerReply", () => {
  it.each(SCENARIOS)("$title plays all its turns, then ends", (scenario) => {
    const said = [startScenario(scenario).body];
    for (const turn of scenario.turns.slice(1)) {
      const next = nextCustomerReply(said);
      const expected = turn.text.split("{order}");
      expect(next).toContain(expected[0]);
      expect(next).not.toMatch(/\{\w+\}/);
      said.push(next as string);
    }
    expect(nextCustomerReply(said)).toBeNull();
  });

  it("reuses the order number from the first message", () => {
    const damaged = SCENARIOS.find((s) => s.id === "damaged-package")!;
    const first = startScenario(damaged);
    const order = first.body.match(/SI-\d+/)?.[0];
    expect(nextCustomerReply([first.body])).toContain(`Številka naročila je ${order}`);
  });

  it("falls back to generic replies for a hand-typed conversation, then ends", () => {
    const first = "Pozdravljeni, imam nekaj čisto svojega.";
    const second = nextCustomerReply([first]) as string;
    const third = nextCustomerReply([first, second]) as string;
    expect(second).not.toBe(third);
    expect(nextCustomerReply([first, second, third])).toBeNull();
  });
});
