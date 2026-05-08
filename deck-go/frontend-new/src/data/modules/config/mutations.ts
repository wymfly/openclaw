import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyDeckConfig, patchDeckConfig } from "@/api";
import { invalidateModule, mutationDefaults } from "../shared";
import { configKeys } from "./keys";

export function useApplyDeckConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ baseHash, raw }: { baseHash?: string; raw: string }) =>
      applyDeckConfig(raw, baseHash),
    onSuccess: async () => {
      await invalidateModule(queryClient, configKeys.all());
    },
  });
}

export function usePatchDeckConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ baseHash, patch }: { baseHash?: string; patch: Record<string, unknown> }) =>
      patchDeckConfig(patch, baseHash),
    onSuccess: async () => {
      await invalidateModule(queryClient, configKeys.all());
    },
  });
}
