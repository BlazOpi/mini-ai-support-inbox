import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/server/logger";
import { redactQueryParams } from "./redact-query-params";
import { scrubEvent } from "./sentry-scrub";

const SECRET = "Moj naslov je Glavna ulica 1";

/** A real Drizzle error, so these tests fail if Drizzle ever changes its message format. */
async function failedQueryError(): Promise<Error> {
  const client = new PGlite();
  try {
    await drizzle(client).execute(sql`select ${SECRET}::text from table_that_does_not_exist`);
    throw new Error("The query should have failed.");
  } catch (err) {
    return err as Error;
  } finally {
    await client.close();
  }
}

describe("query parameters in errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the values and keeps the SQL", async () => {
    const err = await failedQueryError();
    expect(err.message).toContain(SECRET);

    const redacted = redactQueryParams(err.message);
    expect(redacted).not.toContain(SECRET);
    expect(redacted).toContain("table_that_does_not_exist");
  });

  it("leaves other messages alone", () => {
    expect(redactQueryParams("connection refused")).toBe("connection refused");
  });

  it("keeps the values out of the logs", async () => {
    const err = await failedQueryError();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("http.unhandled_error", { err });

    const line = String(consoleError.mock.calls[0][0]);
    expect(line).not.toContain(SECRET);
    expect(line).toContain("http.unhandled_error");
  });

  it("keeps the values out of Sentry events", async () => {
    const err = await failedQueryError();

    const event = scrubEvent({ exception: { values: [{ value: err.message }, { value: "plain cause" }] } });

    expect(event.exception?.values?.[0].value).not.toContain(SECRET);
    expect(event.exception?.values?.[1].value).toBe("plain cause");
  });
});
