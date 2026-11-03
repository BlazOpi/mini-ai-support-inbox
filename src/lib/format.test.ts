import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("prints the full year, so the server and the browser agree", () => {
    expect(formatDateTime("2026-11-03T20:29:00.000Z")).toBe("3. 11. 2026, 21:29");
  });

  it("uses Ljubljana time, including summer time", () => {
    expect(formatDateTime("2026-07-01T08:05:00.000Z")).toBe("1. 7. 2026, 10:05");
  });

  it("rolls over to the next day and pads the time", () => {
    expect(formatDateTime("2026-01-31T23:00:00.000Z")).toBe("1. 2. 2026, 00:00");
  });
});
