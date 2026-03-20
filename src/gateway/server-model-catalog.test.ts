import { describe, expect, it, vi } from "vitest";
import { __setModelCatalogImportForTest } from "../agents/model-catalog.js";
import {
  installModelCatalogTestHooks,
  type PiSdkModule,
} from "../agents/model-catalog.test-harness.js";
import type { OpenClawConfig } from "../config/config.js";

// Mock loadConfig to return a controllable config with model provider pricing.
let mockConfig: OpenClawConfig = {} as OpenClawConfig;

vi.mock("../config/config.js", () => ({
  loadConfig: () => mockConfig,
}));

function mockPiDiscoveryModels(models: unknown[]) {
  __setModelCatalogImportForTest(
    async () =>
      ({
        discoverAuthStorage: () => ({}),
        AuthStorage: class {},
        ModelRegistry: class {
          getAll() {
            return models;
          }
        },
      }) as unknown as PiSdkModule,
  );
}

describe("loadGatewayModelCatalog", () => {
  installModelCatalogTestHooks();

  it("merges cost and maxTokens from config onto catalog entries", async () => {
    mockPiDiscoveryModels([
      { id: "claude-sonnet-4-20250514", provider: "anthropic", name: "Claude Sonnet 4" },
      { id: "gpt-4.1", provider: "openai", name: "GPT-4.1" },
    ]);

    mockConfig = {
      models: {
        providers: {
          anthropic: {
            baseUrl: "https://api.anthropic.com",
            models: [
              {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                reasoning: false,
                input: ["text", "image"],
                cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      },
    } as OpenClawConfig;

    // Dynamic import to get the module after mocks are set up.
    const { loadGatewayModelCatalog } = await import("./server-model-catalog.js");
    const catalog = await loadGatewayModelCatalog();

    const sonnet = catalog.find((m) => m.id === "claude-sonnet-4-20250514");
    expect(sonnet).toBeDefined();
    expect(sonnet!.cost).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
    expect(sonnet!.maxTokens).toBe(8192);

    // gpt-4.1 has no config entry, so cost/maxTokens should remain undefined.
    const gpt = catalog.find((m) => m.id === "gpt-4.1");
    expect(gpt).toBeDefined();
    expect(gpt!.cost).toBeUndefined();
    expect(gpt!.maxTokens).toBeUndefined();
  });

  it("does not overwrite cost if already present on the catalog entry", async () => {
    // Simulate a provider model that already has cost set (e.g. from opt-in merge).
    mockPiDiscoveryModels([
      {
        id: "google/gemini-3-pro-preview",
        provider: "kilocode",
        name: "Gemini 3 Pro Preview",
      },
    ]);

    mockConfig = {
      models: {
        providers: {
          kilocode: {
            baseUrl: "https://api.kilo.ai/api/gateway/",
            api: "openai-completions",
            models: [
              {
                id: "google/gemini-3-pro-preview",
                name: "Gemini 3 Pro Preview",
                reasoning: true,
                input: ["text", "image"],
                cost: { input: 1.25, output: 5, cacheRead: 0.3, cacheWrite: 1.25 },
                contextWindow: 1048576,
                maxTokens: 65536,
              },
            ],
          },
        },
      },
    } as OpenClawConfig;

    const { loadGatewayModelCatalog } = await import("./server-model-catalog.js");
    const catalog = await loadGatewayModelCatalog();

    const gemini = catalog.find((m) => m.id === "google/gemini-3-pro-preview");
    expect(gemini).toBeDefined();
    expect(gemini!.cost).toEqual({ input: 1.25, output: 5, cacheRead: 0.3, cacheWrite: 1.25 });
    expect(gemini!.maxTokens).toBe(65536);
  });

  it("handles missing models.providers gracefully", async () => {
    mockPiDiscoveryModels([{ id: "gpt-4.1", provider: "openai", name: "GPT-4.1" }]);

    mockConfig = {} as OpenClawConfig;

    const { loadGatewayModelCatalog } = await import("./server-model-catalog.js");
    const catalog = await loadGatewayModelCatalog();

    expect(catalog).toHaveLength(1);
    expect(catalog[0].cost).toBeUndefined();
    expect(catalog[0].maxTokens).toBeUndefined();
  });

  it("includes custom provider models from config", async () => {
    mockPiDiscoveryModels([]);
    mockConfig = {
      models: {
        providers: {
          "my-llm": {
            baseUrl: "https://api.my-llm.com/v1",
            api: "openai-completions",
            models: [
              {
                id: "my-model-7b",
                name: "My Model 7B",
                reasoning: false,
                input: ["text"],
                cost: { input: 0.5, output: 1.0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 32768,
                maxTokens: 4096,
              },
            ],
          },
        },
      },
    } as unknown as OpenClawConfig;

    const { loadGatewayModelCatalog } = await import("./server-model-catalog.js");
    const catalog = await loadGatewayModelCatalog();
    const customModel = catalog.find((m) => m.provider === "my-llm" && m.id === "my-model-7b");
    expect(customModel).toBeDefined();
    expect(customModel!.name).toBe("My Model 7B");
    expect(customModel!.contextWindow).toBe(32768);
    expect(customModel!.cost?.input).toBe(0.5);
  });

  it("does not duplicate Pi SDK native provider models from config", async () => {
    mockPiDiscoveryModels([{ id: "deepseek-chat", provider: "deepseek", name: "DeepSeek Chat" }]);
    mockConfig = {
      models: {
        providers: {
          deepseek: {
            baseUrl: "https://api.deepseek.com",
            models: [
              {
                id: "deepseek-chat",
                name: "DeepSeek Chat Override",
                reasoning: false,
                input: ["text"],
                cost: { input: 0.14, output: 0.28, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 65536,
                maxTokens: 4096,
              },
            ],
          },
        },
      },
    } as unknown as OpenClawConfig;

    const { loadGatewayModelCatalog } = await import("./server-model-catalog.js");
    const catalog = await loadGatewayModelCatalog();
    const deepseekModels = catalog.filter(
      (m) => m.provider === "deepseek" && m.id === "deepseek-chat",
    );
    expect(deepseekModels).toHaveLength(1);
  });

  it("matches provider and model id case-insensitively", async () => {
    mockPiDiscoveryModels([
      { id: "Claude-Sonnet-4", provider: "Anthropic", name: "Claude Sonnet 4" },
    ]);

    mockConfig = {
      models: {
        providers: {
          anthropic: {
            baseUrl: "https://api.anthropic.com",
            models: [
              {
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
                reasoning: false,
                input: ["text"],
                cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      },
    } as OpenClawConfig;

    const { loadGatewayModelCatalog } = await import("./server-model-catalog.js");
    const catalog = await loadGatewayModelCatalog();

    const sonnet = catalog.find((m) => m.id === "Claude-Sonnet-4");
    expect(sonnet).toBeDefined();
    expect(sonnet!.cost).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 });
    expect(sonnet!.maxTokens).toBe(8192);
  });
});
