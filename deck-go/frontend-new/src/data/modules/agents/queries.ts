import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAgentDetail,
  fetchAgentCognition,
  fetchAgentConversation,
  fetchAgentDefaults,
  fetchAgentDelivery,
  fetchAgentEventStreams,
  fetchAgentFile,
  fetchAgentFiles,
  fetchAgentHealthSnapshot,
  fetchAgentIdentity,
  fetchAgentImpactPreview,
  fetchAgentModelPolicy,
  fetchAgentsList,
  fetchAgentSkills,
  fetchAgentSubagentConfig,
  fetchAgentSystemPromptPreview,
  fetchAgentToolPolicyPreview,
  fetchAgentToolsOverride,
  fetchAgentWorkspaceAdvanced,
  fetchRuntimeConfiguredModels,
} from "@/api";
import type {
  DeckGoAgentDefaultsBucket,
  DeckGoAgentDetailResponse,
  DeckGoAgentEventStreamsResponse,
  DeckGoAgentFileResponse,
  DeckGoAgentFilesResponse,
  DeckGoAgentHealthSnapshot,
  DeckGoAgentIdentityResponse,
  DeckGoAgentModelPolicyResponse,
  DeckGoAgentImpactPreviewRequest,
  DeckGoAgentImpactPreviewResponse,
  DeckGoAgentProductActionResponse,
  DeckGoAgentSkillsResponse,
  DeckGoAgentsListResponse,
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSystemPromptPreviewResponse,
  DeckGoAgentToolPolicyPreviewResponse,
  DeckGoRuntimeConfiguredModelsResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  type DataFabricBffTransport,
  type DataFabricGatewayRpcTransport,
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  gatewayRpcQueryOptions,
  gatewayRpcSource,
  type ModuleQueryOptions,
} from "../shared";
import { agentsKeys } from "./keys";

export const agentsListSource = gatewayRpcSource("agents.list", () => fetchAgentsList());

export const agentsConfiguredModelsSource = gatewayRpcSource("models.configured", () =>
  fetchRuntimeConfiguredModels(),
);

export const agentsHealthSource = bffSource<DeckGoAgentHealthSnapshot>("POST /deck/agents", () =>
  fetchAgentHealthSnapshot(),
);

export function agentDetailSource(agentId: string) {
  return bffSource<DeckGoAgentDetailResponse>("GET /deck/agents?agentId=...", () =>
    fetchAgentDetail(agentId),
  );
}

export function agentSkillsSource(agentId: string) {
  return bffSource<DeckGoAgentSkillsResponse>("POST /deck/agents", () => fetchAgentSkills(agentId));
}

export function agentSubagentsSource(agentId: string) {
  return bffSource<DeckGoAgentSubagentConfigResponse>("POST /deck/agents", () =>
    fetchAgentSubagentConfig(agentId),
  );
}

export function agentModelPolicySource(agentId?: string) {
  return bffSource<DeckGoAgentModelPolicyResponse>("POST /deck/agents", () =>
    fetchAgentModelPolicy(agentId),
  );
}

export function agentCognitionSource(agentId: string) {
  return bffSource<DeckGoAgentProductActionResponse>("POST /deck/agents", () =>
    fetchAgentCognition(agentId),
  );
}

export function agentWorkspaceAdvancedSource(agentId: string) {
  return bffSource<DeckGoAgentProductActionResponse>("POST /deck/agents", () =>
    fetchAgentWorkspaceAdvanced(agentId),
  );
}

export function agentConversationSource(agentId: string) {
  return bffSource<DeckGoAgentProductActionResponse>("POST /deck/agents", () =>
    fetchAgentConversation(agentId),
  );
}

export function agentDeliverySource(agentId: string) {
  return bffSource<DeckGoAgentProductActionResponse>("POST /deck/agents", () =>
    fetchAgentDelivery(agentId),
  );
}

export function agentToolsOverrideSource(agentId: string) {
  return bffSource<DeckGoAgentProductActionResponse>("POST /deck/agents", () =>
    fetchAgentToolsOverride(agentId),
  );
}

export function agentDefaultsSource(bucket: DeckGoAgentDefaultsBucket) {
  return bffSource<DeckGoAgentProductActionResponse>("POST /deck/agents/defaults", () =>
    fetchAgentDefaults(bucket),
  );
}

