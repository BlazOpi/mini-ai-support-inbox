"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aiQuota } from "@/lib/ai-quota";
import { ApiError, api } from "@/lib/api-client";
import { CATEGORIES, CATEGORY_LABELS, LIMITS, type Category, type MessageDto } from "@/lib/domain";
import { formatConfidence, formatDateTime } from "@/lib/format";
import { AiLoadingOverlay, AiQuotaCounter, Spinner, useAiQuota } from "./ai-status";
import { CategoryBadge } from "./badges";
import { buttonClass, cardClass, ErrorMessage, sectionTitleClass, textareaClass } from "./ui";

type Action = "save" | "approve" | "process" | "category" | null;

/**
 * Human-in-the-loop controls for one message. The parent re-mounts this component
 * (via `key`) whenever fresh server data arrives, so local state never goes stale.
 */
export function ReplyPanel({ message }: { message: MessageDto }) {
  const router = useRouter();
  const [draft, setDraft] = useState(message.reply?.body ?? "");
  const [action, setAction] = useState<Action>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { waitLabel } = useAiQuota();

  const busy = isPending ? action : null;
  const generating = busy === "process";
  const dirty = message.reply !== null && draft !== message.reply.body;
  const tooLong = draft.length > LIMITS.replyMax;
  const editable = message.status === "draft_ready";

  function run(next: Exclude<Action, null>, fn: () => Promise<unknown>) {
    setAction(next);
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        // Stay busy until the fresh data is on screen, so nothing can fire again against the old state.
        startTransition(() => router.refresh());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Nepričakovana napaka. Poskusi znova.");
      }
    });
  }

  const save = () => run("save", () => api(`/api/messages/${message.id}/reply`, "PATCH", { body: draft }));
  // Approving with unsaved edits saves them first, so what you see is what gets approved.
  const approve = () =>
    run("approve", async () => {
      if (dirty) await api(`/api/messages/${message.id}/reply`, "PATCH", { body: draft });
      await api(`/api/messages/${message.id}/approve`, "POST");
    });
  const regenerate = () =>
    run("process", () => aiQuota.track(() => api(`/api/messages/${message.id}/process`, "POST")));
  const changeCategory = (category: Category) =>
    run("category", () => api(`/api/messages/${message.id}`, "PATCH", { category }));

  async function copy() {
    if (!message.reply) return;
    try {
      await navigator.clipboard.writeText(message.reply.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopiranje ni uspelo — označi besedilo ročno.");
    }
  }

  return (
    <div className="space-y-5" data-chat-busy={busy !== null ? "" : undefined}>
      {/* The AI's category, which an agent can correct until the reply is approved. */}
      <section className={cardClass}>
        <h2 className={`mb-3 ${sectionTitleClass}`}>Klasifikacija</h2>
        <div className="flex flex-wrap items-center gap-3">
          <CategoryBadge category={message.category} />
          {message.categorySource === "ai" && message.categoryConfidence !== null && (
            <span className="text-xs text-slate-500">
              AI zanesljivost: {formatConfidence(message.categoryConfidence)}
            </span>
          )}
          {message.categorySource === "human" && <span className="text-xs text-slate-500">popravljeno ročno</span>}

          {(message.status === "draft_ready" || message.status === "failed") && (
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
              Popravi:
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={message.category ?? ""}
                disabled={busy !== null}
                onChange={(e) => changeCategory(e.target.value as Category)}
              >
                {!message.category && <option value="">—</option>}
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {/* The reply: an editable draft until it's approved, then read-only with a copy button. */}
      <section className={cardClass}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className={sectionTitleClass}>
            {message.status === "approved" ? "Potrjen odgovor" : "Predlog odgovora"}
          </h2>
          {message.reply?.edited && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">ročno urejeno</span>
          )}
          {message.reply && (
            <span className="ml-auto text-xs text-slate-400" title={`prompt ${message.reply.promptVersion}`}>
              {message.reply.model}
            </span>
          )}
        </div>

        {message.status === "failed" && !generating && (
          <div role="alert" className="mb-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
            <p className="font-medium">AI obdelava ni uspela.</p>
            <p>{message.aiError ?? "Neznana napaka."} Sporočilo je shranjeno — obdelavo lahko ponoviš.</p>
          </div>
        )}

        {message.status === "processing" && !generating && (
          <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
            Sporočilo je v obdelavi. Če se stanje ne spremeni, osveži stran ali ponovi obdelavo.
          </p>
        )}

        {/* Nothing to cover yet (first attempt failed): the overlay still needs somewhere to show. */}
        {generating && !message.reply && (
          <div className="relative h-40 rounded-md ring-1 ring-slate-200">
            <AiLoadingOverlay label="AI pripravlja odgovor…" />
          </div>
        )}

        {message.status === "approved" && message.reply ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap rounded-md bg-emerald-50/60 p-4 text-sm leading-relaxed ring-1 ring-emerald-200">
              {message.reply.body}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copy}
                className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-700`}
              >
                {copied ? "Kopirano ✓" : "Kopiraj odgovor"}
              </button>
              {message.reply.approvedAt && (
                <span className="text-xs text-slate-500">Potrjeno {formatDateTime(message.reply.approvedAt)}</span>
              )}
            </div>
          </div>
        ) : (
          message.reply && (
            <>
              <div className="relative flex">
                <textarea
                  aria-label="Besedilo odgovora"
                  className={`${textareaClass} min-h-64`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!editable || busy !== null}
                />
                {generating && <AiLoadingOverlay label="AI pripravlja nov odgovor…" />}
                {busy === "approve" && <AiLoadingOverlay label="Potrjujem odgovor…" />}
              </div>
              <p className={`mt-1 text-right text-xs ${tooLong ? "text-rose-600" : "text-slate-400"}`}>
                {draft.length} / {LIMITS.replyMax}
              </p>
            </>
          )
        )}

        {error && <ErrorMessage className="mt-3">{error}</ErrorMessage>}

        {message.status !== "approved" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {editable && (
              <>
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy !== null || tooLong || !draft.trim()}
                  className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-500`}
                >
                  {busy === "approve" ? (
                    <>
                      <Spinner /> Potrjujem…
                    </>
                  ) : dirty ? (
                    "Shrani in potrdi"
                  ) : (
                    "Potrdi odgovor"
                  )}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy !== null || !dirty || tooLong || !draft.trim()}
                  className={`${buttonClass} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50`}
                >
                  {busy === "save" ? "Shranjujem…" : "Shrani osnutek"}
                </button>
                {dirty && (
                  <button
                    type="button"
                    onClick={() => setDraft(message.reply?.body ?? "")}
                    disabled={busy !== null}
                    className={`${buttonClass} bg-white text-slate-500 shadow-none hover:text-slate-800`}
                  >
                    Zavrzi spremembe
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={regenerate}
              disabled={busy !== null || dirty || waitLabel !== null}
              title={dirty ? "Najprej shrani ali zavrzi spremembe." : undefined}
              className={`${buttonClass} ml-auto bg-white text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50`}
            >
              {generating ? (
                <>
                  <Spinner /> AI dela…
                </>
              ) : (
                (waitLabel ?? (message.status === "draft_ready" ? "Ponovno generiraj" : "Ponovi AI obdelavo"))
              )}
            </button>
            <AiQuotaCounter className="w-full text-right" />
          </div>
        )}

        {message.reply?.edited && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Pokaži izvirni AI osnutek</summary>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-slate-600">
              {message.reply.aiDraft}
            </p>
          </details>
        )}
      </section>
    </div>
  );
}
