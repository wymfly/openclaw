// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "../../../i18n/config";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ModelsPanel } from "./ModelsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchModelUsageCost: vi.fn(),
  fetchModelUsageProviders: vi.fn(),
  fetchModelsConfig: vi.fn(),
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

function renderModelsPanel(locale: Locale = "en") {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale }, createElement(ModelsPanel)));
}

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
          imageModel: {
            primary: "openai/gpt-4o",
            fallbacks: [],
          },
        },
      },
      models: {
        providers: {
          anthropic: {
            api: "anthropic-messages",
            apiKey: { id: "ANTHROPIC_API_KEY", provider: "default", source: "env" },
            auth: "api-key",
            baseUrl: "https://api.anthropic.com/v1",
            models: [
              { id: "claude-4.6", name: "Claude 4.6", contextWindow: 200000, maxTokens: 8192 },
            ],
          },
          openai: {
            api: "openai-responses",
            apiKey: { id: "OPENAI_API_KEY", provider: "default", source: "env" },
            auth: "api-key",
            baseUrl: "https://api.openai.com/v1",
            models: [
              { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 200000, maxTokens: 8192 },
              { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxTokens: 4096 },
            ],
          },
        },
      },
    },
    null,
    2,
  );
}

function clickButton(label: string | RegExp) {
  const button = Array.from(container.querySelectorAll("button")).find((entry) =>
    typeof label === "string"
      ? entry.textContent?.includes(label)
      : label.test(entry.textContent ?? ""),
  );
  expect(button, `button ${String(label)} should exist`).toBeTruthy();
  fireEvent.click(button!);
}

function firstInputByLabel(label: string) {
  const element = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ),
  ).find((entry) => entry.getAttribute("aria-label") === label);
  expect(element, `field ${label} should exist`).toBeTruthy();
  return element!;
}

function rowByText(text: string) {
  const row = Array.from(container.querySelectorAll<HTMLElement>(".models-row")).find((entry) =>
    entry.textContent?.includes(text),
  );
  expect(row, `row ${text} should exist`).toBeTruthy();
  return row!;
}

async function renderReady(locale: Locale = "en") {
  await act(async () => {
    renderModelsPanel(locale);
  });
  await waitFor(() => expect(apiMocks.fetchModelsConfig).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(container.querySelector('[data-testid="models-panel"]')).toBeTruthy());
}