export function agentImpactPreviewSource(params: DeckGoAgentImpactPreviewRequest) {
  return bffSource<DeckGoAgentImpactPreviewResponse>("POST /deck/agents", () =>
    fetchAgentImpactPreview(params),
  );
}

export function agentEventStreamsSource(agentId: string) {
  return bffSource<DeckGoAgentEventStreamsResponse>("POST /deck/agents", () =>
    fetchAgentEventStreams(agentId),
  );
}

export function agentToolPolicySource(agentId: string) {
  return bffSource<DeckGoAgentToolPolicyPreviewResponse>("POST /deck/agents", () =>
    fetchAgentToolPolicyPreview(agentId),
  );
}

export function agentSystemPromptSource(agentId: string) {
  return bffSource<DeckGoAgentSystemPromptPreviewResponse>("POST /deck/agents", () =>
    fetchAgentSystemPromptPreview(agentId),
  );
}

export function agentFilesSource(agentId: string) {
  return bffSource<DeckGoAgentFilesResponse>("GET /agents/{agentId}/files", () =>
    fetchAgentFiles(agentId),
  );
}

export function agentFileSource(agentId: string, name: string) {
  return bffSource<DeckGoAgentFileResponse>("GET /agents/{agentId}/files/{name}", () =>
    fetchAgentFile(agentId, name),
  );
}

export function agentIdentitySource(agentId: string) {
  return bffSource<DeckGoAgentIdentityResponse>("GET /agents/{agentId}/identity", () =>
    fetchAgentIdentity(agentId),
  );
}

export function agentsListQueryOptions(
  gatewayRpc: DataFabricGatewayRpcTransport,
  scope?: DeckQueryScope,
) {
  return gatewayRpcQueryOptions<DeckGoAgentsListResponse>(
    gatewayRpc,
    agentsListSource,
    agentsKeys.list(scope),
    "inventory",
  );
}

export function agentsConfiguredModelsQueryOptions(
  gatewayRpc: DataFabricGatewayRpcTransport,
  scope?: DeckQueryScope,
) {
  return gatewayRpcQueryOptions<DeckGoRuntimeConfiguredModelsResponse>(
    gatewayRpc,
    agentsConfiguredModelsSource,
    agentsKeys.configuredModels(scope),
    "inventory",
  );
}

export function agentHealthQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions(bff, agentsHealthSource, agentsKeys.health(scope), "live-workbench");
}

export function agentDetailQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentDetailSource(agentId),
    agentsKeys.detail(agentId, scope),
    "lazy-detail",
  );
}

export function agentSkillsQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentSkillsSource(agentId),
    agentsKeys.skills(agentId, scope),
    "config-authority",
  );
}

export function agentSubagentsQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentSubagentsSource(agentId),
    agentsKeys.subagents(agentId, scope),
    "config-authority",
  );
}

export function agentModelPolicyQueryOptions(
  bff: DataFabricBffTransport,
  agentId?: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentModelPolicySource(agentId),
    agentsKeys.modelPolicy(agentId, scope),
    "config-authority",
  );
}

export function agentProductBucketQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  bucket: "cognition" | "workspaceAdvanced" | "conversation" | "delivery" | "toolsOverride",
  scope?: DeckQueryScope,
) {
  const sourceByBucket = {
    cognition: agentCognitionSource,
    workspaceAdvanced: agentWorkspaceAdvancedSource,
    conversation: agentConversationSource,
    delivery: agentDeliverySource,
    toolsOverride: agentToolsOverrideSource,
  };
  const keyByBucket = {
    cognition: agentsKeys.cognition,
    workspaceAdvanced: agentsKeys.workspaceAdvanced,
    conversation: agentsKeys.conversation,
    delivery: agentsKeys.delivery,
    toolsOverride: agentsKeys.toolsOverride,
  };
  return bffQueryOptions(
    bff,
    sourceByBucket[bucket](agentId),
    keyByBucket[bucket](agentId, scope),
    "config-authority",
  );
}

export function agentDefaultsQueryOptions(
  bff: DataFabricBffTransport,
  bucket: DeckGoAgentDefaultsBucket,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentDefaultsSource(bucket),
    agentsKeys.defaults(bucket, scope),
    "config-authority",
  );
}

