// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DeckGoModelImpactPreview,
  DeckGoModelProviderEntry,
  DeckGoModelsConfigDetailResponse,
} from "@/api-types";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import type { Locale } from "../../../i18n/config";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ModelsPanel } from "./ModelsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchModelsConfig: vi.fn(),
  fetchModelsConfigDetail: vi.fn(),
  fetchModelUsageCost: vi.fn(),
  fetchModelUsageProviders: vi.fn(),
  fetchRuntimeConfiguredModels: vi.fn(),
  fetchRuntimeModelAuthOverview: vi.fn(),
  fetchRuntimeModelCatalogProviders: vi.fn(),
  lookupConfigPath: vi.fn(),
  probeRuntimeModelAuth: vi.fn(),
  saveModelsConfig: vi.fn(),
  upsertModelProvider: vi.fn(),
  previewProviderDelete: vi.fn(),
  deleteModelProvider: vi.fn(),
  upsertModel: vi.fn(),
  previewModelDelete: vi.fn(),
  deleteModel: vi.fn(),
  setModelsCatalogMode: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function renderPanel(locale: Locale = "en") {
  root = createRoot(container);
  root.render(
    createElement(
      DataFabricTestProvider,
      null,
      createElement(DeckIntlProvider, { locale }, createElement(ModelsPanel)),
    ),
  );
}

function makeProvider(overrides: Partial<DeckGoModelProviderEntry> = {}): DeckGoModelProviderEntry {
  return {
    id: "openai",
    api: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
    auth: "api-key",
    authHeader: false,
    hasHeaders: false,
    apiKeyStatus: { state: "ref", ref: "deck.secrets.openai.apiKey" },
    request: { hasRequest: false },
    isReferenced: false,
    modelCount: 1,
    models: [
      {
        id: "gpt-5.4",
        name: "GPT-5.4",
        api: "openai-responses",
        inheritsApi: true,
        reasoning: false,
        inputs: ["text"],
        contextWindow: 200_000,
        contextTokens: 200_000,
        maxTokens: 8192,
        cost: { input: 5, output: 15 },
        hasHeaders: false,
        compat: { hasCompat: false },
        isReferenced: false,
        isDefault: false,
      },
    ],
    ...overrides,
  };
}

function detailResponse(
  overrides: Partial<DeckGoModelsConfigDetailResponse["detail"]> = {},
): DeckGoModelsConfigDetailResponse {
  return {
    detail: {
      hash: "h1",
      configPresent: true,
      mode: "merge",
      modeSource: "config",
      providers: [makeProvider()],
      runtime: {
        catalogStatus: "available",
        catalogProviderCount: 3,
        authStatus: "available",
        authProviderCount: 2,
        probeStatus: "available",
      },
      ...overrides,
    },
  };
}

const samplePreview: DeckGoModelImpactPreview = {
  scope: "provider.delete",
  severity: "warn",
  references: [],
  impactToken: "tok-1",
  generatedAt: 1_700_000_000_000,
  baseHash: "h1",
};

