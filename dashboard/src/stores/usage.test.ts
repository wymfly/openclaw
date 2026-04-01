// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useUsageStore } from "./usage";

describe("useUsageStore", () => {
  beforeEach(() => {
    useUsageStore.setState({
      timeWindow: "7d",
      costFallback: null,
      sessionsUsage: null,
      costLoading: false,
      sessionsLoading: false,
      error: null,
      _lastFetchKey: "",
      _lastFetchTime: 0,
      _abortController: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setTimeWindow updates date range for 7d", () => {
    useUsageStore.getState().setTimeWindow("7d");
    const state = useUsageStore.getState();
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(state.timeWindow).toBe("7d");
    expect(state.endDate).toBe(localToday);
  });

  it("setTimeWindow updates date range for today", () => {
    useUsageStore.getState().setTimeWindow("today");
    const state = useUsageStore.getState();
    expect(state.timeWindow).toBe("today");
    expect(state.startDate).toBe(state.endDate);
  });

  it("setCustomRange sets custom dates", () => {
    useUsageStore.getState().setCustomRange("2026-03-01", "2026-03-15");
    const state = useUsageStore.getState();
    expect(state.timeWindow).toBe("custom");
    expect(state.startDate).toBe("2026-03-01");
    expect(state.endDate).toBe("2026-03-15");
  });

  it("fetchAll deduplicates within 30s", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updatedAt: 1, days: 7, totals: {} }),
    });
    globalThis.fetch = mockFetch;

    await useUsageStore.getState().fetchAll();
    const callCount = mockFetch.mock.calls.length;

    // Second call with same params should be deduped
    await useUsageStore.getState().fetchAll();
    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  it("fetchAll calls both cost and sessions endpoints", async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes("/sessions")
              ? {
                  updatedAt: 1,
                  startDate: "",
                  endDate: "",
                  sessions: [],
                  totals: {},
                  aggregates: {
                    messages: {},
                    tools: {},
                    byModel: [],
                    byProvider: [],
                    byAgent: [],
                    byChannel: [],
                    daily: [],
                  },
                }
              : { updatedAt: 1, days: 7, totals: {} },
          ),
      });
    });
    globalThis.fetch = mockFetch;

    await useUsageStore.getState().fetchAll();

    expect(calls.some((u) => u.includes("/api/usage/cost"))).toBe(true);
    expect(calls.some((u) => u.includes("/api/usage/sessions"))).toBe(true);
  });

  it("fetchSessionLogs calls logs endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ logs: [{ timestamp: 1, role: "user", content: "hi" }] }),
    });
    globalThis.fetch = mockFetch;

    const logs = await useUsageStore.getState().fetchSessionLogs("test-key");
    expect(logs).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/usage/sessions/logs?key=test-key"),
    );
  });
});
