import { describe, expect, it } from "vitest";
import type { CatalogProviderEntry } from "./models-catalog-providers.js";
import { modelsCatalogProvidersHandlers } from "./models-catalog-providers.js";
import type { GatewayRequestHandlerOptions } from "./types.js";

function mockRespond() {
  const calls: Array<{ ok: boolean; payload: unknown; error: unknown }> = [];
  const fn = (ok: boolean, payload: unknown, error: unknown) => {
    calls.push({ ok, payload, error });
  };
  return { fn, calls };
}

function getProviders(call: { payload: unknown }): CatalogProviderEntry[] {
  return (call.payload as { providers: CatalogProviderEntry[] }).providers;
}

function makeCatalogEntry(provider: string, id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    name: id,
    provider,
    contextWindow: 128000,
    reasoning: false,
    maxTokens: 4096,
    ...overrides,
  };
}

function makeOpts(
  respond: ReturnType<typeof mockRespond>["fn"],
  catalogFn: () => Promise<unknown[]>,
): GatewayRequestHandlerOptions {
  return {
    req: { method: "models.catalog.providers", id: "test" },
    params: {},
    client: null,
    isWebchatConnect: () => false,
    respond,
    context: { loadGatewayModelCatalog: catalogFn },
  } as unknown as GatewayRequestHandlerOptions;
}

describe("models.catalog.providers", () => {
  const handler = modelsCatalogProvidersHandlers["models.catalog.providers"];

  it("groups catalog entries by provider", async () => {
    const { fn, calls } = mockRespond();
    await handler(
      makeOpts(fn, async () => [
        makeCatalogEntry("deepseek", "deepseek-chat"),
        makeCatalogEntry("deepseek", "deepseek-reasoner", { reasoning: true }),
        makeCatalogEntry("openai", "gpt-5.4"),
      ]),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].ok).toBe(true);
    const providers = getProviders(calls[0]);
    expect(providers).toHaveLength(2);
    const deepseek = providers.find((p) => p.id === "deepseek");
    expect(deepseek?.models).toHaveLength(2);
    expect(deepseek?.modelCount).toBe(2);
  });

  it("merges KNOWN_PROVIDER_DEFAULTS for known providers", async () => {
    const { fn, calls } = mockRespond();
    await handler(makeOpts(fn, async () => [makeCatalogEntry("deepseek", "deepseek-chat")]));
    const providers = getProviders(calls[0]);
    const deepseek = providers.find((p) => p.id === "deepseek");
    expect(deepseek?.displayName).toBe("DeepSeek");
    expect(deepseek?.defaultBaseUrl).toBe("https://api.deepseek.com");
    expect(deepseek?.authType).toBe("api-key");
    expect(deepseek?.api).toBe("openai-completions");
  });

  it("falls back to defaults for unknown providers", async () => {
    const { fn, calls } = mockRespond();
    await handler(makeOpts(fn, async () => [makeCatalogEntry("my-custom-llm", "custom-model")]));
    const providers = getProviders(calls[0]);
    const custom = providers.find((p) => p.id === "my-custom-llm");
    expect(custom?.displayName).toBe("my-custom-llm");
    expect(custom?.defaultBaseUrl).toBe("");
    expect(custom?.authType).toBe("api-key");
    expect(custom?.api).toBe("openai-completions");
  });

  it("sorts known providers before unknown", async () => {
    const { fn, calls } = mockRespond();
    await handler(
      makeOpts(fn, async () => [
        makeCatalogEntry("zzz-custom", "model-a"),
        makeCatalogEntry("openai", "gpt-5.4"),
        makeCatalogEntry("aaa-custom", "model-b"),
      ]),
    );
    const ids = getProviders(calls[0]).map((p) => p.id);
    expect(ids[0]).toBe("openai");
    expect(ids[1]).toBe("aaa-custom");
    expect(ids[2]).toBe("zzz-custom");
  });

  it("handles catalog load failure", async () => {
    const { fn, calls } = mockRespond();
    await handler(
      makeOpts(fn, async () => {
        throw new Error("catalog unavailable");
      }),
    );
    expect(calls[0].ok).toBe(false);
  });

  it("applies default contextWindow and maxTokens when missing", async () => {
    const { fn, calls } = mockRespond();
    await handler(makeOpts(fn, async () => [{ id: "model-x", name: "Model X", provider: "test" }]));
    const model = getProviders(calls[0])[0].models[0];
    expect(model.contextWindow).toBe(128000);
    expect(model.maxTokens).toBe(4096);
  });
});
