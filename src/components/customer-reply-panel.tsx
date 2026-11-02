"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { LIMITS, type MessageDto } from "@/lib/domain";
import { nextCustomerReply, SCENARIOS_ENABLED } from "@/lib/scenarios";

const button =
  "rounded-md px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Continues the conversation once the agent's reply is approved: the customer writes back and the
 * AI drafts the next reply. `customerMessages` are all the customer's messages so far, oldest first.
 */
export function CustomerReplyPanel({ message, customerMessages }: { message: MessageDto; customerMessages: string[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scriptedReply = SCENARIOS_ENABLED ? nextCustomerReply(customerMessages) : null;
  const tooLong = body.length > LIMITS.bodyMax;

  async function send(text: string) {
    setPending(true);
    setError(null);
    try {
      const created = await api<MessageDto>(`/api/messages/${message.id}/customer-reply`, "POST", { body: text });
      setBody("");
      router.push(`/messages/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nepričakovana napaka. Poskusi znova.");
    } finally {
      setPending(false);
    }
  }

  function onGenerate() {
    if (!scriptedReply) return;
    setBody(scriptedReply);
    void send(scriptedReply);
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
      <textarea
        aria-label="Besedilo odgovora stranke"
        className="min-h-24 w-full resize-y rounded-md border border-slate-300 p-3 text-sm leading-relaxed shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={pending}
        placeholder="Prilepi ali vpiši, kaj je stranka odgovorila…"
      />

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void send(body)}
          disabled={pending || body.trim().length < LIMITS.bodyMin || tooLong}
          className={`${button} bg-indigo-600 text-white hover:bg-indigo-500`}
        >
          {pending ? "AI pripravlja odgovor…" : "Dodaj odgovor stranke"}
        </button>
        {scriptedReply && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending}
            className={`${button} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}
          >
            Generiraj odgovor stranke
          </button>
        )}
        {SCENARIOS_ENABLED && !scriptedReply && (
          <span className="text-xs text-slate-500">Testni scenarij je končan.</span>
        )}
      </div>
    </section>
  );
}
