import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createAgent,
  deleteAgent,
  saveAgentFile,
  updateAgentCognition,
  updateAgentConversation,
  updateAgentDefaults,
  updateAgentDelivery,
  updateAgent,
  updateAgentEventStreams,
  updateAgentSkills,
  updateAgentModelPolicy,
  updateAgentToolsOverride,
  updateAgentSubagentConfig,
  updateAgentWorkspaceAdvanced,
  type DeckGoAgentCognitionSetRequest,
  type DeckGoAgentConversationSetRequest,
  type DeckGoAgentDefaultsBucket,
  type DeckGoAgentDefaultsSetRequest,
  type DeckGoAgentDeliverySetRequest,
  type DeckGoAgentCreateRequest,
  type DeckGoAgentModelPolicyTarget,
  type DeckGoAgentModelSelection,
  type DeckGoAgentPatchRequest,
  type DeckGoAgentToolsOverrideSetRequest,
  type DeckGoAgentWorkspaceSetRequest,
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
          queryClient.invalidateQueries({ queryKey: agentsKeys.cognition(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.workspaceAdvanced(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.conversation(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.delivery(agentId) }),
          queryClient.invalidateQueries({ queryKey: agentsKeys.toolsOverride(agentId) }),
        ]
      : []),
  ]);
}

type ProductSetValues = Record<string, unknown>;
type AgentProductMutationVars = {
  agentId: string;
  baseHash: string | null | undefined;
  reset?: string[];
  values?: ProductSetValues;
};

function productParams<T extends { baseHash: string }>(
  action: string,
  vars: AgentProductMutationVars,
) {
  return {
    ...vars.values,
    ...(vars.reset ? { reset: vars.reset } : {}),
    baseHash: requireBaseHash(vars.baseHash, action),
  } as T;
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
    mutationFn: ({
      agent,
      confirmAgentId,
    }: {
      agent: AgentDeleteTarget;
      confirmAgentId?: string;
    }) => {
      if (isProtectedAgentDeleteTarget(agent)) {
        throw new AgentProtectedDeleteError(agent.id);
      }
      return deleteAgent(agent.id, confirmAgentId);
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
      requireAgentId,
    }: {
      agentId: string;
      allowAgents: string[];
      baseHash: string | null | undefined;
      model?: string;
      requireAgentId?: boolean;
    }) =>
      updateAgentSubagentConfig(agentId, {
        allowAgents,
        baseHash: requireBaseHash(baseHash, "agents.subagents.save"),
        model,
        requireAgentId,
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

export function useSaveAgentsCognitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: AgentProductMutationVars) =>
      updateAgentCognition(
        vars.agentId,
        productParams<Omit<DeckGoAgentCognitionSetRequest, "agentId">>(
          "agents.cognition.set",
          vars,
        ),
      ),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentsWorkspaceAdvancedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: AgentProductMutationVars) =>
      updateAgentWorkspaceAdvanced(
        vars.agentId,
        productParams<Omit<DeckGoAgentWorkspaceSetRequest, "agentId">>(
          "agents.workspace.set",
          vars,
        ),
      ),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentsConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: AgentProductMutationVars) =>
      updateAgentConversation(
        vars.agentId,
        productParams<Omit<DeckGoAgentConversationSetRequest, "agentId">>(
          "agents.conversation.set",
          vars,
        ),
      ),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentsDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: AgentProductMutationVars) =>
      updateAgentDelivery(
        vars.agentId,
        productParams<Omit<DeckGoAgentDeliverySetRequest, "agentId">>("agents.delivery.set", vars),
      ),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentsToolsOverrideMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (vars: AgentProductMutationVars) =>
      updateAgentToolsOverride(
        vars.agentId,
        productParams<Omit<DeckGoAgentToolsOverrideSetRequest, "agentId">>(
          "agents.toolsOverride.set",
          vars,
        ),
      ),
    onSuccess: async (_response, vars) => {
      await invalidateAgentsReadModels(queryClient, vars.agentId);
    },
  });
}

export function useSaveAgentsDefaultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      baseHash,
      bucket,
      reset,
      value,
    }: {
      baseHash: string | null | undefined;
      bucket: DeckGoAgentDefaultsBucket;
      reset?: string[];
      value?: Record<string, unknown>;
    }) =>
      updateAgentDefaults({
        bucket,
        value: value ?? {},
        ...(reset ? { reset } : {}),
        baseHash: requireBaseHash(baseHash, `agents.defaults.${bucket}.set`),
      } as DeckGoAgentDefaultsSetRequest),
    onSuccess: async (_response, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agentsKeys.defaults(vars.bucket) }),
        queryClient.invalidateQueries({ queryKey: agentsKeys.all() }),
      ]);
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
