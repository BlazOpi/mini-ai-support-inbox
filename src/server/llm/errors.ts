import { LLMError } from "@/server/errors";

/**
 * Normalises SDK errors (Anthropic and OpenAI share the same Stainless error shapes)
 * into an LLMError with a safe, user-facing message. The original error is kept as `cause`.
 */
export function toLLMError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;

  const name = err instanceof Error ? err.name : "";
  const status =
    typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : undefined;

  if (name === "APIConnectionTimeoutError" || name === "AbortError" || name === "TimeoutError") {
    return new LLMError("AI storitev se ni odzvala pravočasno. Poskusi znova.", { cause: err });
  }
  if (status === 401 || status === 403) {
    return new LLMError("Napaka v konfiguraciji AI storitve (API ključ).", { cause: err });
  }
  if (status === 429 || status === 529) {
    return new LLMError("AI storitev je trenutno preobremenjena. Poskusi znova čez minuto.", { cause: err });
  }
  if (status === 400) {
    return new LLMError("AI storitev je zavrnila zahtevo.", { cause: err });
  }
  return new LLMError("AI storitev trenutno ni dosegljiva. Poskusi znova.", { cause: err });
}
