import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  deleteModel,
  deleteModelProvider,
  previewModelDelete,
  previewProviderDelete,
  probeRuntimeModelAuth,
  saveModelsConfig,
  setModelsCatalogMode,
  upsertModel,
  upsertModelProvider,
} from "@/api";
import type {
  DeckGoModelDeleteCommitRequest,
  DeckGoModelDeletePreviewRequest,
  DeckGoModelImpactPreviewResponse,
  DeckGoModelModeSetRequest,
  DeckGoModelProviderDeleteCommitRequest,
  DeckGoModelProviderDeletePreviewRequest,
  DeckGoModelProviderUpsertRequest,
  DeckGoModelUpsertRequest,
} from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { modelsKeys } from "./keys";

async function invalidateConfigSurfaces(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: modelsKeys.configDetail() }),
    queryClient.invalidateQueries({ queryKey: modelsKeys.config() }),
    queryClient.invalidateQueries({ queryKey: modelsKeys.configured() }),
  ]);
}

/**
 * Advanced raw editor only. Normal Models CRUD must use the typed mutations
 * below (provider/model upsert + delete preview/commit, mode set).
 */
export function useSaveModelsConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ baseHash, raw }: { baseHash?: string; raw: string }) =>
      saveModelsConfig(raw, baseHash),
    onSuccess: async () => {
      await invalidateModule(queryClient, modelsKeys.all());
    },
  });
}

export function useProbeModelAuthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (provider: string) => probeRuntimeModelAuth(provider),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: modelsKeys.authOverview() });
    },
  });
}

export function useUpsertModelProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (req: DeckGoModelProviderUpsertRequest) => upsertModelProvider(req),
    onSuccess: async () => {
      await invalidateConfigSurfaces(queryClient);
    },
  });
}

export function usePreviewProviderDeleteMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: (
      req: DeckGoModelProviderDeletePreviewRequest,
    ): Promise<DeckGoModelImpactPreviewResponse> => previewProviderDelete(req),
  });
}

export function useDeleteModelProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (req: DeckGoModelProviderDeleteCommitRequest) => deleteModelProvider(req),
    onSuccess: async () => {
      await invalidateConfigSurfaces(queryClient);
    },
  });
}

export function useUpsertModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (req: DeckGoModelUpsertRequest) => upsertModel(req),
    onSuccess: async () => {
      await invalidateConfigSurfaces(queryClient);
    },
  });
}

export function usePreviewModelDeleteMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: (req: DeckGoModelDeletePreviewRequest): Promise<DeckGoModelImpactPreviewResponse> =>
      previewModelDelete(req),
  });
}

export function useDeleteModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (req: DeckGoModelDeleteCommitRequest) => deleteModel(req),
    onSuccess: async () => {
      await invalidateConfigSurfaces(queryClient);
    },
  });
}

export function useSetModelsCatalogModeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (req: DeckGoModelModeSetRequest) => setModelsCatalogMode(req),
    onSuccess: async (_data, variables) => {
      if (!variables.dryRun) {
        await Promise.all([
          invalidateConfigSurfaces(queryClient),
          queryClient.invalidateQueries({ queryKey: modelsKeys.catalogProviders() }),
        ]);
      }
    },
  });
}