export function agentImpactPreviewQueryOptions(
  bff: DataFabricBffTransport,
  params: DeckGoAgentImpactPreviewRequest,
  scope?: DeckQueryScope,
) {
  return {
    ...bffQueryOptions(
      bff,
      agentImpactPreviewSource(params),
      agentsKeys.impactPreview(params.agentId, params.operation, scope),
      "live-workbench",
    ),
    gcTime: 0,
    refetchOnMount: "always" as const,
    staleTime: 0,
  };
}

export function agentEventStreamsQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentEventStreamsSource(agentId),
    agentsKeys.eventStreams(agentId, scope),
    "config-authority",
  );
}

export function agentToolPolicyQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentToolPolicySource(agentId),
    agentsKeys.toolPolicy(agentId, scope),
    "lazy-detail",
  );
}

export function agentSystemPromptQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentSystemPromptSource(agentId),
    agentsKeys.systemPrompt(agentId, scope),
    "lazy-detail",
  );
}

export function agentFilesQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentFilesSource(agentId),
    agentsKeys.files(agentId, scope),
    "lazy-detail",
  );
}

export function agentFileQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  name: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentFileSource(agentId, name),
    agentsKeys.file(agentId, name, scope),
    "lazy-detail",
  );
}

export function agentIdentityQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    agentIdentitySource(agentId),
    agentsKeys.identity(agentId, scope),
    "lazy-detail",
  );
}

export function useAgentsListQuery(options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentsListQueryOptions(transports.gatewayRpc, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useAgentsConfiguredModelsQuery(options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentsConfiguredModelsQueryOptions(transports.gatewayRpc, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useAgentHealthQuery(options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentHealthQueryOptions(transports.bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useAgentDetailQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentDetailQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentSkillsQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentSkillsQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentSubagentsQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentSubagentsQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentModelPolicyQuery(agentId?: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentModelPolicyQueryOptions(transports.bff, agentId, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useAgentsCognition(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentProductBucketQueryOptions(transports.bff, agentId, "cognition", options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentsWorkspaceAdvanced(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentProductBucketQueryOptions(transports.bff, agentId, "workspaceAdvanced", options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentsConversation(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentProductBucketQueryOptions(transports.bff, agentId, "conversation", options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentsDelivery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentProductBucketQueryOptions(transports.bff, agentId, "delivery", options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentsToolsOverride(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentProductBucketQueryOptions(transports.bff, agentId, "toolsOverride", options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentsDefaults(
  bucket: DeckGoAgentDefaultsBucket,
  options: ModuleQueryOptions = {},
) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentDefaultsQueryOptions(transports.bff, bucket, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useAgentsImpactPreview(
  params: DeckGoAgentImpactPreviewRequest,
  options: ModuleQueryOptions = {},
) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentImpactPreviewQueryOptions(transports.bff, params, options.scope),
    enabled: enabledNonEmpty(params.agentId, options.enabled ?? true),
  });
}

export function useAgentSubagentsQueries(
  agentIds: readonly string[],
  options: ModuleQueryOptions = {},
) {
  const transports = useDataFabricTransports();
  const enabled = options.enabled ?? true;
  return useQueries({
    queries: agentIds.map((agentId) => ({
      ...agentSubagentsQueryOptions(transports.bff, agentId, options.scope),
      enabled: enabledNonEmpty(agentId, enabled),
    })),
  });
}

export function useAgentSubagentsFetcher() {
  const queryClient = useQueryClient();
  const transports = useDataFabricTransports();
  return (agentId: string, options: ModuleQueryOptions = {}) =>
    queryClient.fetchQuery(agentSubagentsQueryOptions(transports.bff, agentId, options.scope));
}

export function useAgentEventStreamsQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentEventStreamsQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentToolPolicyQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentToolPolicyQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentSystemPromptQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentSystemPromptQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentFilesQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentFilesQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useAgentFileQuery(agentId: string, name: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentFileQueryOptions(transports.bff, agentId, name, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true) && Boolean(name.trim()),
  });
}

export function useAgentIdentityQuery(agentId: string, options: ModuleQueryOptions = {}) {
  const transports = useDataFabricTransports();
  return useQuery({
    ...agentIdentityQueryOptions(transports.bff, agentId, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}
