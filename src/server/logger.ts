import { redactQueryParams } from "@/lib/redact-query-params";

/**
 * Minimal structured logger (JSON lines → Vercel logs). Never log customer message bodies:
 * they are personal data. Log ids, statuses and error metadata instead.
 */
type Level = "info" | "warn" | "error";

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactQueryParams(err.message),
      cause: err.cause instanceof Error ? redactQueryParams(err.cause.message) : undefined,
    };
  }
  return { message: String(err) };
}

function log(level: Level, msg: string, ctx: Record<string, unknown> = {}) {
  const entry: Record<string, unknown> = { level, msg, time: new Date().toISOString(), ...ctx };
  if ("err" in ctx) entry.err = serializeError(ctx.err);
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
