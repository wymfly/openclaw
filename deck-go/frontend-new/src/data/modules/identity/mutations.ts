import { useMutation, useQueryClient } from "@tanstack/react-query";
import { linkIdentityPeer, unlinkIdentityPeer } from "@/api";
import { agentsKeys } from "../agents/keys";
import { invalidateModule, mutationDefaults, requireBaseHash } from "../shared";
import { identityKeys } from "./keys";

export function useLinkIdentityPeerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      baseHash,
      canonical,
      channel,
      peerId,
    }: {
      baseHash: string | null | undefined;
      canonical: string;
      channel: string;
      peerId: string;
    }) => linkIdentityPeer(canonical, channel, peerId, requireBaseHash(baseHash, "identity.link")),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, identityKeys.all(), [
        identityKeys.links(),
        agentsKeys.identity(vars.canonical),
      ]);
    },
  });
}

export function useUnlinkIdentityPeerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      baseHash,
      canonical,
      channel,
      peerId,
    }: {
      baseHash: string | null | undefined;
      canonical: string;
      channel: string;
      peerId: string;
    }) =>
      unlinkIdentityPeer(canonical, channel, peerId, requireBaseHash(baseHash, "identity.unlink")),
    onSuccess: async (_response, vars) => {
      await invalidateModule(queryClient, identityKeys.all(), [
        identityKeys.links(),
        agentsKeys.identity(vars.canonical),
      ]);
    },
  });
}