describe("ModelsPanel prototype parity shell", () => {
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
      providers: [
        {
          displayName: "OpenAI",
          plan: "team",
          provider: "openai",
          windows: [
            { label: "daily", usedPercent: 40 },
            { label: "hourly", usedPercent: 90 },
          ],
        },
      ],
      updatedAt: 1_761_234_567_000,
    });
    apiMocks.fetchRuntimeConfiguredModels.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        models: [
          {
            authStatus: "ready",
            contextWindow: 200000,
            cost: { input: 3, output: 15 },
            id: "gpt-5.4",
            input: ["text"],
            maxTokens: 8192,
            modelIdentifier: "openai/gpt-5.4",
            name: "GPT-5.4",
            provider: "openai",
            reasoning: true,
          },
          {
            authStatus: "ready",
            contextWindow: 128000,
            id: "gpt-4o",
            input: ["text", "image"],
            maxTokens: 4096,
            modelIdentifier: "openai/gpt-4o",
            name: "GPT-4o",
            provider: "openai",
          },
          {
            authStatus: "warning",
            contextWindow: 200000,
            id: "sonnet-4.6",
            maxTokens: 8192,
            modelIdentifier: "anthropic/sonnet-4.6",
            name: "Claude Sonnet 4.6",
            provider: "anthropic",
          },
        ],
      },
    });
    apiMocks.fetchRuntimeModelAuthOverview.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        providers: [
          {
            auth: { source: "env", type: "api_key" },
            authPresent: true,
            configPresent: true,
            provider: "openai",
            scope: "global",
            source: "config",
            status: "ready",
          },
          {
            auth: { source: "env", type: "api_key" },
            authPresent: false,
            configPresent: true,
            cooldown: { reason: "rate_limited", remainingMs: 5_400_000 },
            provider: "anthropic",
            scope: "global",
            source: "config",
            status: "warning",
          },
        ],
      },
    });
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        providers: [
          {
            api: "anthropic-messages",
            authType: "api-key",
            displayName: "Claude Catalog",
            id: "anthropic",
            modelCount: 1,
            models: [{ id: "claude-4.6", name: "Claude 4.6", maxTokens: 8192 }],
          },
          {
            api: "openai-responses",
            authType: "api-key",
            defaultBaseUrl: "https://api.openai.com/v1",
            displayName: "OpenAI Catalog",
            id: "openai",
            modelCount: 2,
            models: [
              { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 200000, maxTokens: 8192 },
              { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", contextWindow: 128000, maxTokens: 4096 },
            ],
          },
        ],
      },
    });
    apiMocks.lookupConfigPath.mockResolvedValue({
      children: [{ key: "openai", path: "models.providers.openai" }],
      path: "models.providers",
      schema: { type: "object" },
    });
    apiMocks.probeRuntimeModelAuth.mockResolvedValue({
      runtimeId: "rt_local",
      payload: { latencyMs: 42, provider: "openai", status: "ok" },
    });
    apiMocks.saveModelsConfig.mockResolvedValue({ hash: "h2", ok: true });
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

  it("loads contract-backed model list through the BFF/runtime wrappers", async () => {
    await renderReady();

    expect(apiMocks.fetchRuntimeConfiguredModels).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchRuntimeModelAuthOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchRuntimeModelCatalogProviders).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchModelUsageCost).toHaveBeenCalledWith(14);
    expect(apiMocks.fetchModelUsageProviders).toHaveBeenCalledTimes(1);
    expect(apiMocks.lookupConfigPath).toHaveBeenCalledWith("models.providers");
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.textContent).toContain("Models");
    expect(container.textContent).toContain("Inspect runtime-configured models");
    expect(container.textContent).toContain("GPT-5.4");
    expect(container.textContent).toContain("Claude Sonnet 4.6");
    expect(container.textContent).toContain("hash h1");
  });

  it("filters the list and opens a six-tab model detail surface", async () => {
    await renderReady();

    fireEvent.change(firstInputByLabel("Search models"), { target: { value: "sonnet" } });
    await waitFor(() => expect(container.textContent).toContain("Claude Sonnet 4.6"));
    expect(container.textContent).not.toContain("GPT-4o");

    await act(async () => {
      fireEvent.click(rowByText("Claude Sonnet 4.6"));
    });

    expect(container.textContent).toContain("/ Anthropic / Claude Sonnet 4.6");
    for (const tab of ["Overview", "Limits", "Pricing", "Usage", "Auth", "Audit"]) {
      expect(container.textContent).toContain(tab);
    }
    await act(async () => {
      clickButton("Usage");
    });
    await waitFor(() => expect(container.textContent).toContain("Usage pressure"));
    await act(async () => {
      clickButton("Audit");
    });
    await waitFor(() => expect(container.textContent).toContain("No audit contract"));
    await act(async () => {
      clickButton(/^Models$/);
    });
    expect(container.textContent).toContain("Inspect runtime-configured models");
  });

  it("adds a catalog model through the dialog and saves through /models/config", async () => {
    await renderReady();

    await act(async () => {
      clickButton("Add from catalog");
    });
    await waitFor(() => expect(container.textContent).toContain("OpenAI Catalog"));
    await act(async () => {
      clickButton("OpenAI Catalog");
    });
    await waitFor(() => expect(container.textContent).toContain("GPT-5.4 Mini"));
    await act(async () => {
      clickButton("GPT-5.4 Mini");
    });
    await waitFor(() => expect(container.textContent).toContain("openai/gpt-5.4-mini"));
    await act(async () => {
      clickButton("Add to runtime");
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    const savedRaw = apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0] as string;
    expect(savedRaw).toContain("gpt-5.4-mini");
    expect(savedRaw).toContain("openai-responses");
    expect(apiMocks.saveModelsConfig.mock.calls.at(-1)?.[1]).toBe("h1");
  });

  it("keeps raw config as advanced save authority", async () => {
    await renderReady();

    await act(async () => {
      fireEvent.click(rowByText("GPT-5.4"));
    });
    const details = container.querySelector("details.models-advanced") as HTMLDetailsElement;
    await act(async () => {
      details.open = true;
    });

    const nextRaw = JSON.stringify({ models: { providers: { openai: { api: "responses" } } } });
    fireEvent.change(firstInputByLabel("Models config"), { target: { value: nextRaw } });
    await act(async () => {
      clickButton("Save models config");
    });

    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalledWith(nextRaw, "h1"));
  });

  it("configures auth and probes through supported mutation wrappers", async () => {
    await renderReady();

    await act(async () => {
      fireEvent.click(rowByText("GPT-5.4"));
    });
    await act(async () => {
      clickButton("Auth");
    });
    await waitFor(() => expect(container.textContent).toContain("Auth configuration"));
    await act(async () => {
      clickButton("Configure auth");
    });
    await waitFor(() => expect(container.textContent).toContain("Configure auth - OpenAI"));
    fireEvent.change(container.querySelector('input[placeholder="OPENAI_API_KEY"]')!, {
      target: { value: "OPENAI_E2E_KEY" },
    });
    await act(async () => {
      clickButton("Save auth");
    });
    await waitFor(() => expect(apiMocks.saveModelsConfig).toHaveBeenCalled());
    expect(apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0]).toContain("OPENAI_E2E_KEY");
    expect(apiMocks.saveModelsConfig.mock.calls.at(-1)?.[0]).not.toContain("apiKeyEnv");

    await act(async () => {
      clickButton("Run probe");
    });
    await waitFor(() => expect(apiMocks.probeRuntimeModelAuth).toHaveBeenCalledWith("openai"));
    expect(container.textContent).toContain("Probe GPT-5.4");
    expect(container.textContent).toContain("42ms");
  });

  it("renders localized Chinese model chrome", async () => {
    await renderReady("zh");

    expect(container.textContent).toContain("模型");
    expect(container.textContent).toContain("检查运行时模型");
    expect(container.textContent).toContain("从目录添加");
    expect(container.textContent).toContain("默认");
  });
});
