import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useModelsStore } from "../models";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

function resetStore() {
  useModelsStore.setState({
    catalogModels: [],
    providers: [],
    selectedProvider: null,
    catalogLoading: false,
    usableModels: [],
    usableLoading: false,
    authOverview: [],
    authLoading: false,
    probeResults: {},
    primaryModel: null,
    fallbacks: [],
    imagePrimaryModel: null,
    imageFallbacks: [],
    usageCost: [],
    usageProviders: [],
    configRaw: null,
    configHash: null,
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockModels = [
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshot",
    contextWindow: 262144,
    inputPrice: 0.57,
    outputPrice: 3.0,
    reasoning: true,
    input: ["text", "image"],
    maxTokens: 32768,
    isDefault: true,
  },
  {
    id: "MiniMax-M2.5",
    name: "MiniMax M2.5",
    provider: "minimax",
    contextWindow: 205000,
    inputPrice: 0.3,
    outputPrice: 1.2,
    reasoning: true,
    input: ["text"],
    maxTokens: 16384,
  },
  {
    id: "gpt-5.1-codex",
    name: "GPT 5.1 Codex",
    provider: "openai",
    contextWindow: 131072,
    inputPrice: 2.5,
    outputPrice: 10,
    reasoning: false,
    input: ["text", "image"],
    maxTokens: 32768,
  },
];

const mockAuthOverview = [
  {
    provider: "moonshot",
    status: "ready",
    auth: { type: "api_key", source: "env:MOONSHOT_API_KEY", profileId: "moonshot:default" },
  },
  {
    provider: "minimax",
    status: "warning",
    auth: { type: "oauth", source: "profile:minimax:oauth" },
    oauth: { expiresAt: Date.now() + 3600000, remainingMs: 3600000, status: "expiring" },
  },
  { provider: "openai", status: "missing", auth: null },
];

function makeConfigRaw(overrides?: Record<string, unknown>): string {
  const base = {
    agents: {
      defaults: {
        model: { primary: "moonshot/kimi-k2.5", fallbacks: ["minimax/MiniMax-M2.5"] },
        imageModel: "openai/gpt-5.1-codex",
      },
    },
    ...overrides,
  };
  return JSON.stringify(base);
}

// ---------------------------------------------------------------------------
// §3.1 fetchCatalog (renamed from fetchModels)
// ---------------------------------------------------------------------------

describe("fetchCatalog", () => {
  it("S-FM-01: fetches models and updates state", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });

    const store = useModelsStore.getState();
    await store.fetchCatalog();

    const state = useModelsStore.getState();
    expect(state.catalogModels).toHaveLength(3);
    expect(state.catalogModels[0].id).toBe("kimi-k2.5");
    expect(state.catalogLoading).toBe(false);
  });

  it("S-FM-02: handles empty list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    });

    await useModelsStore.getState().fetchCatalog();

    const state = useModelsStore.getState();
    expect(state.catalogModels).toEqual([]);
    expect(state.catalogLoading).toBe(false);
  });

  it("S-FM-03: keeps original models on API failure", async () => {
    useModelsStore.setState({ catalogModels: mockModels });

    mockFetch.mockResolvedValueOnce({ ok: false });

    await useModelsStore.getState().fetchCatalog();

    const state = useModelsStore.getState();
    expect(state.catalogModels).toEqual(mockModels);
    expect(state.catalogLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §3.2 fetchAuthOverview
// ---------------------------------------------------------------------------

describe("fetchAuthOverview", () => {
  it("S-FA-01: fetches auth overview successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: mockAuthOverview }),
    });

    await useModelsStore.getState().fetchAuthOverview();

    const state = useModelsStore.getState();
    expect(state.authOverview).toHaveLength(3);
    expect(state.authLoading).toBe(false);
  });

  it("S-FA-02: maps multiple provider statuses correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: mockAuthOverview }),
    });

    await useModelsStore.getState().fetchAuthOverview();

    const state = useModelsStore.getState();
    expect(state.authOverview[0].status).toBe("ready");
    expect(state.authOverview[1].status).toBe("warning");
    expect(state.authOverview[2].status).toBe("missing");
  });

  it("S-FA-03: keeps original on API failure", async () => {
    const existing = [{ provider: "old", status: "ready" as const, auth: null }];
    useModelsStore.setState({ authOverview: existing });

    mockFetch.mockResolvedValueOnce({ ok: false });

    await useModelsStore.getState().fetchAuthOverview();

    const state = useModelsStore.getState();
    expect(state.authOverview).toEqual(existing);
    expect(state.authLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §3.3 runProbe
// ---------------------------------------------------------------------------

describe("runProbe", () => {
  it("S-RP-01: stores successful probe result", async () => {
    const probeResult = {
      provider: "moonshot",
      profileId: "moonshot:default",
      status: "ok",
      latencyMs: 238,
      model: "kimi-k2.5",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => probeResult,
    });

    const result = await useModelsStore.getState().runProbe("moonshot");

    expect(result).toEqual(probeResult);
    expect(useModelsStore.getState().probeResults.moonshot).toEqual(probeResult);
  });

  it("S-RP-02: stores auth failure probe result", async () => {
    const probeResult = {
      provider: "openai",
      status: "auth",
      latencyMs: 0,
      error: "Invalid API key",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => probeResult,
    });

    const result = await useModelsStore.getState().runProbe("openai");

    expect(result?.status).toBe("auth");
    expect(result?.error).toBe("Invalid API key");
    expect(useModelsStore.getState().probeResults.openai).toEqual(probeResult);
  });

  it("S-RP-03: returns null on network error without crashing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await useModelsStore.getState().runProbe("moonshot");

    expect(result).toBeNull();
    expect(useModelsStore.getState().probeResults).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// §3.3b fetchProviderConfig (parses raw config)
// ---------------------------------------------------------------------------

describe("fetchProviderConfig", () => {
  it("S-FPC-01: extracts providers from raw config", async () => {
    const raw = JSON.stringify({
      models: {
        providers: {
          openai: { apiKey: "sk-test", baseUrl: "https://api.openai.com/v1" },
          moonshot: { apiKey: "${MOONSHOT_KEY}" },
        },
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h1" }),
    });

    await useModelsStore.getState().fetchProviderConfig();

    const state = useModelsStore.getState();
    expect(state.providers).toHaveLength(2);
    expect(state.providers.find((p) => p.provider === "openai")?.apiKey).toBe("sk-test");
    expect(state.providers.find((p) => p.provider === "moonshot")?.apiKey).toBe("${MOONSHOT_KEY}");
  });

  it("S-FPC-02: returns empty when no providers in config", async () => {
    const raw = JSON.stringify({ agents: { defaults: {} } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h2" }),
    });

    await useModelsStore.getState().fetchProviderConfig();

    expect(useModelsStore.getState().providers).toEqual([]);
  });

  it("S-FPC-03: handles API failure gracefully", async () => {
    const existing = [{ provider: "old", apiKey: "key" }];
    useModelsStore.setState({ providers: existing });

    mockFetch.mockResolvedValueOnce({ ok: false });

    await useModelsStore.getState().fetchProviderConfig();

    expect(useModelsStore.getState().providers).toEqual(existing);
  });
});

// ---------------------------------------------------------------------------
// §3.3c updateProviderConfig (deep-merge via patchConfig)
// ---------------------------------------------------------------------------

describe("updateProviderConfig", () => {
  beforeEach(() => {
    const raw = JSON.stringify({
      models: {
        providers: {
          openai: { apiKey: "old-key", baseUrl: "https://api.openai.com/v1" },
        },
      },
      agents: { defaults: { model: "openai/gpt-5.1-codex" } },
    });
    useModelsStore.setState({ configRaw: raw, configHash: "h1" });
  });

  it("S-UPC-01: sends PATCH with merged provider config", async () => {
    // PATCH success
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    // fetchFallbacks refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: useModelsStore.getState().configRaw, hash: "h2" }),
    });
    // fetchProviderConfig refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: useModelsStore.getState().configRaw, hash: "h2" }),
    });
    // fetchUsableModels (auto-refresh after config change)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });

    const result = await useModelsStore
      .getState()
      .updateProviderConfig({ provider: "openai", apiKey: "new-key" });

    expect(result).toBe(true);

    const patchCall = mockFetch.mock.calls[0];
    expect(patchCall[0]).toBe("/api/models/config");
    expect(patchCall[1].method).toBe("PATCH");

    const body = JSON.parse(patchCall[1].body);
    const parsed = JSON.parse(body.raw);
    // apiKey updated
    expect(parsed.models.providers.openai.apiKey).toBe("new-key");
    // baseUrl preserved
    expect(parsed.models.providers.openai.baseUrl).toBe("https://api.openai.com/v1");
    // rest of config preserved
    expect(parsed.agents.defaults.model).toBe("openai/gpt-5.1-codex");
  });

  it("S-UPC-02: adds new provider to config", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: useModelsStore.getState().configRaw, hash: "h3" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: useModelsStore.getState().configRaw, hash: "h3" }),
    });
    // fetchUsableModels (auto-refresh after config change)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });

    await useModelsStore
      .getState()
      .updateProviderConfig({ provider: "anthropic", apiKey: "sk-ant-new" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const parsed = JSON.parse(body.raw);
    expect(parsed.models.providers.anthropic.apiKey).toBe("sk-ant-new");
    // Existing provider preserved
    expect(parsed.models.providers.openai.apiKey).toBe("old-key");
  });

  it("S-UPC-03: fetches config if configRaw is null", async () => {
    useModelsStore.setState({ configRaw: null, configHash: null });

    // fetchFallbacks call to load config
    const raw = JSON.stringify({ models: { providers: {} } });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "fresh" }),
    });
    // PATCH
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    // refetch after patch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "fresh2" }),
    });
    // fetchProviderConfig refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "fresh2" }),
    });
    // fetchUsableModels (auto-refresh after config change)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });

    const result = await useModelsStore
      .getState()
      .updateProviderConfig({ provider: "deepseek", apiKey: "ds-key" });

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §3.4 fetchFallbacks
// ---------------------------------------------------------------------------

