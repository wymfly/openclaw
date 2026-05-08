import { useMutation, useQueryClient } from "@tanstack/react-query";
import { killSubagentRun, steerSubagentRun } from "@/api";
import { invalidateModule, mutationDefaults } from "../shared";
import { subagentsKeys } from "./keys";

export function useKillSubagentRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (runId: string) => killSubagentRun(runId),
    onSuccess: async (_response, runId) => {
      await invalidateModule(queryClient, subagentsKeys.all(), [
        subagentsKeys.lineageByRunId(runId),
      ]);
    },
  });
}

export function useSteerSubagentRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ instruction, runId }: { instruction: string; runId: string }) =>
      steerSubagentRun(runId, instruction),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, subagentsKeys.all(), [
        subagentsKeys.lineageByRunId(vars.runId),
      ]);
    },
  });
}
