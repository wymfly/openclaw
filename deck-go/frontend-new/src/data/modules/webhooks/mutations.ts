import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWebhook, deleteWebhook, testWebhook, updateWebhook } from "@/api";
import type { DeckGoWebhook } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { webhooksKeys } from "./keys";

export type WebhookInput = {
  enabled?: boolean;
  events: string[];
  name: string;
  secret?: string;
  url: string;
};

export function isRunScopedWebhook(webhook: Pick<DeckGoWebhook, "id" | "name">, runId: string) {
  return Boolean(runId.trim()) && (webhook.id.includes(runId) || webhook.name.includes(runId));
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: WebhookInput) => createWebhook(input),
    onSuccess: async () => {
      await invalidateModule(queryClient, webhooksKeys.all());
    },
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ id, input }: { id: string; input: Partial<WebhookInput> }) =>
      updateWebhook(id, input),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, webhooksKeys.all(), [webhooksKeys.deliveries(vars.id)]);
    },
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: async (_response, id) => {
      queryClient.removeQueries({ queryKey: webhooksKeys.deliveries(id) });
      await invalidateModule(queryClient, webhooksKeys.all());
    },
  });
}

export function useTestWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (id: string) => testWebhook(id),
    onSuccess: async (_response, id) => {
      await queryClient.invalidateQueries({ queryKey: webhooksKeys.deliveries(id) });
    },
  });
}
