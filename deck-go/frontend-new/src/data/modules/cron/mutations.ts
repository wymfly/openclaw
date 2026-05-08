import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCronJob, deleteCronJob, runCronJob, updateCronJob } from "@/api";
import type { DeckGoCronJob, DeckGoCronJobInput, DeckGoCronRunParams } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { cronKeys } from "./keys";

export function isRunScopedCronJob(
  job: Pick<DeckGoCronJob, "description" | "id" | "name">,
  runId: string,
) {
  return (
    Boolean(runId.trim()) &&
    (job.id.includes(runId) || job.name.includes(runId) || job.description?.includes(runId))
  );
}

export function useCreateCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (input: DeckGoCronJobInput) => createCronJob(input),
    onSuccess: async () => {
      await invalidateModule(queryClient, cronKeys.all(), [cronKeys.status()]);
    },
  });
}

export function useUpdateCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ input, jobId }: { input: Partial<DeckGoCronJobInput>; jobId: string }) =>
      updateCronJob(jobId, input),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, cronKeys.all(), [
        cronKeys.status(),
        cronKeys.runs(vars.jobId),
      ]);
    },
  });
}

export function useDeleteCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (jobId: string) => deleteCronJob(jobId),
    onSuccess: async (_response, jobId) => {
      queryClient.removeQueries({ queryKey: cronKeys.runs(jobId) });
      await invalidateModule(queryClient, cronKeys.all(), [cronKeys.status()]);
    },
  });
}

export function useRunCronJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ jobId, params }: { jobId: string; params?: DeckGoCronRunParams }) =>
      runCronJob(jobId, params),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, cronKeys.all(), [
        cronKeys.status(),
        cronKeys.runs(vars.jobId),
      ]);
    },
  });
}
