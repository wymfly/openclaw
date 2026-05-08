import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addRoutingBinding,
  patchRoutingDmScope,
  removeRoutingBinding,
  simulateRouting,
  validateRoutingBinding,
} from "@/api";
import type { DeckGoRoutingMatch, DeckGoRoutingPeer } from "@/api-types";
import { invalidateModule, mutationDefaults, requireBaseHash } from "../shared";
import { routingKeys } from "./keys";

export function useValidateRoutingBindingMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: (params: { agentId: string; match: DeckGoRoutingMatch }) =>
      validateRoutingBinding(params),
  });
}

export function useSimulateRoutingMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: (params: {
      accountId?: string;
      channel: string;
      guildId?: string;
      memberRoleIds?: string[];
      peer?: DeckGoRoutingPeer;
      teamId?: string;
    }) => simulateRouting(params),
  });
}

export function useAddRoutingBindingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (params: {
      agentId: string;
      baseHash: string | null | undefined;
      comment?: string;
      match: DeckGoRoutingMatch;
      position?: number;
    }) =>
      addRoutingBinding({
        ...params,
        baseHash: requireBaseHash(params.baseHash, "routing.add"),
      }),
    onSuccess: async () => {
      await invalidateModule(queryClient, routingKeys.all());
    },
  });
}

export function useRemoveRoutingBindingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ baseHash, id }: { baseHash: string | null | undefined; id: string }) =>
      removeRoutingBinding({ baseHash: requireBaseHash(baseHash, "routing.remove"), id }),
    onSuccess: async () => {
      await invalidateModule(queryClient, routingKeys.all());
    },
  });
}

export function usePatchRoutingDmScopeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ baseHash, scope }: { baseHash: string | null | undefined; scope: string }) =>
      patchRoutingDmScope(scope, requireBaseHash(baseHash, "routing.dm-scope.patch")),
    onSuccess: async () => {
      await invalidateModule(queryClient, routingKeys.all());
    },
  });
}
