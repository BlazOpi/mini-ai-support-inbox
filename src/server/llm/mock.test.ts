import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it.each([
    ["Paket je prispel pokvarjen, zahtevam vračilo!", "complaint"],
    ["Kdaj bo moje naročilo poslano?", "question"],
    ["Hvala za odlično storitev!", "praise"],
    ["Lp", "other"],
    // Mixed message: complaint wins over praise, as in the real prompt.
    ["Hvala, ampak izdelek ne deluje.", "complaint"],
  ])("classifies %j as %s", async (message, expected) => {
    expect((await provider.classify(message)).category).toBe(expected);
  });

  it("greets the customer by name", async () => {
    const draft = await provider.draftReply({ message: "x", category: "praise", customerName: "Ana" });
    expect(draft.startsWith("Pozdravljeni, Ana,")).toBe(true);
  });
});
