"use client";

import { useEffect, useSyncExternalStore } from "react";
import { aiQuota } from "@/lib/ai-quota";

const noQuotaOnServer = () => null;

/** The shared AI request counter, plus the label to show on AI buttons while none are left. */
export function useAiQuota() {
  const quota = useSyncExternalStore(aiQuota.subscribe, aiQuota.getSnapshot, noQuotaOnServer);

  useEffect(() => {
    void aiQuota.refresh();
  }, []);

  return { quota, waitLabel: quota?.remaining === 0 ? `Počakaj ${quota.resetInSeconds} s` : null };
}

export function AiQuotaCounter({ className = "" }: { className?: string }) {
  const { quota } = useAiQuota();

  const tone = !quota
    ? "text-slate-500"
    : quota.remaining === 0
      ? "font-medium text-rose-600"
      : quota.remaining <= 2
        ? "text-amber-700"
        : "text-slate-500";

  return (
    <p className={`min-h-4 text-xs tabular-nums ${tone} ${className}`}>
      {quota && (
        <>
          Preostale AI zahteve: {quota.remaining} / {quota.limit}
          {quota.resetInSeconds > 0 && ` · obnovitev čez ${quota.resetInSeconds} s`}
        </>
      )}
    </p>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/** Light cover with a spinner over the content AI is working on. The parent must be `relative`. */
export function AiLoadingOverlay({ label }: { label: string }) {
  return (
    <div role="status" className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/70 p-4">
      <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-100">
        <Spinner className="size-5" />
        {label}
      </span>
    </div>
  );
}
