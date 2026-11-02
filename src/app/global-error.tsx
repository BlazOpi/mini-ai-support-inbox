"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort boundary (errors in the root layout). Renders its own document, no global CSS. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <title>Napaka · Mini AI Support Inbox</title>
        <h1>Nekaj je šlo narobe</h1>
        <p>Napaka je zabeležena. Poskusi znova čez trenutek.</p>
        <button type="button" onClick={() => retry()}>
          Poskusi znova
        </button>
      </body>
    </html>
  );
}
