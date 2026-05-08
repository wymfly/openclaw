import { useMutation, useQueryClient } from "@tanstack/react-query";
import { probeRuntimeModelAuth, saveModelsConfig } from "@/api";
import { invalidateModule, mutationDefaults } from "../shared";
import { modelsKeys } from "./keys";

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
