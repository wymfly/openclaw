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
    apiKeyStatus: {
      state: "ref",
      ref: { source: "env", provider: "default", id: "OPENAI_API_KEY" },
      displayRef: "env:OPENAI_API_KEY",
    },
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
        isReferenced: true,
        isDefault: true,
        defaultRoles: ["textModel"],
        usageRelations: ["default", "fallback"],
        usageRoles: ["textModel", "agent.model"],
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
      defaults: {
        text: {
          provider: "openai",
          model: "gpt-5.4",
          source: "explicit",
          fallbacks: [{ provider: "anthropic", model: "claude-sonnet-4.6" }],
        },
        pdf: {
          provider: "openai",
          model: "gpt-5.4",
          source: "explicit",
        },
        compaction: {
          provider: "openai",
          model: "gpt-5.4-mini",
          source: "derived",
        },
      },
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

const sampleCatalogProviders = [
  {
    id: "openai",
    displayName: "OpenAI Catalog",
    api: "openai-responses",
    defaultBaseUrl: "https://api.openai.com/v1",
    modelCount: 2,
    models: [
      {
        id: "gpt-5.4",
        name: "GPT-5.4",
        contextWindow: 200_000,
        maxTokens: 8192,
      },
      {
        id: "gpt-5.4-mini",
        name: "GPT-5.4 Mini",
        contextWindow: 128_000,
        maxTokens: 4096,
      },
    ],
  },
  {
    id: "anthropic",
    displayName: "Claude Catalog",
    api: "anthropic-messages",
    modelCount: 2,
    models: [
      {
        id: "claude-sonnet-4.6",
        name: "Claude Sonnet 4.6",
        contextWindow: 200_000,
        maxTokens: 8192,
      },
    ],
  },
];

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
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({
      providers: sampleCatalogProviders,
    });
    apiMocks.lookupConfigPath.mockResolvedValue({ path: "models", children: [] });
    apiMocks.probeRuntimeModelAuth.mockResolvedValue({ provider: "openai", status: "ok" });
    Object.values(apiMocks).forEach((fn) => fn.mockClear?.());
    apiMocks.fetchModelsConfig.mockResolvedValue({ raw: "{}", hash: "h1" });
    apiMocks.fetchModelsConfigDetail.mockResolvedValue(detailResponse());
    apiMocks.fetchRuntimeConfiguredModels.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeModelAuthOverview.mockResolvedValue({ providers: [] });
    apiMocks.fetchRuntimeModelCatalogProviders.mockResolvedValue({
      providers: sampleCatalogProviders,
    });
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

  it("renders the catalog header and configured provider groups when detail is loaded", async () => {
    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-catalog-header"]')).toBeTruthy(),
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-list"]')).toBeTruthy(),
    );
    expect(container.textContent).toContain("openai");
    expect(container.textContent).toContain("GPT-5.4");
    expect(container.textContent).toContain("Provider library + configured assets");
    expect(container.textContent).toContain("Configured Providers");
    expect(container.textContent).toContain("Model usage policy");
    expect(container.textContent).toContain("openai/gpt-5.4");
    expect(container.textContent).toContain("Fallbacks: anthropic/claude-sonnet-4.6");
    expect(container.textContent).toContain("PDF");
    expect(container.textContent).toContain("Compaction");
    expect(container.querySelector('[data-testid="models-section-openai"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="models-provider-library"]')).toBeNull();
    expect(container.textContent).toContain("fallback");
    expect(container.textContent).toContain("roles: agent.model, textModel");
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
      btn.textContent?.includes("Start blank custom provider"),
    );
    expect(useCustom).toBeTruthy();
    await act(async () => {
      fireEvent.click(useCustom!);
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
    const refField = refInputs.find((el) => el.placeholder?.includes("OPENAI_API_KEY"));
    expect(refField).toBeTruthy();
    await act(async () => {
      fireEvent.change(refField!, { target: { value: "ANTHROPIC_API_KEY" } });
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
      apiKey: {
        action: "set-ref",
        ref: { source: "env", provider: "default", id: "ANTHROPIC_API_KEY" },
      },
    });
  });

  it("shows product choices when add-provider id already exists", async () => {
    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-catalog-header"]')).toBeTruthy(),
    );

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Add provider"),
    );
    expect(addBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(addBtn!);
    });

    const useCustom = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Start blank custom provider"),
    );
    expect(useCustom).toBeTruthy();
    await act(async () => {
      fireEvent.click(useCustom!);
    });

    const providerIdInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (el) => el.type === "text",
    );
    expect(providerIdInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(providerIdInput!, { target: { value: "openai" } });
    });

    expect(container.textContent).toContain("Provider openai already exists.");
    expect(container.textContent).toContain("Edit existing");
    const disabledNext = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Next",
    );
    expect(disabledNext?.disabled).toBe(true);
  });

  it("copies catalog templates into configurable providers with selectable default models", async () => {
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
    expect(container.querySelector('[data-testid="models-provider-library"]')).toBeNull();

    const addBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Add provider"),
    );
    expect(addBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(addBtn!);
    });

    const configureAnthropic = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("anthropic"),
    );
    expect(configureAnthropic).toBeTruthy();
    await act(async () => {
      fireEvent.click(configureAnthropic!);
    });

    await waitFor(() => expect(container.textContent).toContain("Add provider"));
    const providerIdInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (el) => el.type === "text",
    );
    expect(providerIdInput?.value).toBe("anthropic");
    expect(container.textContent).toContain("Claude Sonnet 4.6");

    const refField = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find((el) =>
      el.placeholder?.includes("OPENAI_API_KEY"),
    );
    expect(refField).toBeTruthy();
    await act(async () => {
      fireEvent.change(refField!, { target: { value: "ANTHROPIC_API_KEY" } });
    });

    const next = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Next",
    );
    expect(next).toBeTruthy();
    await act(async () => {
      fireEvent.click(next!);
    });

    const submit = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Create provider"),
    );
    expect(submit).toBeTruthy();
    await act(async () => {
      fireEvent.click(submit!);
    });

    await waitFor(() => expect(apiMocks.upsertModelProvider).toHaveBeenCalledTimes(1));
    expect(apiMocks.upsertModelProvider.mock.calls[0]?.[0]).toMatchObject({
      providerId: "anthropic",
      models: [
        {
          id: "claude-sonnet-4.6",
          name: "Claude Sonnet 4.6",
          contextWindow: 200_000,
          maxTokens: 8192,
        },
      ],
    });
  });

  it("adds custom models through the configured provider upsert path", async () => {
    apiMocks.upsertModel.mockResolvedValue({
      ok: true,
      hash: "h2",
      providerId: "openai",
      modelId: "gpt-5.4-mini",
    });
    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-section-openai"]')).toBeTruthy(),
    );

    const addModel = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Add model",
    );
    expect(addModel).toBeTruthy();
    await act(async () => {
      fireEvent.click(addModel!);
    });

    await waitFor(() => expect(container.textContent).toContain("New model under openai"));
    const modelIdInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (el) => el.type === "text",
    );
    expect(modelIdInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(modelIdInput!, { target: { value: "gpt-5.4-mini" } });
    });

    const save = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Save",
    );
    expect(save).toBeTruthy();
    await act(async () => {
      fireEvent.click(save!);
    });

    await waitFor(() => expect(apiMocks.upsertModel).toHaveBeenCalledTimes(1));
    expect(apiMocks.upsertModel.mock.calls[0]?.[0]).toMatchObject({
      expectedBaseHash: "h1",
      providerId: "openai",
      modelId: "gpt-5.4-mini",
      isCreate: true,
      inheritsApi: true,
      inputs: ["text"],
    });
  });

  it("renders replace mode as an advanced configured-only policy state", async () => {
    apiMocks.fetchModelsConfigDetail.mockResolvedValueOnce(
      detailResponse({ mode: "replace", modeSource: "config" }),
    );
    await act(async () => {
      renderPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Strict configured-only policy"));
    expect(container.textContent).toContain("Restore library visibility");
    expect(container.textContent).toContain("mode: replace");
  });

  it("does not expose the raw editor from the Models product surface", async () => {
    await act(async () => {
      renderPanel();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="models-catalog-header"]')).toBeTruthy(),
    );
    expect(container.textContent).not.toContain("Advanced raw editor");
    expect(container.querySelector("textarea[aria-label='openclaw.json models block']")).toBeNull();
    expect(apiMocks.fetchModelsConfig).not.toHaveBeenCalled();
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
            relation: "fallback",
            role: "textModel",
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

    const providerSection = container.querySelector('[data-testid="models-section-openai"]');
    const previewBtn = Array.from(providerSection?.querySelectorAll("button") ?? []).find((btn) =>
      btn.textContent?.startsWith("Check impact"),
    );
    expect(previewBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(previewBtn!);
    });

    await waitFor(() => expect(apiMocks.previewProviderDelete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("agents.defaults.model"));
    expect(container.textContent).toContain("Impact check");
    expect(container.textContent).toContain("fallback");
    expect(container.textContent).toContain("Agent model policy is owned by Agents");

    const continueBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Continue",
    );
    expect(continueBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(continueBtn!);
    });

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
    expect(container.textContent).toContain("模型用途策略");
  });
});
