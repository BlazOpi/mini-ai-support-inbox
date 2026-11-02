import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit per window, per key, then resets", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    const blocked = limiter.check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(limiter.check("b").allowed).toBe(true); // independent key

    now = 60_000;
    expect(limiter.check("a").allowed).toBe(true);
  });
});
