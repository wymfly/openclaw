// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DeckGoModelDeleteCommitRequest,
  DeckGoModelDeletePreviewRequest,
  DeckGoModelImpactPreviewResponse,
  DeckGoModelModeSetCommitResponse,
  DeckGoModelModeSetDryRunResponse,
  DeckGoModelProviderDeleteCommitRequest,
  DeckGoModelProviderDeleteCommitResponse,
  DeckGoModelProviderDeletePreviewRequest,
  DeckGoModelProviderUpsertRequest,
  DeckGoModelProviderUpsertResponse,
  DeckGoModelUpsertRequest,
  DeckGoModelUpsertResponse,
  DeckGoModelDeleteCommitResponse,
} from "@/api-types";
import { DataFabricProvider } from "../../client/scoped-query-provider";
import { modelsKeys } from "./keys";
import {
  useDeleteModelMutation,
  useDeleteModelProviderMutation,
  usePreviewModelDeleteMutation,
  usePreviewProviderDeleteMutation,
  useSaveModelsConfigMutation,
  useSetModelsCatalogModeMutation,
  useUpsertModelMutation,
  useUpsertModelProviderMutation,
} from "./mutations";

const apiMocks = vi.hoisted(() => ({
  deleteModel: vi.fn(),
  deleteModelProvider: vi.fn(),
  previewModelDelete: vi.fn(),
  previewProviderDelete: vi.fn(),
  probeRuntimeModelAuth: vi.fn(),
  saveModelsConfig: vi.fn(),
  setModelsCatalogMode: vi.fn(),
  upsertModel: vi.fn(),
  upsertModelProvider: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

type MutationHandles = {
  upsertProvider: ReturnType<typeof useUpsertModelProviderMutation>;
  previewProviderDelete: ReturnType<typeof usePreviewProviderDeleteMutation>;
  deleteProvider: ReturnType<typeof useDeleteModelProviderMutation>;
  upsertModel: ReturnType<typeof useUpsertModelMutation>;
  previewModelDelete: ReturnType<typeof usePreviewModelDeleteMutation>;
  deleteModel: ReturnType<typeof useDeleteModelMutation>;
  setMode: ReturnType<typeof useSetModelsCatalogModeMutation>;
  saveRaw: ReturnType<typeof useSaveModelsConfigMutation>;
};

let container: HTMLDivElement;
let root: Root | null = null;
let queryClient: QueryClient;
let handles: MutationHandles | null = null;

function MutationProbe({ onReady }: { onReady: (h: MutationHandles) => void }) {
  const upsertProvider = useUpsertModelProviderMutation();
  const previewProviderDelete = usePreviewProviderDeleteMutation();
  const deleteProvider = useDeleteModelProviderMutation();
  const upsertModel = useUpsertModelMutation();
  const previewModelDelete = usePreviewModelDeleteMutation();
  const deleteModel = useDeleteModelMutation();
  const setMode = useSetModelsCatalogModeMutation();
  const saveRaw = useSaveModelsConfigMutation();

  useEffect(() => {
    onReady({
      upsertProvider,
      previewProviderDelete,
      deleteProvider,
      upsertModel,
      previewModelDelete,
      deleteModel,
      setMode,
      saveRaw,
    });
  }, [
    upsertProvider,
    previewProviderDelete,
    deleteProvider,
    upsertModel,
    previewModelDelete,
    deleteModel,
    setMode,
    saveRaw,
    onReady,
  ]);

  return null;
}

async function renderProbe() {
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricProvider,
        { queryClient },
        createElement(MutationProbe, {
          onReady(next) {
            handles = next;
          },
        }),
      ),
    );
  });
  if (!handles) {
    throw new Error("mutation handles did not initialize");
  }
  return handles;
}

