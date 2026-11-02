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

  it("reports the standing of a key without using up a request", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });

    expect(limiter.peek("a")).toEqual({ limit: 2, remaining: 2, resetInSeconds: 0 });

    limiter.check("a");
    now = 15_000;
    expect(limiter.peek("a")).toEqual({ limit: 2, remaining: 1, resetInSeconds: 45 });
    expect(limiter.peek("a")).toEqual({ limit: 2, remaining: 1, resetInSeconds: 45 });

    limiter.check("a");
    limiter.check("a"); // blocked: must not push remaining below zero
    expect(limiter.peek("a").remaining).toBe(0);

    now = 60_000;
    expect(limiter.peek("a")).toEqual({ limit: 2, remaining: 2, resetInSeconds: 0 });
  });
});
