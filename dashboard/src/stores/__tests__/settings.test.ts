import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useSettingsStore } from "../settings";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  useSettingsStore.setState({
    gatewayUrl: "",
    gatewayToken: "",
    notificationPrefs: { approvals: true, budget: true, alerts: true },
    versionInfo: { deck: "", gateway: "", cli: "" },
    loading: false,
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchSettings
// ---------------------------------------------------------------------------

describe("fetchSettings", () => {
  it("fetches and sets settings from API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gatewayUrl: "ws://localhost:18789",
        gatewayToken: "tok-***",
        notificationPrefs: { approvals: true, budget: false, alerts: true },
      }),
    });

    await useSettingsStore.getState().fetchSettings();

    const state = useSettingsStore.getState();
    expect(state.gatewayUrl).toBe("ws://localhost:18789");
    expect(state.gatewayToken).toBe("••••••");
    expect(state.notificationPrefs).toEqual({
      approvals: true,
      budget: false,
      alerts: true,
    });
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("sets default notification prefs when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gatewayUrl: "ws://localhost:18789",
      }),
    });

    await useSettingsStore.getState().fetchSettings();

    expect(useSettingsStore.getState().notificationPrefs).toEqual({
      approvals: true,
      budget: true,
      alerts: true,
    });
  });

  it("sets empty token display when no token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gatewayUrl: "ws://localhost:18789",
        gatewayToken: "",
      }),
    });

    await useSettingsStore.getState().fetchSettings();
    expect(useSettingsStore.getState().gatewayToken).toBe("");
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Gateway not configured" }),
    });

    await useSettingsStore.getState().fetchSettings();

    const state = useSettingsStore.getState();
    expect(state.error).toBe("Failed to fetch settings");
    expect(state.loading).toBe(false);
  });

  it("sets loading during fetch", async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    const promise = useSettingsStore.getState().fetchSettings();
    expect(useSettingsStore.getState().loading).toBe(true);

    resolveFetch!({
      ok: true,
      json: async () => ({ gatewayUrl: "" }),
    });
    await promise;

    expect(useSettingsStore.getState().loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// saveSettings
// ---------------------------------------------------------------------------

describe("saveSettings", () => {
  it("sends PATCH and re-fetches settings", async () => {
    // PATCH response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });
    // Re-fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gatewayUrl: "ws://new-host:18789",
        gatewayToken: "tok-***",
        notificationPrefs: { approvals: true, budget: true, alerts: true },
      }),
    });

    await useSettingsStore.getState().saveSettings();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/settings");
    expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
  });

  it("sets error on save failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Save failed" }),
    });

    await useSettingsStore.getState().saveSettings();

    expect(useSettingsStore.getState().error).toBe("Failed to save settings");
  });
});

// ---------------------------------------------------------------------------
// fetchVersionInfo
// ---------------------------------------------------------------------------

describe("fetchVersionInfo", () => {
  it("fetches and sets version info", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        deck: "0.1.0",
        gateway: "2026.3.10",
        cli: "2026.3.10",
      }),
    });

    await useSettingsStore.getState().fetchVersionInfo();

    expect(useSettingsStore.getState().versionInfo).toEqual({
      deck: "0.1.0",
      gateway: "2026.3.10",
      cli: "2026.3.10",
    });
  });

  it("sets null on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    await useSettingsStore.getState().fetchVersionInfo();

    expect(useSettingsStore.getState().versionInfo).toEqual({
      deck: "",
      gateway: "",
      cli: "",
    });
  });
});

// ---------------------------------------------------------------------------
// testConnection
// ---------------------------------------------------------------------------

describe("testConnection", () => {
  it("returns true on successful connection", async () => {
    useSettingsStore.setState({
      gatewayUrl: "ws://localhost:18789",
      gatewayToken: "test-token",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const result = await useSettingsStore.getState().testConnection();

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("/api/settings/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "ws://localhost:18789",
        token: "test-token",
      }),
    });
  });

  it("returns false on failed connection", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "Connection refused" }),
    });

    const result = await useSettingsStore.getState().testConnection();
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await useSettingsStore.getState().testConnection();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

describe("setters", () => {
  it("setGatewayUrl updates url", () => {
    useSettingsStore.getState().setGatewayUrl("ws://new:18789");
    expect(useSettingsStore.getState().gatewayUrl).toBe("ws://new:18789");
  });

  it("setGatewayToken updates token", () => {
    useSettingsStore.getState().setGatewayToken("new-token");
    expect(useSettingsStore.getState().gatewayToken).toBe("new-token");
  });

  it("setNotificationPrefs merges partial prefs", () => {
    useSettingsStore.getState().setNotificationPrefs({ budget: false });
    expect(useSettingsStore.getState().notificationPrefs).toEqual({
      approvals: true,
      budget: false,
      alerts: true,
    });
  });
});
