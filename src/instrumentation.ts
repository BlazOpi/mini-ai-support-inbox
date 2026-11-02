import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Cache Components runs on the Node.js runtime only (no edge config needed).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

/** Reports errors from Server Components, route handlers and the proxy to Sentry. */
export const onRequestError = Sentry.captureRequestError;