describe("fetchFallbacks", () => {
  it("S-FF-01: parses string model form", async () => {
    const raw = JSON.stringify({
      agents: { defaults: { model: "moonshot/kimi-k2.5" } },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h1" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.primaryModel).toBe("moonshot/kimi-k2.5");
    expect(state.fallbacks).toEqual([]);
  });

  it("S-FF-02: parses object model form with fallbacks", async () => {
    const raw = makeConfigRaw();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h2" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.primaryModel).toBe("moonshot/kimi-k2.5");
    expect(state.fallbacks).toEqual(["minimax/MiniMax-M2.5"]);
  });

  it("S-FF-03: handles missing agents.defaults.model", async () => {
    const raw = JSON.stringify({ agents: { defaults: {} } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h3" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.primaryModel).toBeNull();
    expect(state.fallbacks).toEqual([]);
  });

  it("S-FF-04: extracts imageModel simultaneously", async () => {
    const raw = JSON.stringify({
      agents: {
        defaults: {
          model: { primary: "moonshot/kimi-k2.5", fallbacks: [] },
          imageModel: { primary: "openai/gpt-5.1-codex", fallbacks: ["minimax/MiniMax-M2.5"] },
        },
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h4" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.imagePrimaryModel).toBe("openai/gpt-5.1-codex");
    expect(state.imageFallbacks).toEqual(["minimax/MiniMax-M2.5"]);
  });

  it("S-FF-05: stores configRaw and configHash", async () => {
    const raw = makeConfigRaw();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "abc123" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.configRaw).toBe(raw);
    expect(state.configHash).toBe("abc123");
  });
});

// ---------------------------------------------------------------------------
// §3.5 updateFallbacks
// ---------------------------------------------------------------------------

describe("updateFallbacks", () => {
  beforeEach(() => {
    // Pre-populate config state so updateFallbacks can build the PATCH body
    useModelsStore.setState({
      configRaw: makeConfigRaw(),
      configHash: "abc123",
      primaryModel: "moonshot/kimi-k2.5",
      fallbacks: ["minimax/MiniMax-M2.5"],
    });
  });

  it("S-UF-01: sends correct PATCH body", async () => {
    // PATCH success
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    // fetchFallbacks refetch after success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        raw: makeConfigRaw(),
        hash: "new-hash",
      }),
    });

    await useModelsStore.getState().updateFallbacks("moonshot/kimi-k2.5", ["openai/gpt-5.1-codex"]);

    const patchCall = mockFetch.mock.calls[0];
    expect(patchCall[0]).toBe("/api/models/config");
    expect(patchCall[1].method).toBe("PATCH");

    const body = JSON.parse(patchCall[1].body);
    expect(body.baseHash).toBe("abc123");

    const parsed = JSON.parse(body.raw);
    expect(parsed.agents.defaults.model.primary).toBe("moonshot/kimi-k2.5");
    expect(parsed.agents.defaults.model.fallbacks).toEqual(["openai/gpt-5.1-codex"]);
  });

  it("S-UF-02: refetches config after successful save", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        raw: makeConfigRaw(),
        hash: "refreshed-hash",
      }),
    });

    await useModelsStore.getState().updateFallbacks("moonshot/kimi-k2.5", []);

    // Should have made 2 calls: PATCH + GET (refetch)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(useModelsStore.getState().configHash).toBe("refreshed-hash");
  });

  it("S-UF-03: re-syncs on 409 conflict", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });
    // fetchFallbacks called on conflict
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        raw: makeConfigRaw(),
        hash: "conflict-hash",
      }),
    });

    const result = await useModelsStore
      .getState()
      .updateFallbacks("moonshot/kimi-k2.5", ["new/model"]);

    expect(result).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(useModelsStore.getState().configHash).toBe("conflict-hash");
  });

  it("S-UF-04: preserves other config fields", async () => {
    // Config with extra fields in the model object
    const raw = JSON.stringify({
      agents: {
        defaults: {
          model: { primary: "moonshot/kimi-k2.5", fallbacks: [], customField: "keep" },
          imageModel: "openai/gpt-5.1-codex",
        },
      },
      otherSetting: true,
    });
    useModelsStore.setState({ configRaw: raw, configHash: "h1" });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "h2" }),
    });

    await useModelsStore.getState().updateFallbacks("moonshot/kimi-k2.5", ["new/model"]);

    const patchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const parsed = JSON.parse(patchBody.raw);

    // Other config fields preserved
    expect(parsed.otherSetting).toBe(true);
    expect(parsed.agents.defaults.imageModel).toBe("openai/gpt-5.1-codex");
    // customField from model object preserved via spread
    expect(parsed.agents.defaults.model.customField).toBe("keep");
  });

  it("S-UF-05: updateImageFallbacks works the same way", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        raw: makeConfigRaw(),
        hash: "img-hash",
      }),
    });

    const result = await useModelsStore
      .getState()
      .updateImageFallbacks("openai/gpt-5.1-codex", ["minimax/MiniMax-M2.5"]);

    expect(result).toBe(true);

    const patchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const parsed = JSON.parse(patchBody.raw);
    expect(parsed.agents.defaults.imageModel.primary).toBe("openai/gpt-5.1-codex");
    expect(parsed.agents.defaults.imageModel.fallbacks).toEqual(["minimax/MiniMax-M2.5"]);
  });

  it("returns false when configRaw is null", async () => {
    useModelsStore.setState({ configRaw: null });

    const result = await useModelsStore.getState().updateFallbacks("a/b", []);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §3.6 fetchUsageSummary
// ---------------------------------------------------------------------------

describe("fetchUsageSummary", () => {
  it("S-US-01: fetches both cost and provider status", async () => {
    // Gateway usage.cost returns CostUsageSummary { daily: CostUsageDailyEntry[], totals }
    const now = Date.now();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          updatedAt: now,
          days: 7,
          daily: [
            { date: "2026-03-18", totalCost: 7.6 },
            { date: "2026-03-19", totalCost: 12.38 },
          ],
        }),
      })
      // Gateway usage.status returns UsageSummary { providers: ProviderUsageSnapshot[] }
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          updatedAt: now,
          providers: [
            {
              provider: "moonshot",
              displayName: "Moonshot",
              windows: [{ label: "Daily", usedPercent: 72, resetAt: now + 19380000 }],
              plan: "Standard",
            },
          ],
        }),
      });

    await useModelsStore.getState().fetchUsageSummary();

    const state = useModelsStore.getState();
    expect(state.usageCost).toHaveLength(2);
    expect(state.usageCost[1].cost).toBe(12.38);
    expect(state.usageProviders).toHaveLength(1);
    expect(state.usageProviders[0].provider).toBe("moonshot");
    // resetAt is transformed to resetsInMs
    expect(state.usageProviders[0].windows[0].resetsInMs).toBeGreaterThan(0);
  });

  it("S-US-02: partial failure — cost ok but status fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          daily: [{ date: "2026-03-19", totalCost: 5.0 }],
        }),
      })
      .mockResolvedValueOnce({ ok: false });

    await useModelsStore.getState().fetchUsageSummary();

    const state = useModelsStore.getState();
    expect(state.usageCost).toHaveLength(1);
    expect(state.usageProviders).toEqual([]);
  });

  it("S-US-03: both fail — keeps original values", async () => {
    const original = [{ date: "old", cost: 1 }];
    useModelsStore.setState({ usageCost: original });

    mockFetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false });

    await useModelsStore.getState().fetchUsageSummary();

    expect(useModelsStore.getState().usageCost).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// §7 Boundary Conditions (P3)
