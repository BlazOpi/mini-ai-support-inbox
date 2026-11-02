import type { ApiErrorBody } from "./domain";

/** Error thrown by the browser API client; `message` is already user-facing (Slovenian). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH";

/** Small typed fetch wrapper: JSON in, `{ data }` out, consistent ApiError on failure. */
export async function api<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Ni povezave s strežnikom. Preveri internetno povezavo.", 0, "network_error");
  }

  const payload = (await res.json().catch(() => null)) as ({ data: T } & Partial<ApiErrorBody>) | null;
  if (!res.ok || !payload) {
    const details = payload?.error?.details as { fieldErrors?: Record<string, string> } | undefined;
    throw new ApiError(
      payload?.error?.message ?? `Napaka strežnika (${res.status}).`,
      res.status,
      payload?.error?.code ?? "unknown_error",
      details?.fieldErrors,
    );
  }
  return payload.data;
}
