import { describe, expect, it } from "vitest";
import { LIMITS } from "./domain";
import { createMessageSchema, listMessagesQuerySchema, updateReplySchema } from "./validation";

describe("validation", () => {
  it("trims input and turns empty optional fields into undefined", () => {
    const parsed = createMessageSchema.parse({
      customerName: "  ",
      customerEmail: "",
      body: "  Živjo, kdaj ste odprti?  ",
    });
    expect(parsed).toEqual({ customerName: undefined, customerEmail: undefined, body: "Živjo, kdaj ste odprti?" });
  });

  it("rejects invalid email and too long messages", () => {
    expect(createMessageSchema.safeParse({ body: "Pozdravljeni", customerEmail: "ni-email" }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: "a".repeat(LIMITS.bodyMax + 1) }).success).toBe(false);
  });

  it("rejects an empty reply", () => {
    expect(updateReplySchema.safeParse({ body: "   " }).success).toBe(false);
  });

  it("ignores unknown list filters instead of failing", () => {
    expect(listMessagesQuerySchema.parse({ category: "spam", status: "x", limit: "9999" })).toEqual({
      category: undefined,
      status: undefined,
      limit: 50,
    });
  });
});
