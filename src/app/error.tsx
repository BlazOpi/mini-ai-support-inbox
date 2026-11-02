"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <div role="alert" className="mx-auto max-w-md rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-rose-700">Nekaj je šlo narobe</h1>
      <p className="mt-1 text-sm text-slate-500">
        Podatkov trenutno ni bilo mogoče naložiti. Napaka je zabeležena.
        {digest && <span className="mt-1 block font-mono text-xs text-slate-400">ID: {digest}</span>}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Poskusi znova
      </button>
    </div>
  );
}
