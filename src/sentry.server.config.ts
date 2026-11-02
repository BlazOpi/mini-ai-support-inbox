import * as Sentry from "@sentry/nextjs";
import { dataCollection, scrubEvent, tracesSampleRate } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

// Without a DSN the SDK stays disabled, so local development needs no Sentry account.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: tracesSampleRate(),
  dataCollection,
  beforeSend: scrubEvent,
});
