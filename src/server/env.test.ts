import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `getEnv` caches its result, so each test needs a fresh copy of the module. */
const loadEnv = async () => (await import("./env")).getEnv();

describe("server environment", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const name of ["LLM_PROVIDER", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY"]) vi.stubEnv(name, "");
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/db");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts .env.example as written and falls back to the mock provider", async () => {
    for (const line of readFileSync(".env.example", "utf8").split(/\r?\n/)) {
      const setting = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (setting) vi.stubEnv(setting[1], setting[2]);
    }

    const env = await loadEnv();

    expect(env.LLM_PROVIDER).toBe("mock");
    expect(env.GROQ_API_KEY).toBeUndefined();
  });

  it("picks the provider whose key is set", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");

    expect((await loadEnv()).LLM_PROVIDER).toBe("groq");
  });

  it("follows an edited .env.local in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getEnv } = await import("./env");
    expect(getEnv().DATABASE_URL).toContain("localhost");

    vi.stubEnv("DATABASE_URL", "postgres://user:pass@other-host:5432/db");

    expect(getEnv().DATABASE_URL).toContain("other-host");
  });

  it("keeps its settings in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getEnv } = await import("./env");
    expect(getEnv().DATABASE_URL).toContain("localhost");

    vi.stubEnv("DATABASE_URL", "postgres://user:pass@other-host:5432/db");

    expect(getEnv().DATABASE_URL).toContain("localhost");
  });

  it("still rejects a missing database URL", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(loadEnv()).rejects.toThrow("DATABASE_URL");
  });
});
