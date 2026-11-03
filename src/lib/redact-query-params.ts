/**
 * Drizzle's query errors end with the query's values ("Failed query: ...\nparams: ..."), and those
 * values can be customer messages, which must never reach logs or Sentry. The SQL before them only
 * has placeholders, so it stays in the message for debugging.
 */
export function redactQueryParams(message: string): string {
  return message.replace(/\nparams:[\s\S]*$/, "\nparams: [redacted]");
}
