// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsPanel } from "./ModelsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchModelsConfig: vi.fn(),
  fetchModelUsageCost: vi.fn(),
  fetchModelUsageProviders: vi.fn(),
  fetchRuntimeConfiguredModels: vi.fn(),
  fetchRuntimeModelAuthOverview: vi.fn(),
  fetchRuntimeModelCatalogProviders: vi.fn(),
  lookupConfigPath: vi.fn(),
  probeRuntimeModelAuth: vi.fn(),
  saveModelsConfig: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function rawModelsConfig() {
  return JSON.stringify(
    {
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5.4",
            fallbacks: ["anthropic/sonnet-4.6"],
            sendPolicy: "session",
          },
          imageModel: "openai/gpt-image-1",
        },
      },
      models: {
        providers: {
          openai: { apiKeyEnv: "OPENAI_API_KEY" },
          anthropic: { models: ["claude-4.6"] },
        },
      },
    },
    null,
    2,
  );
}

function rawModelsConfigWithBedrock() {
  const parsed = JSON.parse(rawModelsConfig()) as {
    models: { bedrockDiscovery?: Record<string, unknown> };
  };
  parsed.models.bedrockDiscovery = {
    enabled: true,
    region: "us-east-1",
    providerFilter: ["anthropic", "amazon"],
    refreshInterval: 3600,
    defaultContextWindow: 200000,
    defaultMaxTokens: 4096,
  };
  return JSON.stringify(parsed, null, 2);
}

function lookupPayload(path = "models.providers") {
  return {
    path,
    schema: { type: "object" },
    children: [
      {
        key: "anthropic",
        path: "models.providers.anthropic",
        required: false,
        hasChildren: true,
      },
      {
        key: "openai",
        path: "models.providers.openai",
        required: false,
        hasChildren: true,
      },
    ],
  };
}