// ---------------------------------------------------------------------------

describe("boundary conditions", () => {
  it("BC-01: fetchCatalog propagates network error but resets loading", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // fetchCatalog lets the error propagate but still resets catalogLoading via finally
    await expect(useModelsStore.getState().fetchCatalog()).rejects.toThrow("Network error");

    const state = useModelsStore.getState();
    expect(state.catalogModels).toEqual([]);
    expect(state.catalogLoading).toBe(false);
  });

  it("BC-05: fetchFallbacks handles malformed JSON in raw", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: "NOT-VALID-JSON{{{", hash: "bad" }),
    });

    // Should not throw
    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.primaryModel).toBeNull();
    expect(state.fallbacks).toEqual([]);
  });

  it("BC-05b: fetchFallbacks handles raw that is not a string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw: 12345, hash: "num" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.primaryModel).toBeNull();
    expect(state.configRaw).toBeNull();
  });

  it("BC-05c: fetchFallbacks handles deeply nested null values", async () => {
    const raw = JSON.stringify({ agents: null });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ raw, hash: "null-agents" }),
    });

    await useModelsStore.getState().fetchFallbacks();

    const state = useModelsStore.getState();
    expect(state.primaryModel).toBeNull();
    expect(state.fallbacks).toEqual([]);
  });

  it("BC-06: updateFallbacks returns false when configRaw is null", async () => {
    useModelsStore.setState({ configRaw: null, configHash: null });

    const result = await useModelsStore.getState().updateFallbacks("a/b", []);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("BC-07: fetchUsageSummary handles gateway response shape", async () => {
    const now = Date.now();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          daily: [{ date: "2026-03-19", totalCost: 5.0 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: [
            {
              provider: "moonshot",
              displayName: "Moonshot",
              windows: [
                { label: "Daily", usedPercent: 30, resetAt: now + 10000 },
                { label: "Monthly", usedPercent: 10, resetAt: now + 500000 },
              ],
              plan: "Pro",
            },
          ],
        }),
      });

    await useModelsStore.getState().fetchUsageSummary();

    const state = useModelsStore.getState();
    expect(state.usageCost).toHaveLength(1);
    expect(state.usageCost[0].cost).toBe(5.0);
    // Provider with multiple windows
    expect(state.usageProviders).toHaveLength(1);
    expect(state.usageProviders[0].windows).toHaveLength(2);
  });

  it("fetchCatalog handles plain array response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    });

    await useModelsStore.getState().fetchCatalog();

    expect(useModelsStore.getState().catalogModels).toHaveLength(3);
  });

  it("fetchAuthOverview handles plain array response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuthOverview,
    });

    await useModelsStore.getState().fetchAuthOverview();

    expect(useModelsStore.getState().authOverview).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// §3.8 fetchUsableModels
