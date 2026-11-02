"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, api } from "@/lib/api-client";
import { LIMITS, type MessageDto } from "@/lib/domain";

const EMPTY = { customerName: "", customerEmail: "", body: "" };

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

export function NewMessageForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const message = await api<MessageDto>("/api/messages", "POST", values);
      setValues(EMPTY);
      router.push(`/messages/${message.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Nepričakovana napaka. Poskusi znova.");
      }
    } finally {
      setPending(false);
    }
  }

  const tooLong = values.body.length > LIMITS.bodyMax;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      {error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || values.body.trim().length < LIMITS.bodyMin || tooLong}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "AI klasificira in pripravlja odgovor…" : "Shrani in obdelaj z AI"}
      </button>
    </form>
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
