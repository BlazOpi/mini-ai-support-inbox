"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aiQuota } from "@/lib/ai-quota";
import { ApiError, api } from "@/lib/api-client";
import { LIMITS, type MessageDto } from "@/lib/domain";
import { nextCustomerReply, SCENARIOS_ENABLED } from "@/lib/scenarios";
import { AiLoadingOverlay, AiQuotaCounter, Spinner, useAiQuota } from "./ai-status";

const button =
  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Continues the conversation once the agent's reply is approved: the customer writes back and the
 * AI drafts the next reply. `customerMessages` are all the customer's messages so far, oldest first.
 */
export function CustomerReplyPanel({ message, customerMessages }: { message: MessageDto; customerMessages: string[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { waitLabel } = useAiQuota();

  const scriptedReply = SCENARIOS_ENABLED ? nextCustomerReply(customerMessages) : null;
  const tooLong = body.length > LIMITS.bodyMax;

  function send(text: string) {
    setError(null);
    startTransition(async () => {
      try {
        const created = await aiQuota.track(() =>
          api<MessageDto>(`/api/messages/${message.id}/customer-reply`, "POST", { body: text }),
        );
        setBody("");
        // Stay busy until the next page is on screen, so the buttons can't fire a second request.
        startTransition(() => router.push(`/messages/${created.id}`));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Nepričakovana napaka. Poskusi znova.");
      }
    });
  }

  function onGenerate() {
    if (!scriptedReply) return;
    setBody(scriptedReply);
    send(scriptedReply);
  }

  if (message.status !== "approved") {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        Ko potrdiš odgovor, lahko stranka odgovori in pogovor se nadaljuje.
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Odgovor stranke</h2>
      <div className="relative flex">
        <textarea
          aria-label="Besedilo odgovora stranke"
          className="min-h-24 w-full resize-y rounded-md border border-slate-300 p-3 text-sm leading-relaxed shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={pending}
          placeholder="Prilepi ali vpiši, kaj je stranka odgovorila…"
        />
        {pending && <AiLoadingOverlay label="AI pripravlja odgovor…" />}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => send(body)}
          disabled={pending || waitLabel !== null || body.trim().length < LIMITS.bodyMin || tooLong}
          className={`${button} bg-indigo-600 text-white hover:bg-indigo-500`}
        >
          {pending ? (
            <>
              <Spinner /> AI pripravlja odgovor…
            </>
          ) : (
            (waitLabel ?? "Dodaj odgovor stranke")
          )}
        </button>
        {scriptedReply && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending || waitLabel !== null}
            className={`${button} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}
          >
            Generiraj odgovor stranke
          </button>
        )}
        {SCENARIOS_ENABLED && !scriptedReply && (
          <span className="text-xs text-slate-500">Testni scenarij je končan.</span>
        )}
        <AiQuotaCounter className="w-full text-right" />
      </div>
    </section>
  );
}
