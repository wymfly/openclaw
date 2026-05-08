import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  branchCompactionCheckpoint,
  clearSession,
  compactChatSession,
  deleteSession,
  patchSession,
  resetSession,
  restoreCompactionCheckpoint,
} from "@/api";
import type * as DeckApi from "../../../../../contracts/generated/ts/deck-api.generated";
import { invalidateModule, mutationDefaults } from "../shared";
import { sessionsKeys } from "./keys";

export async function invalidateSessionsReadModels(
  queryClient: QueryClient,
  sessionKey?: string | null,
) {
  const extraKeys = sessionKey
    ? [
        sessionsKeys.detail(sessionKey),
        sessionsKeys.history(sessionKey),
        sessionsKeys.usage(sessionKey),
        sessionsKeys.usageLogs(sessionKey),
        sessionsKeys.lineage(sessionKey),
        sessionsKeys.compactionCheckpoints(sessionKey),
      ]
    : [];
  await invalidateModule(queryClient, sessionsKeys.all(), extraKeys);
}

export function useResetSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: DeckApi.DeckGoChatSessionResetRequest) => resetSession(body),
    onSuccess: async (_response, vars) => {
      await invalidateSessionsReadModels(queryClient, vars.sessionKey);
    },
  });
}

export function useClearSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: DeckApi.DeckGoChatSessionClearRequest) => clearSession(body),
    onSuccess: async (_response, vars) => {
      await invalidateSessionsReadModels(queryClient, vars.sessionKey);
    },
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: DeckApi.DeckGoChatSessionDeleteRequest) => deleteSession(body),
    onSuccess: async (_response, vars) => {
      queryClient.removeQueries({ queryKey: sessionsKeys.detail(vars.sessionKey) });
      await invalidateSessionsReadModels(queryClient, vars.sessionKey);
    },
  });
}

export function usePatchSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: DeckApi.DeckGoChatSessionPatchRequest) => patchSession(body),
    onSuccess: async (_response, vars) => {
      await invalidateSessionsReadModels(queryClient, vars.sessionKey);
    },
  });
}

export function useCompactSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (sessionKey: string) => compactChatSession(sessionKey),
    onSuccess: async (_response, sessionKey) => {
      await invalidateSessionsReadModels(queryClient, sessionKey);
    },
  });
}

export function useBranchCompactionCheckpointMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ checkpointId, sessionKey }: { checkpointId: string; sessionKey: string }) =>
      branchCompactionCheckpoint(sessionKey, checkpointId),
    onSuccess: async (_response, vars) => {
      await invalidateSessionsReadModels(queryClient, vars.sessionKey);
    },
  });
}

export function useRestoreCompactionCheckpointMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ checkpointId, sessionKey }: { checkpointId: string; sessionKey: string }) =>
      restoreCompactionCheckpoint(sessionKey, checkpointId),
    onSuccess: async (_response, vars) => {
      await invalidateSessionsReadModels(queryClient, vars.sessionKey);
    },
  });
}
