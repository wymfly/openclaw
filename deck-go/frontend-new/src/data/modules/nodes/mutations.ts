import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveNodePairing,
  enqueueNodePendingWork,
  invokeNodeCommand,
  rejectNodePairing,
  renameNode,
  requestNodePairing,
  verifyNodePairing,
} from "@/api";
import type {
  DeckGoNodePairRequestInput,
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
} from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { nodesKeys } from "./keys";

export function useRenameNodeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ displayName, nodeId }: { displayName: string; nodeId: string }) =>
      renameNode(nodeId, displayName),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, nodesKeys.all(), [nodesKeys.detail(vars.nodeId)]);
    },
  });
}

export function useInvokeNodeCommandMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      command,
      nodeId,
      params,
      timeoutMs,
    }: {
      command: string;
      nodeId: string;
      params: unknown;
      timeoutMs?: number;
    }) => invokeNodeCommand(nodeId, command, params, timeoutMs),
  });
}

export function useEnqueueNodePendingWorkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (params: {
      nodeId: string;
      priority?: DeckGoNodePendingWorkPriority;
      type: DeckGoNodePendingWorkType;
      wake?: boolean;
    }) => enqueueNodePendingWork(params),
    onSuccess: async () => {
      await invalidateModule(queryClient, nodesKeys.all());
    },
  });
}

export function useNodePairingMutations() {
  const queryClient = useQueryClient();
  const invalidatePairing = async () => {
    await invalidateModule(queryClient, nodesKeys.all(), [nodesKeys.pairing()]);
  };
  return {
    approve: useMutation({
      ...mutationDefaults,
      mutationFn: (requestId: string) => approveNodePairing(requestId),
      onSuccess: invalidatePairing,
    }),
    reject: useMutation({
      ...mutationDefaults,
      mutationFn: (requestId: string) => rejectNodePairing(requestId),
      onSuccess: invalidatePairing,
    }),
    request: useMutation({
      ...mutationDefaults,
      mutationFn: (params: DeckGoNodePairRequestInput) => requestNodePairing(params),
      onSuccess: invalidatePairing,
    }),
    verify: useMutation({
      ...mutationDefaults,
      mutationFn: ({ nodeId, token }: { nodeId: string; token: string }) =>
        verifyNodePairing(nodeId, token),
      onSuccess: invalidatePairing,
    }),
  };
}
