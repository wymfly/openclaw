import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveApproval, resolvePluginApproval, updateApprovalsPolicy } from "@/api";
import type { DeckGoApprovalPolicy } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { approvalsKeys } from "./keys";

export async function invalidateApprovalsReadModels(queryClient: {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>;
}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: approvalsKeys.all() }),
    queryClient.invalidateQueries({ queryKey: approvalsKeys.pending() }),
    queryClient.invalidateQueries({ queryKey: approvalsKeys.plugins() }),
    queryClient.invalidateQueries({ queryKey: approvalsKeys.policy() }),
  ]);
}

export function useResolveApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      decision,
      id,
    }: {
      decision: "allow-once" | "allow-always" | "deny";
      id: string;
    }) => resolveApproval(id, decision),
    onSuccess: async () => {
      await invalidateModule(queryClient, approvalsKeys.all(), [approvalsKeys.pending()]);
    },
  });
}

export function useResolvePluginApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      decision,
      id,
    }: {
      decision: "allow-once" | "allow-always" | "deny";
      id: string;
    }) => resolvePluginApproval(id, decision),
    onSuccess: async () => {
      await invalidateModule(queryClient, approvalsKeys.all(), [approvalsKeys.plugins()]);
    },
  });
}

export function useUpdateApprovalsPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ baseHash, file }: { baseHash?: string; file: DeckGoApprovalPolicy }) =>
      updateApprovalsPolicy(file, baseHash),
    onSuccess: async () => {
      await invalidateModule(queryClient, approvalsKeys.all(), [approvalsKeys.policy()]);
    },
  });
}
