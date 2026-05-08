import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAlertRule, deleteAlertRule, updateAlertRule } from "@/api";
import type { DeckGoAlertRule } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { alertsKeys } from "./keys";

export function isRunScopedAlertRule(rule: Pick<DeckGoAlertRule, "id" | "name">, runId: string) {
  return Boolean(runId.trim()) && (rule.id.includes(runId) || rule.name.includes(runId));
}

export function useCreateAlertRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (rule: Omit<DeckGoAlertRule, "createdAt" | "id" | "lastFiredAt" | "updatedAt">) =>
      createAlertRule(rule),
    onSuccess: async () => {
      await invalidateModule(queryClient, alertsKeys.all());
    },
  });
}

export function useUpdateAlertRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ id, patch }: { id: string; patch: Partial<DeckGoAlertRule> }) =>
      updateAlertRule(id, patch),
    onSuccess: async () => {
      await invalidateModule(queryClient, alertsKeys.all());
    },
  });
}

export function useDeleteAlertRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => deleteAlertRule(id),
    onSuccess: async () => {
      await invalidateModule(queryClient, alertsKeys.all());
    },
  });
}