describe("ModelsPanel rebuild", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchModelsConfig.mockResolvedValue({ raw: "{}", hash: "h1" });
    apiMocks.fetchModelsConfigDetail.mockResolvedValue(detailResponse());
    apiMocks.fetchModelUsageCost.mockResolvedValue({ daily: [], totals: {} });
    apiMocks.fetchModelUsageProviders.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeConfiguredModels.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeModelAuthOverview.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({ providers: [] });
    apiMocks.lookupConfigPath.mockResolvedValue({ path: "models", children: [] });
    apiMocks.probeRuntimeModelAuth.mockResolvedValue({ provider: "openai", status: "ok" });
    Object.values(apiMocks).forEach((fn) => fn.mockClear?.());
    apiMocks.fetchModelsConfig.mockResolvedValue({ raw: "{}", hash: "h1" });
    apiMocks.fetchModelsConfigDetail.mockResolvedValue(detailResponse());
    apiMocks.fetchRuntimeConfiguredModels.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeModelAuthOverview.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({ providers: [] });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("renders the catalog header and provider list when detail is loaded", async () => {
    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-catalog-header"]')).toBeTruthy(),
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-section-openai"]')).toBeTruthy(),
    );
    expect(container.textContent).toContain("openai");
    expect(container.textContent).toContain("GPT-5.4");
  });

  it("shows empty-state CTA when no providers are configured", async () => {
    apiMocks.fetchModelsConfigDetail.mockResolvedValueOnce(detailResponse({ providers: [] }));
    await act(async () => {
      renderPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("No providers configured yet."));
  });

  it("calls upsertModelProvider through typed BFF when wizard submits", async () => {
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({
      providers: [
        {
          id: "openai",
          displayName: "OpenAI",
          api: "openai-responses",
          defaultBaseUrl: "https://api.openai.com/v1",
        },
      ],
    });
    apiMocks.upsertModelProvider.mockResolvedValue({
      ok: true,
      hash: "h2",
      providerId: "anthropic",
    });

    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-catalog-header"]')).toBeTruthy(),
    );

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Add provider"),
    );
    expect(addBtn, "Add provider button").toBeTruthy();
    await act(async () => {
      fireEvent.click(addBtn!);
    });

    const useCustom = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Use custom provider"),
    );
    expect(useCustom).toBeTruthy();
    await act(async () => {
      fireEvent.click(useCustom!);
    });

    const next = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Next",
    );
    expect(next, "Next visible after select").toBeTruthy();
    await act(async () => {
      fireEvent.click(next!);
    });

    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
    );
    const providerIdInput = inputs.find(
      (el) => el.tagName === "INPUT" && (el as HTMLInputElement).type === "text",
    ) as HTMLInputElement | undefined;
    expect(providerIdInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(providerIdInput!, { target: { value: "anthropic" } });
    });

    const refInputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    const refField = refInputs.find((el) => el.placeholder?.includes("deck.secrets"));
    expect(refField).toBeTruthy();
    await act(async () => {
      fireEvent.change(refField!, { target: { value: "deck.secrets.anthropic.apiKey" } });
    });

    const next2 = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Next",
    );
    expect(next2).toBeTruthy();
    await act(async () => {
      fireEvent.click(next2!);
    });

    const submit = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Create provider"),
    );
    expect(submit).toBeTruthy();
    await act(async () => {
      fireEvent.click(submit!);
    });

    await waitFor(() => expect(apiMocks.upsertModelProvider).toHaveBeenCalledTimes(1));
    const call = apiMocks.upsertModelProvider.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      expectedBaseHash: "h1",
      providerId: "anthropic",
      isCreate: true,
      apiKey: { action: "set-ref", ref: "deck.secrets.anthropic.apiKey" },
    });
  });

  it("opens advanced raw editor on demand without firing typed mutations", async () => {
    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-catalog-header"]')).toBeTruthy(),
    );
    const advancedBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Advanced raw editor"),
    );
    expect(advancedBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(advancedBtn!);
    });
    await waitFor(() =>
      expect(container.textContent).toContain("Raw editor bypasses typed validation."),
    );
    expect(apiMocks.upsertModelProvider).not.toHaveBeenCalled();
    expect(apiMocks.upsertModel).not.toHaveBeenCalled();
  });

  it("delete preview surfaces impact references then commits with confirm token", async () => {
    apiMocks.previewProviderDelete.mockResolvedValue({
      preview: {
        ...samplePreview,
        references: [
          {
            kind: "agents.defaults",
            path: "agents.defaults.model",
            providerId: "openai",
            modelId: "gpt-5.4",
          },
        ],
      },
    });
    apiMocks.deleteModelProvider.mockResolvedValue({
      ok: true,
      hash: "h2",
      providerId: "openai",
    });

    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-section-openai"]')).toBeTruthy(),
    );

    const previewBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent === "Preview delete" || btn.textContent?.startsWith("Preview delete"),
    );
    expect(previewBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(previewBtn!);
    });

    await waitFor(() => expect(apiMocks.previewProviderDelete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("agents.defaults.model"));

    const confirmInput = container.querySelector<HTMLInputElement>(
      "input[aria-label='Confirmation text']",
    );
    expect(confirmInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(confirmInput!, { target: { value: "delete" } });
    });

    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Confirm",
    );
    expect(confirmBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(confirmBtn!);
    });

    await waitFor(() => expect(apiMocks.deleteModelProvider).toHaveBeenCalledTimes(1));
    expect(apiMocks.deleteModelProvider.mock.calls[0]?.[0]).toMatchObject({
      expectedBaseHash: "h1",
      providerId: "openai",
      impactToken: "tok-1",
      confirmText: "delete",
    });
  });

  it("renders Chinese copy when locale is zh", async () => {
    await act(async () => {
      renderPanel("zh");
    });
    await waitFor(() => expect(container.textContent).toContain("新增提供方"));
    expect(container.textContent).toContain("高级原始编辑");
  });
});
