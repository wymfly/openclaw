import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runMemoryDreams } from "@/api";
import type { DeckGoMemoryDreamAction } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { memoryKeys } from "./keys";

export function useRunMemoryDreamsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ action, agentId }: { action: DeckGoMemoryDreamAction; agentId?: string }) =>
      runMemoryDreams(action, agentId),
    onSuccess: async () => {
      await invalidateModule(queryClient, memoryKeys.all());
    },
  });
}