describe("models data fabric module", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    handles = null;
    vi.clearAllMocks();
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

  it("provides stable distinct query keys for models config surfaces", () => {
    const config = modelsKeys.config();
    const configDetail = modelsKeys.configDetail();
    const configured = modelsKeys.configured();
    const catalogProviders = modelsKeys.catalogProviders();

    expect(config[0]).toBe("deck-go");
    expect(config).toContain("models");
    expect(config).toContain("config");
    expect(configDetail).toContain("config");
    expect(configDetail).toContain("detail");
    expect(configured).toContain("runtime");
    expect(configured).toContain("configured");
    expect(catalogProviders).toContain("catalog-providers");

    const stringify = (key: readonly unknown[]) => JSON.stringify(key);
    expect(stringify(configDetail)).not.toBe(stringify(config));
    expect(stringify(configured)).not.toBe(stringify(config));
    expect(stringify(catalogProviders)).not.toBe(stringify(configured));
  });

  it("upsertModelProvider routes through typed BFF helper and refreshes config surfaces", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const response: DeckGoModelProviderUpsertResponse = {
      ok: true,
      hash: "h2",
      providerId: "openai",
    };
    apiMocks.upsertModelProvider.mockResolvedValue(response);

    const req: DeckGoModelProviderUpsertRequest = {
      expectedBaseHash: "h1",
      providerId: "openai",
      isCreate: false,
      api: "openai-responses",
    };

    await mutations.upsertProvider.mutateAsync(req);

    expect(apiMocks.upsertModelProvider).toHaveBeenCalledTimes(1);
    expect(apiMocks.upsertModelProvider).toHaveBeenCalledWith(req);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configDetail() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.config() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configured() });
  });

  it("previewProviderDelete returns the impact preview without invalidating cache", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const preview: DeckGoModelImpactPreviewResponse = {
      preview: {
        scope: "provider.delete",
        severity: "warn",
        references: [],
        impactToken: "tok-1",
        generatedAt: 1_700_000_000_000,
        baseHash: "h1",
      },
    };
    apiMocks.previewProviderDelete.mockResolvedValue(preview);

    const req: DeckGoModelProviderDeletePreviewRequest = {
      expectedBaseHash: "h1",
      providerId: "openai",
    };
    const result = await mutations.previewProviderDelete.mutateAsync(req);

    expect(result).toBe(preview);
    expect(apiMocks.previewProviderDelete).toHaveBeenCalledWith(req);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("deleteModelProvider commits with confirm token and refreshes config surfaces", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const response: DeckGoModelProviderDeleteCommitResponse = {
      ok: true,
      hash: "h3",
      providerId: "openai",
    };
    apiMocks.deleteModelProvider.mockResolvedValue(response);

    const req: DeckGoModelProviderDeleteCommitRequest = {
      expectedBaseHash: "h1",
      providerId: "openai",
      impactToken: "tok-1",
      confirmText: "delete",
    };
    await mutations.deleteProvider.mutateAsync(req);

    expect(apiMocks.deleteModelProvider).toHaveBeenCalledWith(req);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configDetail() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.config() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configured() });
  });

  it("upsertModel routes through typed BFF helper", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const response: DeckGoModelUpsertResponse = {
      ok: true,
      hash: "h2",
      providerId: "openai",
      modelId: "gpt-5.4",
    };
    apiMocks.upsertModel.mockResolvedValue(response);

    const req: DeckGoModelUpsertRequest = {
      expectedBaseHash: "h1",
      providerId: "openai",
      modelId: "gpt-5.4",
      isCreate: false,
      name: "GPT-5.4",
    };
    await mutations.upsertModel.mutateAsync(req);

    expect(apiMocks.upsertModel).toHaveBeenCalledWith(req);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configDetail() });
  });

  it("deleteModel commits and refreshes config surfaces", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const response: DeckGoModelDeleteCommitResponse = {
      ok: true,
      hash: "h3",
      providerId: "openai",
      modelId: "gpt-5.4",
    };
    apiMocks.deleteModel.mockResolvedValue(response);

    const req: DeckGoModelDeleteCommitRequest = {
      expectedBaseHash: "h1",
      providerId: "openai",
      modelId: "gpt-5.4",
      impactToken: "tok-2",
      confirmText: "delete",
    };
    await mutations.deleteModel.mutateAsync(req);

    expect(apiMocks.deleteModel).toHaveBeenCalledWith(req);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configDetail() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configured() });
  });

  it("previewModelDelete returns preview without invalidating cache", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    apiMocks.previewModelDelete.mockResolvedValue({
      preview: {
        scope: "model.delete",
        severity: "info",
        references: [],
        impactToken: "tok-3",
        generatedAt: 1_700_000_000_000,
        baseHash: "h1",
      },
    } as DeckGoModelImpactPreviewResponse);

    const req: DeckGoModelDeletePreviewRequest = {
      expectedBaseHash: "h1",
      providerId: "openai",
      modelId: "gpt-4o",
    };
    await mutations.previewModelDelete.mutateAsync(req);

    expect(apiMocks.previewModelDelete).toHaveBeenCalledWith(req);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("setModelsCatalogMode dryRun does NOT invalidate caches", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const dryRunResponse: DeckGoModelModeSetDryRunResponse = {
      ok: true,
      baseHash: "h1",
      preview: {
        scope: "mode.set",
        severity: "warn",
        references: [],
        impactToken: "mode-tok",
        generatedAt: 1_700_000_000_000,
        baseHash: "h1",
      },
    };
    apiMocks.setModelsCatalogMode.mockResolvedValue(dryRunResponse);

    await mutations.setMode.mutateAsync({
      expectedBaseHash: "h1",
      mode: "replace",
      dryRun: true,
    });

    expect(apiMocks.setModelsCatalogMode).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("setModelsCatalogMode commit invalidates config surfaces and catalog providers", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const commitResponse: DeckGoModelModeSetCommitResponse = {
      ok: true,
      hash: "h4",
      mode: "replace",
    };
    apiMocks.setModelsCatalogMode.mockResolvedValue(commitResponse);

    await mutations.setMode.mutateAsync({
      expectedBaseHash: "h1",
      mode: "replace",
      dryRun: false,
      impactToken: "mode-tok",
      confirmText: "replace",
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configDetail() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.config() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.configured() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.catalogProviders() });
  });

  it("saveModelsConfig raw escape hatch still routes through saveModelsConfig (advanced editor only)", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    apiMocks.saveModelsConfig.mockResolvedValue({ ok: true, hash: "h2" });

    await mutations.saveRaw.mutateAsync({ baseHash: "h1", raw: '{"models":{"providers":{}}}' });

    expect(apiMocks.saveModelsConfig).toHaveBeenCalledWith('{"models":{"providers":{}}}', "h1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: modelsKeys.all() });
    expect(apiMocks.upsertModelProvider).not.toHaveBeenCalled();
    expect(apiMocks.upsertModel).not.toHaveBeenCalled();
  });

  it("propagates conflict errors from typed mutations to caller without invalidating cache", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    apiMocks.upsertModelProvider.mockRejectedValue(
      Object.assign(new Error("base hash conflict"), { code: "deck.config.baseHash.conflict" }),
    );

    await expect(
      mutations.upsertProvider.mutateAsync({
        expectedBaseHash: "stale",
        providerId: "openai",
        isCreate: false,
        api: "openai-responses",
      }),
    ).rejects.toThrow(/conflict/i);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
