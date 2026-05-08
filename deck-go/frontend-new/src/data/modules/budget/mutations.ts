import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBudgetRule, deleteBudgetRule, updateBudgetRule } from "@/api";
import type { DeckGoBudgetRule } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { budgetKeys } from "./keys";

export function isRunScopedBudgetRule(rule: Pick<DeckGoBudgetRule, "id" | "name">, runId: string) {
  return Boolean(runId.trim()) && (rule.id.includes(runId) || rule.name.includes(runId));
}

export function useCreateBudgetRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (rule: Omit<DeckGoBudgetRule, "createdAt" | "id" | "updatedAt">) =>
      createBudgetRule(rule),
    onSuccess: async () => {
      await invalidateModule(queryClient, budgetKeys.all());
    },
  });
}

export function useUpdateBudgetRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ id, input }: { id: string; input: Partial<DeckGoBudgetRule> }) =>
      updateBudgetRule(id, input),
    onSuccess: async () => {
      await invalidateModule(queryClient, budgetKeys.all());
    },
  });
}

export function useDeleteBudgetRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => deleteBudgetRule(id),
    onSuccess: async () => {
      await invalidateModule(queryClient, budgetKeys.all());
    },
  });
}