describe("ModelsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchModelsConfig.mockResolvedValue({ raw: rawModelsConfig(), hash: "h1" });
    apiMocks.fetchModelUsageCost.mockResolvedValue({
      days: 14,
      daily: [
        { date: "2026-04-23", totalCost: 1.25 },
        { date: "2026-04-24", totalCost: 3.25 },
      ],
    });
    apiMocks.fetchModelUsageProviders.mockResolvedValue({
      updatedAt: 1_761_234_567_000,
      providers: [
        {
          provider: "openai",
          displayName: "OpenAI",
          plan: "team",
          windows: [
            { label: "daily", usedPercent: 40 },
            { label: "hourly", usedPercent: 90 },
          ],
        },
        {
          provider: "anthropic",
          displayName: "Anthropic",
          plan: "pro",
          windows: [{ label: "daily", usedPercent: 50 }],
        },
      ],
    });
    apiMocks.fetchRuntimeConfiguredModels.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        models: [
          {
            id: "gpt-5.4",
            name: "GPT-5.4",
            provider: "openai",
            contextWindow: 200000,
            cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
            input: ["text"],
            maxTokens: 8192,
            reasoning: true,
            authStatus: "ready",
            source: "config",
            scope: "global",
            editable: true,
          },
          {
            modelIdentifier: "anthropic/sonnet-4.6",
            name: "Claude Sonnet 4.6",
            contextWindow: 200000,
            input: ["text"],
            maxTokens: 8192,
            authStatus: "warning",
          },
          {
            id: "gpt-4o",
            name: "GPT-4o",
            provider: "openai",
            contextWindow: 128000,
            input: ["text", "image"],
            maxTokens: 4096,
            authStatus: "ready",
          },
        ],
      },
    });
    apiMocks.fetchRuntimeModelAuthOverview.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        providers: [
          {
            provider: "openai",
            status: "ready",
            source: "config",
            scope: "global",
            configPresent: true,
            authPresent: true,
            editable: true,
            auth: { type: "api_key", source: "env" },
            oauth: { status: "ok", remainingMs: 90_000_000, expiresAt: 1760000000000 },
          },
          {
            provider: "anthropic",
            status: "warning",
            source: "config",
            scope: "global",
            configPresent: true,
            authPresent: false,
            editable: true,
            auth: { type: "api_key", source: "env" },
            cooldown: {
              reason: "rate_limited",
              remainingMs: 5_400_000,
              until: 1760000000000,
            },
          },
        ],
      },
    });
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        providers: [
          {
            id: "openai",
            displayName: "OpenAI Catalog",
            api: "openai-responses",
            authType: "api-key",
            modelCount: 2,
            defaultBaseUrl: "https://api.openai.com/v1",
            models: [
              {
                id: "gpt-5.4",
                name: "GPT-5.4",
                contextWindow: 200000,
                maxTokens: 8192,
                reasoning: true,
              },
              {
                id: "gpt-5.4-mini",
                name: "GPT-5.4 Mini",
                contextWindow: 128000,
                maxTokens: 4096,
                reasoning: false,
              },
            ],
          },
          {
            id: "anthropic",
            displayName: "Claude Catalog",
            api: "anthropic-messages",
            authType: "api-key",
            modelCount: 2,
            models: [
              {
                id: "claude-4.6",
                name: "Claude 4.6",
                contextWindow: 200000,
                maxTokens: 8192,
                reasoning: true,
              },
              {
                id: "claude-haiku",
                name: "Claude Haiku",
                contextWindow: 200000,
                maxTokens: 4096,
                reasoning: false,
              },
            ],
          },
        ],
      },
    });
    apiMocks.lookupConfigPath.mockImplementation((path: string) =>
      Promise.resolve(lookupPayload(path)),
    );
    apiMocks.probeRuntimeModelAuth.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        provider: "openai",
        status: "ok",
        latencyMs: 42,
      },
    });
    apiMocks.saveModelsConfig.mockResolvedValue({ ok: true, hash: "h2" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.clearAllMocks();
  });

  it("loads raw models config, provider inventory, and default schema lookup", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(apiMocks.fetchModelsConfig).toHaveBeenCalledTimes(1));
    expect(apiMocks.fetchRuntimeConfiguredModels).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchRuntimeModelAuthOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchRuntimeModelCatalogProviders).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchModelUsageCost).toHaveBeenCalledWith(14);
    expect(apiMocks.fetchModelUsageProviders).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(container.textContent).toContain("Models ready"));

    expect(apiMocks.lookupConfigPath).toHaveBeenCalledWith("models.providers");
    expect(container.querySelector(".deck-ui-models")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-models-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-models-body")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-models-status-row")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-models-stats").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".deck-ui-models-surface").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".deck-ui-models-hero").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".deck-ui-models-row").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".deck-ui-models-input").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelectorAll(".deck-ui-models-textarea").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".deck-ui-models-button").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.textContent).toContain("2 providers");
    expect(container.textContent).toContain("3 configured models");
    expect(container.textContent).toContain("2 auth providers");
    expect(container.textContent).toContain("2 catalog providers");
    expect(container.textContent).toContain("GPT-5.4");
    expect(container.textContent).toContain("ref: openai/gpt-5.4 | id: gpt-5.4");
    expect(container.textContent).toContain("Claude Sonnet 4.6");
    expect(container.textContent).toContain("ref: anthropic/sonnet-4.6 | id: sonnet-4.6");
    expect(container.textContent).toContain("Model auth overview");
    expect(container.textContent).toContain("ready | source config | scope global");
    expect(container.textContent).toContain("auth present");
    expect(container.textContent).toContain("auth missing");
    expect(container.textContent).toContain("auth API Key");
    expect(container.textContent).toContain("auth source env");
    expect(container.textContent).toContain("oauth ok · 25h 0m");
    expect(container.textContent).toContain("cooldown rate_limited · 1h 30m");
    expect(container.textContent).toContain("Model usage summary");
    expect(container.textContent).toContain("$3.25");
    expect(container.textContent).toContain("$4.50");
    expect(container.textContent).toContain("highest pressure");
    expect(container.textContent).toContain("90%");
    expect(container.textContent).toContain("OpenAI");
    expect(container.textContent).toContain("daily: 40%");
    expect(container.textContent).toContain("hourly: 90%");
    expect(container.textContent).toContain("Catalog providers");
    expect(container.textContent).toContain("OpenAI Catalog");
    expect(container.textContent).toContain("Claude Catalog");
    expect(container.textContent).toContain("api openai-responses | auth api-key | models 2");
    expect(container.textContent).toContain("Default model chain");
    expect(container.textContent).toContain("hash h1");
    expect(container.textContent).toContain("anthropic");
    expect(container.textContent).toContain("openai");
    expect(container.textContent).toContain("keys: models");
    expect(container.textContent).toContain("keys: apiKeyEnv");
    expect(container.textContent).toContain("2 schema children");
  });

  it("looks up edited schema paths and saves the raw models config with the base hash", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Models ready"));
    await waitFor(() => expect(container.textContent).toContain("2 schema children"));

    const pathInput = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(pathInput, { target: { value: " models.providers.openai " } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Lookup schema")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.lookupConfigPath).toHaveBeenLastCalledWith("models.providers.openai"),
    );

    const nextRaw = JSON.stringify({ models: { providers: { openai: { model: "gpt-5.4" } } } });
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: nextRaw } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalledWith(nextRaw, "h1"));
    expect(container.textContent).toContain("Last save result");
  });

  it("edits default text and image fallback chains while preserving object fields", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Models ready"));

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="Primary model"]')!, {
        target: { value: "anthropic/sonnet-4.6" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Fallback models"]')!, {
        target: { value: "openai/gpt-5.4, local/qwen" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Image primary model"]')!, {
        target: { value: "openai/gpt-image-2" },
      });
    });

    await act(async () => {
      fireEvent.change(container.querySelector('select[aria-label="Add text fallback"]')!, {
        target: { value: "openai/gpt-4o" },
      });
    });

    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent === "Add text fallback")
          ?.hasAttribute("disabled"),
      ).toBe(false),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add text fallback")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(
        container.querySelector('button[aria-label="Move up text fallback openai/gpt-4o"]'),
      ).not.toBeNull(),
    );

    await act(async () => {
      container
        .querySelector('button[aria-label="Move up text fallback openai/gpt-4o"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      container
        .querySelector('button[aria-label="Remove text fallback local/qwen"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.change(container.querySelector('select[aria-label="Add image fallback"]')!, {
        target: { value: "openai/gpt-4o" },
      });
    });

    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent === "Add image fallback")
          ?.hasAttribute("disabled"),
      ).toBe(false),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add image fallback")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      agents: {
        defaults: {
          model: { primary: string; fallbacks: string[]; sendPolicy?: string };
          imageModel: { primary: string; fallbacks: string[] };
        };
      };
    };
    expect(saved.agents.defaults.model).toMatchObject({
      primary: "anthropic/sonnet-4.6",
      fallbacks: ["openai/gpt-5.4", "openai/gpt-4o"],
      sendPolicy: "session",
    });
    expect(saved.agents.defaults.imageModel).toMatchObject({
      primary: "openai/gpt-image-2",
      fallbacks: ["openai/gpt-4o"],
    });
  });

  it("filters runtime model catalog and applies model quick actions", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("3 visible"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Filter Vision")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("1 visible"));
    expect(container.textContent).toContain("GPT-4o");
    expect(container.textContent).toContain("inputtext, image");
    expect(container.textContent).toContain("context128K");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Set default openai/gpt-4o")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Set image default openai/gpt-4o")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Filter Vision")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("3 visible"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add fallback anthropic/sonnet-4.6")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      agents: {
        defaults: {
          model: { primary: string; fallbacks: string[]; sendPolicy?: string };
          imageModel: { primary: string };
        };
      };
    };
    expect(saved.agents.defaults.model).toMatchObject({
      primary: "openai/gpt-4o",
      fallbacks: ["anthropic/sonnet-4.6"],
      sendPolicy: "session",
    });
    expect(saved.agents.defaults.imageModel.primary).toBe("openai/gpt-4o");
  });

  it("edits provider config fields and fills missing defaults from catalog providers", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Use catalog openai"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Use catalog openai")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(
        (container.querySelector('input[aria-label="Provider API"]') as HTMLInputElement).value,
      ).toBe("openai-responses"),
    );

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="Provider API key env"]')!, {
        target: { value: "OPENAI_NEXT_KEY" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Provider API key"]')!, {
        target: { value: "fake-key" },
      });
      fireEvent.click(container.querySelector('input[aria-label="Provider auth header"]')!);
      fireEvent.click(container.querySelector('input[aria-label="Provider inject num ctx"]')!);
      fireEvent.change(container.querySelector('textarea[aria-label="Provider models JSON"]')!, {
        target: {
          value:
            '[{ "id": "gpt-5.4", "name": "GPT-5.4", "contextWindow": 200000, "maxTokens": 8192, "reasoning": true }, { "id": "gpt-5.4-mini", "name": "GPT-5.4 Mini" }]',
        },
      });
    });

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="Provider header name"]')!, {
        target: { value: "x-openclaw-provider" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Provider header value"]')!, {
        target: { value: "openai" },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add provider header")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: {
        providers: {
          openai: {
            api: string;
            auth: string;
            baseUrl: string;
            apiKeyEnv: string;
            apiKey: string;
            authHeader: boolean;
            injectNumCtxForOpenAICompat: boolean;
            headers: Record<string, string>;
            models: Array<{
              id: string;
              name: string;
              contextWindow?: number;
              maxTokens?: number;
              reasoning?: boolean;
            }>;
          };
          anthropic: { models: string[] };
        };
      };
    };
    expect(saved.models.providers.openai).toMatchObject({
      api: "openai-responses",
      auth: "api-key",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_NEXT_KEY",
      apiKey: "fake-key",
      authHeader: true,
      injectNumCtxForOpenAICompat: true,
      headers: { "x-openclaw-provider": "openai" },
    });
    expect(saved.models.providers.openai.models[0]).toMatchObject({
      id: "gpt-5.4",
      name: "GPT-5.4",
      contextWindow: 200000,
      maxTokens: 8192,
      reasoning: true,
    });
    expect(saved.models.providers.openai.models[1]).toMatchObject({
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
    });
    expect(saved.models.providers.anthropic.models).toEqual(["claude-4.6"]);
  });

  it("applies catalog provider post-add actions to the default chain", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Set catalog default anthropic"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Set catalog default anthropic")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add catalog fallback openai")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      agents: {
        defaults: {
          model: { primary: string; fallbacks: string[]; sendPolicy?: string };
        };
      };
      models: {
        providers: {
          openai: { api?: string; auth?: string; baseUrl?: string };
        };
      };
    };
    expect(saved.agents.defaults.model).toMatchObject({
      primary: "anthropic/claude-4.6",
      fallbacks: ["anthropic/sonnet-4.6", "openai/gpt-5.4"],
      sendPolicy: "session",
    });
    expect(saved.models.providers.openai).toMatchObject({
      api: "openai-responses",
      auth: "api-key",
      baseUrl: "https://api.openai.com/v1",
    });
  });

  it("applies only selected catalog models from the old wizard checkbox flow", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Catalog model selection"));

    const miniToggle = container.querySelector(
      'input[aria-label="Catalog model openai/gpt-5.4-mini"]',
    ) as HTMLInputElement;
    expect(miniToggle.checked).toBe(true);

    await act(async () => {
      fireEvent.click(miniToggle);
    });

    expect(miniToggle.checked).toBe(false);
    expect(container.textContent).toContain("1 / 2 selected");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Use catalog openai")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: {
        providers: {
          openai: {
            models: Array<{ id: string; name?: string; contextWindow?: number }>;
          };
        };
      };
    };
    expect(saved.models.providers.openai.models).toHaveLength(1);
    expect(saved.models.providers.openai.models[0]).toMatchObject({
      id: "gpt-5.4",
      name: "GPT-5.4",
      contextWindow: 200000,
    });
  });

  it("filters catalog providers with the old wizard search behavior", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Catalog providers"));

    const search = container.querySelector(
      'input[aria-label="Catalog provider search"]',
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(search, { target: { value: "anthropic-messages" } });
    });

    expect(container.textContent).toContain("1 visible");
    expect(container.textContent).toContain("Claude Catalog");

    await act(async () => {
      fireEvent.change(search, { target: { value: "not-a-provider" } });
    });

    expect(container.textContent).toContain("No catalog providers match the current search.");
  });

  it("edits provider model entries through structured controls", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Use catalog openai"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Use catalog openai")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("2 entries"));

    await act(async () => {
      fireEvent.change(
        container.querySelector('input[aria-label="Provider model name gpt-5.4"]')!,
        {
          target: { value: "GPT-5.4 tuned" },
        },
      );
      fireEvent.change(
        container.querySelector('input[aria-label="Provider model context gpt-5.4"]')!,
        {
          target: { value: "300000" },
        },
      );
      fireEvent.click(
        container.querySelector('input[aria-label="Provider model image input gpt-5.4"]')!,
      );
      fireEvent.change(
        container.querySelector('input[aria-label="Provider model input cost gpt-5.4"]')!,
        {
          target: { value: "3" },
        },
      );
      fireEvent.change(
        container.querySelector('input[aria-label="Provider model output cost gpt-5.4"]')!,
        {
          target: { value: "15" },
        },
      );
      fireEvent.click(
        container.querySelector('input[aria-label="Provider model compat supportsTools gpt-5.4"]')!,
      );
      fireEvent.change(
        container.querySelector(
          'select[aria-label="Provider model compat max tokens field gpt-5.4"]',
        )!,
        {
          target: { value: "max_completion_tokens" },
        },
      );
      fireEvent.change(
        container.querySelector(
          'select[aria-label="Provider model compat thinking format gpt-5.4"]',
        )!,
        {
          target: { value: "openrouter" },
        },
      );
      fireEvent.change(container.querySelector('input[aria-label="New provider model id"]')!, {
        target: { value: "local-fast" },
      });
      fireEvent.change(container.querySelector('input[aria-label="New provider model name"]')!, {
        target: { value: "Local Fast" },
      });
      fireEvent.change(container.querySelector('input[aria-label="New provider model API"]')!, {
        target: { value: "openai-responses" },
      });
      fireEvent.change(container.querySelector('input[aria-label="New provider model context"]')!, {
        target: { value: "64000" },
      });
      fireEvent.change(
        container.querySelector('input[aria-label="New provider model max tokens"]')!,
        {
          target: { value: "2048" },
        },
      );
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add model entry")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("local-fast"));

    await act(async () => {
      fireEvent.change(
        container.querySelector('input[aria-label="Provider model header gpt-5.4 name"]')!,
        {
          target: { value: "x-openclaw-model" },
        },
      );
      fireEvent.change(
        container.querySelector('input[aria-label="Provider model header gpt-5.4 value"]')!,
        {
          target: { value: "gpt-5.4" },
        },
      );
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add model header")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Remove model gpt-5.4-mini")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: {
        providers: {
          openai: {
            models: Array<{
              id: string;
              name: string;
              api?: string;
              input?: string[];
              contextWindow?: number;
              maxTokens?: number;
              reasoning?: boolean;
              headers?: Record<string, string>;
              compat?: Record<string, unknown>;
            }>;
          };
        };
      };
    };
    expect(saved.models.providers.openai.models).toHaveLength(2);
    expect(saved.models.providers.openai.models[0]).toMatchObject({
      id: "gpt-5.4",
      name: "GPT-5.4 tuned",
      contextWindow: 300000,
      maxTokens: 8192,
      reasoning: true,
      input: ["image"],
      cost: { input: 3, output: 15 },
      headers: { "x-openclaw-model": "gpt-5.4" },
      compat: {
        supportsTools: true,
        maxTokensField: "max_completion_tokens",
        thinkingFormat: "openrouter",
      },
    });
    expect(saved.models.providers.openai.models[1]).toMatchObject({
      id: "local-fast",
      name: "Local Fast",
      api: "openai-responses",
      contextWindow: 64000,
      maxTokens: 2048,
      reasoning: false,
      input: ["text"],
    });
  });

  it("adds all missing catalog models for the selected provider", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Add all 1 catalog models"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add all 1 catalog models")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("claude-haiku"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: {
        providers: {
          anthropic: {
            models: Array<string | { id: string; name?: string; contextWindow?: number }>;
          };
        };
      };
    };
    expect(saved.models.providers.anthropic.models[0]).toBe("claude-4.6");
    expect(saved.models.providers.anthropic.models[1]).toMatchObject({
      id: "claude-haiku",
      name: "Claude Haiku",
      contextWindow: 200000,
    });
  });

  it("adds a custom provider and edits it through the structured config fields", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Models ready"));

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="New provider id"]')!, {
        target: { value: "local-openai" },
      });
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add provider")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("local-openai"));

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="Provider API"]')!, {
        target: { value: "openai-responses" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Provider base URL"]')!, {
        target: { value: "http://127.0.0.1:11434/v1" },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: { providers: { "local-openai": { api: string; baseUrl: string } } };
    };
    expect(saved.models.providers["local-openai"]).toMatchObject({
      api: "openai-responses",
      baseUrl: "http://127.0.0.1:11434/v1",
    });
  });

  it("enables allowlist from default chains and edits per-model entry metadata", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Allowlist off"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Allowlist off")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("Allowlist on"));
    expect(container.textContent).toContain("openai/gpt-image-1");

    await act(async () => {
      fireEvent.change(container.querySelector('input[aria-label="Alias openai/gpt-5.4"]')!, {
        target: { value: "fast-default" },
      });
      fireEvent.click(container.querySelector('input[aria-label="Streaming openai/gpt-5.4"]')!);
      fireEvent.change(container.querySelector('textarea[aria-label="Params openai/gpt-5.4"]')!, {
        target: { value: '{ "temperature": 0.2 }' },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      agents: {
        defaults: {
          models: Record<
            string,
            { alias?: string; streaming?: boolean; params?: Record<string, unknown> }
          >;
        };
      };
    };
    expect(Object.keys(saved.agents.defaults.models).toSorted()).toEqual([
      "anthropic/sonnet-4.6",
      "openai/gpt-5.4",
      "openai/gpt-image-1",
    ]);
    expect(saved.agents.defaults.models["openai/gpt-5.4"]).toEqual({
      alias: "fast-default",
      streaming: true,
      params: { temperature: 0.2 },
    });
  });

  it("turns allowlist off by deleting agents.defaults.models", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Allowlist off"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Allowlist off")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => expect(container.textContent).toContain("Allowlist on"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Allowlist on")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as { agents: { defaults: { models?: unknown } } };
    expect(saved.agents.defaults).not.toHaveProperty("models");
  });

  it("edits bedrock discovery settings through raw models config", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Bedrock discovery"));

    await act(async () => {
      fireEvent.click(container.querySelector('input[aria-label="Bedrock discovery enabled"]')!);
      fireEvent.change(container.querySelector('input[aria-label="Bedrock region"]')!, {
        target: { value: "us-west-2" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Bedrock refresh interval"]')!, {
        target: { value: "7200" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Bedrock default context"]')!, {
        target: { value: "240000" },
      });
      fireEvent.change(container.querySelector('input[aria-label="Bedrock default max tokens"]')!, {
        target: { value: "8192" },
      });
      fireEvent.click(container.querySelector('input[aria-label="Bedrock provider anthropic"]')!);
      fireEvent.click(container.querySelector('input[aria-label="Bedrock provider meta"]')!);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: {
        bedrockDiscovery: {
          enabled: boolean;
          region: string;
          providerFilter: string[];
          refreshInterval: number;
          defaultContextWindow: number;
          defaultMaxTokens: number;
        };
      };
    };
    expect(saved.models.bedrockDiscovery).toEqual({
      enabled: true,
      region: "us-west-2",
      providerFilter: ["anthropic", "meta"],
      refreshInterval: 7200,
      defaultContextWindow: 240000,
      defaultMaxTokens: 8192,
    });
  });

  it("edits the models catalog merge mode through structured controls", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Model catalog mode"));

    await act(async () => {
      fireEvent.change(container.querySelector('select[aria-label="Models catalog mode"]')!, {
        target: { value: "replace" },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as { models: { mode?: string } };
    expect(saved.models.mode).toBe("replace");
  });

  it("turns bedrock discovery off while preserving configured discovery fields", async () => {
    apiMocks.fetchModelsConfig.mockResolvedValue({ raw: rawModelsConfigWithBedrock(), hash: "h1" });

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("discovery on"));

    await act(async () => {
      fireEvent.click(container.querySelector('input[aria-label="Bedrock discovery enabled"]')!);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save models config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    const saved = JSON.parse(savedRaw) as {
      models: { bedrockDiscovery: { enabled: boolean; providerFilter: string[] } };
    };
    expect(saved.models.bedrockDiscovery).toMatchObject({
      enabled: false,
      region: "us-east-1",
      providerFilter: ["anthropic", "amazon"],
      refreshInterval: 3600,
      defaultContextWindow: 200000,
      defaultMaxTokens: 4096,
    });
  });

  it("probes model auth through the runtime model probe route", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(ModelsPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Probe openai"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Probe openai")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.probeRuntimeModelAuth).toHaveBeenCalledWith("openai"));
    expect(apiMocks.fetchRuntimeModelAuthOverview).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Last model probe");
    expect(container.textContent).toContain('"latencyMs": 42');
  });
});