// ---------------------------------------------------------------------------

describe("fetchUsableModels", () => {
  afterEach(() => {
    // Restore shared mockFetch after tests that override global.fetch
    global.fetch = mockFetch;
  });

  it("fetches configured models and filters by auth status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek", authStatus: "ready" },
          { id: "gpt-5.4", name: "GPT 5.4", provider: "openai", authStatus: "missing" },
        ],
      }),
    });

    await useModelsStore.getState().fetchUsableModels();
    const state = useModelsStore.getState();
    // Only "ready" models should be included
    expect(state.usableModels).toHaveLength(1);
    expect(state.usableModels[0].id).toBe("deepseek-chat");
  });

  it("falls back to catalog when configured endpoint fails", async () => {
    // First call to /api/models/configured fails
    // Second call to /api/models succeeds (fetchCatalog fallback)
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ id: "claude-4", name: "Claude 4", provider: "anthropic" }],
        }),
      });

    await useModelsStore.getState().fetchUsableModels();
    const state = useModelsStore.getState();
    expect(state.usableModels).toHaveLength(1);
    expect(state.usableModels[0].id).toBe("claude-4");
  });

  it("includes warning status models as usable", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { id: "kimi-k2.5", name: "Kimi K2.5", provider: "moonshot", authStatus: "warning" },
          { id: "gpt-5.4", name: "GPT 5.4", provider: "openai", authStatus: "ready" },
          { id: "claude-4", name: "Claude 4", provider: "anthropic", authStatus: "unknown" },
        ],
      }),
    });

    await useModelsStore.getState().fetchUsableModels();
    const state = useModelsStore.getState();
    expect(state.usableModels).toHaveLength(2);
    expect(state.usableModels.map((m) => m.id)).toEqual(["kimi-k2.5", "gpt-5.4"]);
  });
});
