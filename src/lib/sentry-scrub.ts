import type { BrowserOptions } from "@sentry/nextjs";
import { redactQueryParams } from "./redact-query-params";

type SentryDataCollection = NonNullable<BrowserOptions["dataCollection"]>;

/**
 * Privacy-first Sentry data collection (GDPR): customer messages travel in request bodies,
 * DB query parameters and LLM prompts, so none of those are collected.
 */
export const dataCollection: SentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "content-type", "referer"] }, response: false },
  httpBodies: [],
  urlQueryParams: true, // only list filters, no personal data
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
};

interface ScrubbableEvent {
  request?: { data?: unknown; cookies?: unknown; headers?: Record<string, string> };
  user?: { ip_address?: string | null; email?: string };
  exception?: { values?: { value?: string }[] };
}

const SENSITIVE_HEADERS = ["authorization", "cookie", "x-forwarded-for", "x-real-ip"];

/**
 * Defence in depth: strips personal data from Sentry events before they leave the app:
 * request bodies (customer messages), cookies, auth headers, IP addresses and the query values
 * inside database error messages. Shared by the browser and server Sentry configs.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactQueryParams(exception.value);
  }
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(key.toLowerCase())) delete event.request.headers[key];
      }
    }
  }
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
  }
  return event;
}

export function tracesSampleRate(): number {
  const configured = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
  if (Number.isFinite(configured) && configured >= 0 && configured <= 1) return configured;
  return process.env.NODE_ENV === "production" ? 0.2 : 1;
}
