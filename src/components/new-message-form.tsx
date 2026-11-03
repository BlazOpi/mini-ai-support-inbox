"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { aiQuota } from "@/lib/ai-quota";
import { ApiError, api } from "@/lib/api-client";
import { CATEGORIES, CATEGORY_LABELS, LIMITS, type MessageDto } from "@/lib/domain";
import { pickScenario, SCENARIOS, SCENARIOS_ENABLED, startScenario, type Scenario } from "@/lib/scenarios";
import { AiLoadingOverlay, AiQuotaCounter, Spinner, useAiQuota } from "./ai-status";
import { ErrorMessage } from "./ui";

const EMPTY = { customerName: "", customerEmail: "", body: "" };

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

export function NewMessageForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { waitLabel } = useAiQuota();
  const locked = pending || waitLabel !== null;

  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(values);
  }

  /** One click: show the fake customer's message in the form and send it through the normal flow. */
  function onStartScenario(scenario: Scenario) {
    const sample = startScenario(scenario);
    setValues(sample);
    submit(sample);
  }

  function submit(input: typeof EMPTY) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      try {
        const message = await aiQuota.track(() => api<MessageDto>("/api/messages", "POST", input));
        setValues(EMPTY);
        // Stay busy until the next page is on screen, so the form can't fire a second request.
        startTransition(() => router.push(`/messages/${message.id}`));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          setFieldErrors(err.fieldErrors);
        } else {
          setError("Nepričakovana napaka. Poskusi znova.");
        }
      }
    });
  }

  const tooLong = values.body.length > LIMITS.bodyMax;

  return (
    <form onSubmit={onSubmit} className="relative space-y-4" noValidate>
      {SCENARIOS_ENABLED && (
        <div className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Testni scenarij z izmišljeno stranko</p>
            <SampleButton disabled={locked} onClick={() => onStartScenario(pickScenario())}>
              Naključen
            </SampleButton>
          </div>
          {CATEGORIES.map((category) => (
            <div key={category}>
              <p className="mb-1 text-xs text-slate-400">{CATEGORY_LABELS[category]}</p>
              <div className="flex flex-wrap gap-1.5">
                {SCENARIOS.filter((s) => s.turns[0].expectedCategory === category).map((scenario) => (
                  <SampleButton key={scenario.id} disabled={locked} onClick={() => onStartScenario(scenario)}>
                    {scenario.title}
                  </SampleButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="Ime stranke" hint="neobvezno" error={fieldErrors.customerName}>
          <input
            className={inputClass}
            value={values.customerName}
            onChange={set("customerName")}
            maxLength={LIMITS.nameMax}
            autoComplete="off"
            disabled={pending}
            placeholder="npr. Ana Novak"
          />
        </Field>
        <Field label="E-pošta stranke" hint="neobvezno" error={fieldErrors.customerEmail}>
          <input
            className={inputClass}
            type="email"
            value={values.customerEmail}
            onChange={set("customerEmail")}
            maxLength={LIMITS.emailMax}
            autoComplete="off"
            disabled={pending}
            placeholder="ana@example.com"
          />
        </Field>
      </div>

      <Field label="Sporočilo stranke" error={fieldErrors.body}>
        <textarea
          className={`${inputClass} min-h-40 resize-y`}
          value={values.body}
          onChange={set("body")}
          disabled={pending}
          required
          placeholder="Prilepi ali vpiši sporočilo stranke…"
        />
        <p className={`mt-1 text-right text-xs ${tooLong ? "text-rose-600" : "text-slate-400"}`}>
          {values.body.length} / {LIMITS.bodyMax}
        </p>
      </Field>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <button
        type="submit"
        disabled={locked || values.body.trim().length < LIMITS.bodyMin || tooLong}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <Spinner /> AI klasificira in pripravlja odgovor…
          </>
        ) : (
          (waitLabel ?? "Shrani in obdelaj z AI")
        )}
      </button>
      {/* Above the overlay: the count stays readable while AI works. */}
      <AiQuotaCounter className="relative z-20 text-center" />

      {pending && <AiLoadingOverlay label="AI klasificira in pripravlja odgovor…" />}
    </form>
  );
}

function SampleButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {hint && <span className="font-normal text-slate-400">({hint})</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
