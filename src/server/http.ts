import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiErrorBody } from "@/lib/domain";
import { AppError, ForbiddenError, PayloadTooLargeError, RateLimitError, ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";
import type { RateLimiter } from "@/server/rate-limit";

const MAX_BODY_BYTES = 32 * 1024;

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Converts any thrown error into a consistent JSON error response. Unknown errors become 500. */
export function errorResponse(err: unknown, report?: (err: unknown) => void): NextResponse<ApiErrorBody> {
  if (err instanceof AppError) {
    const headers = err instanceof RateLimitError ? { "Retry-After": String(err.retryAfterSeconds) } : undefined;
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status, headers },
    );
  }
  logger.error("http.unhandled_error", { err });
  report?.(err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Prišlo je do nepričakovane napake." } },
    { status: 500 },
  );
}

/**
 * Basic CSRF defence for state-changing requests: if the browser sends an Origin header
 * it must match the host serving the API. (JSON bodies already force a CORS preflight.)
 */
export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // fall through — invalid Origin header
  }
  if (!host || originHost !== host) throw new ForbiddenError("Zahteva iz nedovoljenega izvora.");
}

/** Reads and validates a JSON body with a size cap. */
export async function parseJsonBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new PayloadTooLargeError();

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new PayloadTooLargeError();

  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ValidationError("Telo zahteve ni veljaven JSON.");
  }
  return parseWith(schema, data);
}

export function parseWith<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] ??= issue.message;
    }
    throw new ValidationError(Object.values(fieldErrors)[0] ?? "Neveljavni podatki.", { fieldErrors });
  }
  return result.data;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function rateLimitKey(request: Request, scope: string): string {
  return `${scope}:${clientKey(request)}`;
}

export function enforceRateLimit(limiter: RateLimiter, request: Request, scope: string) {
  const result = limiter.check(rateLimitKey(request, scope));
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}

/** What `enforceRateLimit` would see for this client, without using up a request. */
export function rateLimitStatus(limiter: RateLimiter, request: Request, scope: string) {
  return limiter.peek(rateLimitKey(request, scope));
}
