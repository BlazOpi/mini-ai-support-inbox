/**
 * Application errors carry an HTTP status and a stable machine-readable code.
 * Messages are user-facing (Slovenian) and must never contain secrets or stack traces.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Neveljavni podatki.", details?: unknown) {
    super(message, 400, "validation_error", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Vir ne obstaja.") {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Zahteva je prevelika.") {
    super(message, 413, "payload_too_large");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Dostop zavrnjen.") {
    super(message, 403, "forbidden");
  }
}

export class RateLimitError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super("Preveč zahtev. Poskusi znova čez nekaj trenutkov.", 429, "rate_limited");
  }
}

/**
 * Failure while talking to the LLM (network, timeout, refusal, malformed output).
 * `publicMessage` is safe to persist and show in the UI; the cause is only logged/reported.
 */
export class LLMError extends AppError {
  constructor(
    readonly publicMessage: string,
    options?: { cause?: unknown },
  ) {
    super(publicMessage, 502, "llm_error");
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
