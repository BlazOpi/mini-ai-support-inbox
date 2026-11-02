import { api } from "./api-client";
import type { AiQuotaDto } from "./domain";

/**
 * The browser's view of the server's AI rate limit, shared by every AI button on the page.
 * Only informational: the server still enforces the limit if this is stale or unavailable.
 */
export function createAiQuotaStore({
  fetchQuota,
  now = Date.now,
}: {
  fetchQuota: () => Promise<AiQuotaDto>;
  now?: () => number;
}) {
  let quota: AiQuotaDto | null = null;
  let resetAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let latestRefresh = 0;
  const listeners = new Set<() => void>();

  function publish(next: AiQuotaDto) {
    quota = next;
    for (const listener of listeners) listener();
  }

  function tick() {
    if (!quota) return;
    const left = Math.ceil((resetAt - now()) / 1000);
    if (left > 0) {
      publish({ ...quota, resetInSeconds: left });
      return;
    }
    clearInterval(timer);
    timer = undefined;
    publish({ ...quota, remaining: quota.limit, resetInSeconds: 0 });
    void refresh();
  }

  async function refresh(): Promise<void> {
    const id = ++latestRefresh;
    try {
      const next = await fetchQuota();
      if (id !== latestRefresh) return; // a newer refresh is on its way
      resetAt = now() + next.resetInSeconds * 1000;
      clearInterval(timer);
      timer = next.resetInSeconds > 0 ? setInterval(tick, 1000) : undefined;
      publish(next);
    } catch {
      // Keep the last known value.
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => quota,
    refresh,
    /** Runs an AI request: the counter drops right away, then syncs with the server when it finishes. */
    async track<T>(request: () => Promise<T>): Promise<T> {
      if (quota) publish({ ...quota, remaining: Math.max(0, quota.remaining - 1) });
      try {
        return await request();
      } finally {
        void refresh();
      }
    },
  };
}

export const aiQuota = createAiQuotaStore({ fetchQuota: () => api<AiQuotaDto>("/api/ai-quota") });
