import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { setSessionEventsSubscription } from "@/api";
import type { DeckGoSessionEventsRequest } from "@/api-types";
import { invalidateSessionsReadModels } from "../sessions/mutations";
import { mutationDefaults } from "../shared";
import { chatKeys } from "./keys";

export async function invalidateChatReadModels(
  queryClient: QueryClient,
  sessionKey?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.all() }),
    ...(sessionKey
      ? [
          queryClient.invalidateQueries({ queryKey: chatKeys.sessionEvents(sessionKey) }),
          invalidateSessionsReadModels(queryClient, sessionKey),
        ]
      : []),
  ]);
}

export function useSessionEventsSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (body: DeckGoSessionEventsRequest) => setSessionEventsSubscription(body),
    onSuccess: async (_response, vars) => {
      await queryClient.invalidateQueries({
        queryKey: chatKeys.sessionEvents(vars.sessionKey),
      });
    },
  });
}
