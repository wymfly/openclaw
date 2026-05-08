import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logoutChannel, patchChannelConfig, testChannel } from "@/api";
import { invalidateModule, mutationDefaults } from "../shared";
import { channelsKeys } from "./keys";

export function useTestChannelMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: (channelId: string) => testChannel(channelId),
  });
}

export function useLogoutChannelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (channelId: string) => logoutChannel(channelId),
    onSuccess: async () => {
      await invalidateModule(queryClient, channelsKeys.all());
    },
  });
}

export function usePatchChannelConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ channelId, patch }: { channelId: string; patch: Record<string, unknown> }) =>
      patchChannelConfig(channelId, patch),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, channelsKeys.all(), [
        channelsKeys.throughput(vars.channelId),
      ]);
    },
  });
}
