import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createAgent,
  deleteAgent,
  saveAgentFile,
  updateAgent,
  updateAgentEventStreams,
  updateAgentSkills,
  updateAgentModelPolicy,
  updateAgentSubagentConfig,
  type DeckGoAgentCreateRequest,
  type DeckGoAgentModelPolicyTarget,
  type DeckGoAgentModelSelection,
  type DeckGoAgentPatchRequest,
} from "@/api";
import { mutationDefaults, requireBaseHash } from "../shared";
import { agentsKeys } from "./keys";

type AgentDeleteTarget = {
  availableActions?: { canDelete?: boolean; deleteDisabledReason?: string };
  id: string;
  isConfiguredDefault?: boolean;
  isDefault?: boolean;
  isMainProtected?: boolean;
};

export class AgentProtectedDeleteError extends Error {
  readonly code = "agents.protectedDelete";

  constructor(agentId: string) {
    super(`${agentId} is protected and cannot be deleted`);
    this.name = "AgentProtectedDeleteError";
  }
}

export function isProtectedAgentDeleteTarget(agent: AgentDeleteTarget | null | undefined) {
  if (!agent) {
    return false;
  }
  return (
    agent.id === "main" ||
    agent.isMainProtected === true ||
    agent.isDefault === true ||
    agent.isConfiguredDefault === true ||
    agent.availableActions?.canDelete === false
  );
}

export async function invalidateAgentsReadModels(
  queryClient: QueryClient,
  agentId?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: agentsKeys.all() }),
    ...(agentId
      ? [
          queryClient.invalidateQueries({ queryKey: agentsKeys.detail(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.skills(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.subagents(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.modelPolicy(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.eventStreams(agentId) }),
        ]
      : []),
  ]);
}

export function useCreateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (params: DeckGoAgentCreateRequest) => createAgent(params),
    onSuccess: async (response) => {
      await invalidateAgentsReadModels(queryClient, response.id);
    },
  });
}

export function useUpdateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ agentId, patch }: { agentId: string; patch: DeckGoAgentPatchRequest }) =>
      updateAgent(agentId, patch),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useDeleteAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ agent }: { agent: AgentDeleteTarget }) => {
      if (isProtectedAgentDeleteTarget(agent)) {
        throw new AgentProtectedDeleteError(agent.id);
      }
      return deleteAgent(agent.id);
    },
    onSuccess: async (_response, vars) => {
      queryClient.removeQueries({ queryKey: agentsKeys.detail(vars.agent.id) });
      await invalidateAgentsReadModels(queryClient, vars.agent.id);
    },
  });
}

export function useSaveAgentSkillsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      agentId,
      baseHash,
      mode,
      skills,
    }: {
      agentId: string;
      baseHash: string | null | undefined;
      mode: "all" | "whitelist";
      skills: string[];
    }) =>
      updateAgentSkills(agentId, {
        baseHash: requireBaseHash(baseHash, "agents.skills.save"),
        mode,
        skills,
      }),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentSubagentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      agentId,
      allowAgents,
      baseHash,
      model,
    }: {
      agentId: string;
      allowAgents: string[];
      baseHash: string | null | undefined;
      model?: string;
    }) =>
      updateAgentSubagentConfig(agentId, {
        allowAgents,
        baseHash: requireBaseHash(baseHash, "agents.subagents.save"),
        model,
      }),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentModelPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      baseHash,
      clear,
      selection,
      target,
    }: {
      baseHash: string | null | undefined;
      clear?: boolean;
      selection?: DeckGoAgentModelSelection;
      target: DeckGoAgentModelPolicyTarget;
    }) =>
      updateAgentModelPolicy({
        baseHash: requireBaseHash(baseHash, "agents.modelPolicy.save"),
        clear,
        selection,
        target,
      }),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.target.agentId);
      await queryClient.invalidateQueries({ queryKey: agentsKeys.modelPolicy() });
    },
  });
}

export function useSaveAgentEventStreamsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      agentId,
      baseHash,
      eventStreams,
    }: {
      agentId: string;
      baseHash: string | null | undefined;
      eventStreams: string[];
    }) =>
      updateAgentEventStreams(
        agentId,
        eventStreams,
        requireBaseHash(baseHash, "agents.eventStreams.save"),
      ),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ agentId, content, name }: { agentId: string; content: string; name: string }) =>
      saveAgentFile(agentId, name, content),
    onSuccess: async (_response, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agentsKeys.files(vars.agentId) }),
        queryClient.invalidateQueries({ queryKey: agentsKeys.file(vars.agentId, vars.name) }),
      ]);
    },
  });
}
