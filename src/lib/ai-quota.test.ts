import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAiQuotaStore } from "./ai-quota";
import type { AiQuotaDto } from "./domain";

const quota = (remaining: number, resetInSeconds = 0, limit = 10): AiQuotaDto => ({ limit, remaining, resetInSeconds });

describe("AI quota store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes what the server reports and notifies subscribers", async () => {
    const store = createAiQuotaStore({ fetchQuota: async () => quota(7, 30) });
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getSnapshot()).toBeNull();
    await store.refresh();

    expect(store.getSnapshot()).toEqual(quota(7, 30));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("drops the counter while a request runs, then adopts the server's count", async () => {
    const fetchQuota = vi.fn(async () => quota(5, 40));
    const store = createAiQuotaStore({ fetchQuota });
    fetchQuota.mockResolvedValueOnce(quota(5));
    await store.refresh();

    let finish: (value: string) => void = () => {};
    const running = store.track(() => new Promise<string>((resolve) => (finish = resolve)));
    expect(store.getSnapshot()?.remaining).toBe(4);

    fetchQuota.mockResolvedValueOnce(quota(3, 40)); // another tab used one too
    finish("done");
    await expect(running).resolves.toBe("done");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual(quota(3, 40));
  });

  it("syncs after a failed request and rethrows its error", async () => {
    const fetchQuota = vi.fn(async () => quota(0, 20));
    const store = createAiQuotaStore({ fetchQuota });

    await expect(store.track(() => Promise.reject(new Error("429")))).rejects.toThrow("429");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual(quota(0, 20));
  });

  it("never shows less than zero", async () => {
    const store = createAiQuotaStore({ fetchQuota: async () => quota(0, 20) });
    await store.refresh();

    let finish = () => {};
    const running = store.track(() => new Promise<void>((resolve) => (finish = resolve)));
    expect(store.getSnapshot()?.remaining).toBe(0);
    finish();
    await running;
  });

  it("counts down each second and refills when the window ends", async () => {
    const fetchQuota = vi.fn(async () => quota(0, 3));
    const store = createAiQuotaStore({ fetchQuota });
    await store.refresh();

    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getSnapshot()).toEqual(quota(0, 2));

    fetchQuota.mockResolvedValueOnce(quota(10));
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getSnapshot()).toEqual(quota(10));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the last known value when the server can't be reached", async () => {
    const fetchQuota = vi.fn(async () => quota(6));
    const store = createAiQuotaStore({ fetchQuota });
    await store.refresh();

    fetchQuota.mockRejectedValueOnce(new Error("offline"));
    await store.refresh();
    expect(store.getSnapshot()).toEqual(quota(6));
  });
});
