import type * as DeckApi from "../../contracts/generated/ts/deck-api.generated";
import type {
  DeckGoActivityEvent,
  DeckGoActivityResponse,
  DeckGoAgentDetailResponse,
  DeckGoAgentEventStreamsResponse,
  DeckGoAgentEventStreamsSetResponse,
  DeckGoAgentFile,
  DeckGoAgentFileResponse,
  DeckGoAgentFilesResponse,
  DeckGoAgentHealthSnapshot,
  DeckGoAgentIdentityResponse,
  DeckGoAgentMutationResponse,
  DeckGoAgentRawConfig,
  DeckGoAgentSkillEntry,
  DeckGoAgentSkillsResponse,
  DeckGoAgentSkillsSetResponse,
  DeckGoAgentsListResponse,
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSubagentConfigSetResponse,
  DeckGoAgentSummary,
  DeckGoAgentSystemPromptPreviewResponse,
  DeckGoAgentToolPolicyPreviewResponse,
  DeckGoAlertAction,
  DeckGoAlertRule,
  DeckGoAlertRuleResponse,
  DeckGoAlertsResponse,
  DeckGoApprovalPolicy,
  DeckGoApprovalPolicyDefaults,
  DeckGoApprovalPolicyResponse,
  DeckGoBootstrapStatusResponse,
  DeckGoBudgetDimension,
  DeckGoBudgetEvaluation,
  DeckGoBudgetEvaluationsResponse,
  DeckGoBudgetRule,
  DeckGoBudgetRulesResponse,
  DeckGoBudgetStatus,
  DeckGoBundledRuntimeGatewayStatus,
  DeckGoCatalogProvider,
  DeckGoChannelsStatusResponse,
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputBucket,
  DeckGoChannelThroughputResponse,
  DeckGoChatAbortRequest,
  DeckGoChatHistoryResponse,
  DeckGoChatSendRequest,
  DeckGoChatSessionCreateRequest,
  DeckGoChatSnapshotResponse,
  DeckGoChatSteerRequest,
  DeckGoChatSteerResponse,
  DeckGoCompactionActionResponse,
  DeckGoCompactionCheckpoint,
  DeckGoCompactionListResponse,
  DeckGoConfigApplyResponse,
  DeckGoConfigLookupChild,
  DeckGoConfigLookupResponse,
  DeckGoConfigSchemaLookupRequest,
  DeckGoConfigSnapshotResponse,
  DeckGoContextWeightReport,
  DeckGoCronJob,
  DeckGoCronJobInput,
  DeckGoCronJobsParams,
  DeckGoCronJobsResponse,
  DeckGoCronRunEntry,
  DeckGoCronRunParams,
  DeckGoCronRunsParams,
  DeckGoCronRunsResponse,
  DeckGoCronSchedule,
  DeckGoCronStatus,
  DeckGoDevicesResponse,
  DeckGoDeviceTokenRotateResponse,
  DeckGoDeviceTokenSummary,
  DeckGoDoc,
  DeckGoDocCategory,
  DeckGoDocsExtractResponse,
  DeckGoDocsResponse,
  DeckGoEffectiveTool,
  DeckGoEffectiveToolGroup,
  DeckGoEffectiveToolsResponse,
  DeckGoGatewayDescribeEvent,
  DeckGoGatewayDescribeMethod,
  DeckGoGatewayDescribeResponse,
  DeckGoGatewayHealthResponse,
  DeckGoGatewayStatusResponse,
  DeckGoIdentityLink,
  DeckGoIdentityLinksResponse,
  DeckGoIdentityPeer,
  DeckGoLogsTailResponse,
  DeckGoLogStreamEvent,
  DeckGoMemoryBrowseResponse,
  DeckGoMemoryDreamAction,
  DeckGoMemoryDreamActionResult,
  DeckGoMemoryDreamDiaryResult,
  DeckGoMemoryDreamsResult,
  DeckGoMemoryFileNode,
  DeckGoMemoryHealthEntry,
  DeckGoMemoryHealthResponse,
  DeckGoMemorySearchResponse,
  DeckGoMemorySearchResult,
  DeckGoMemorySearchScope,
  DeckGoModelAuthOverviewResponse,
  DeckGoModelAuthProvider,
  DeckGoModelCatalogProvidersResponse,
  DeckGoModelProbeResponse,
  DeckGoModelsConfigResponse,
  DeckGoMonitorRun,
  DeckGoMonitorRunDetailResponse,
  DeckGoMonitorRunEvent,
  DeckGoMonitorRunsResponse,
  DeckGoMonitorRunStatus,
  DeckGoMonitorRunSummary,
  DeckGoMonitorStatsResponse,
  DeckGoMonitorTopAgent,
  DeckGoNodeInvokeResponse,
  DeckGoNodePairingResponse,
  DeckGoNodePairRequestInput,
  DeckGoNodePairRequestResponse,
  DeckGoNodePendingEnqueueResponse,
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
  DeckGoNodesResponse,
  DeckGoNodeSummary,
  DeckGoPairedDevice,
  DeckGoPairingRequest,
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
  DeckGoPendingDeviceRequest,
  DeckGoPluginApprovalEntry,
  DeckGoPluginApprovalsResponse,
  DeckGoPluginCapability,
  DeckGoPluginsListResponse,
  DeckGoRemoteRuntimeGatewayStatus,
  DeckGoRoutingAddResponse,
  DeckGoRoutingBinding,
  DeckGoRoutingConflict,
  DeckGoRoutingListResponse,
  DeckGoRoutingMatch,
  DeckGoRoutingPeer,
  DeckGoRoutingRemoveResponse,
  DeckGoRoutingSimulateResponse,
  DeckGoRoutingSimulationTier,
  DeckGoRoutingValidateResponse,
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeConfiguredModel,
  DeckGoRuntimeConfiguredModelsResponse,
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
  DeckGoRuntimeGatewayResponse,
  DeckGoRuntimeGatewayStatus,
  DeckGoSelfDeviceResponse,
  DeckGoServerEvent,
  DeckGoSession,
  DeckGoSessionAbortResponse,
  DeckGoSessionCreateResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionEventsRequest,
  DeckGoSessionEventsResponse,
  DeckGoSessionMutationResponse,
  DeckGoSessionSendResponse,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoSettings,
  DeckGoSettingsConnectionResponse,
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
  DeckGoSettingsVersionResponse,
  DeckGoSkillEntry,
  DeckGoSkillHubBinsResponse,
  DeckGoSkillHubDetailResponse,
  DeckGoSkillHubMutationResponse,
  DeckGoSkillHubSearchResponse,
  DeckGoSkillHubSearchResult,
  DeckGoSkillInstallOption,
  DeckGoSkillsResponse,
  DeckGoSkillStatus,
  DeckGoSkillUpdateResponse,
  DeckGoSubagentKillResponse,
  DeckGoSubagentLineageNode,
  DeckGoSubagentLineageRoot,
  DeckGoSubagentRun,
  DeckGoSubagentsLineageResponse,
  DeckGoSubagentsListResponse,
  DeckGoSubagentSteerResponse,
  DeckGoThreadEntry,
  DeckGoThreadsResponse,
  DeckGoToolCatalogEntry,
  DeckGoToolCatalogGroup,
  DeckGoToolsCatalogResponse,
  DeckGoUsageAggregateEntry,
  DeckGoUsageCostEntry,
  DeckGoUsageCostResponse,
  DeckGoUsageDailyAggregate,
  DeckGoUsageDailyModelAggregate,
  DeckGoUsageLatencyStats,
  DeckGoUsageMessageCounts,
  DeckGoUsageProvidersResponse,
  DeckGoUsageProviderStatus,
  DeckGoUsageProviderWindow,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
  DeckGoUsageSessionLogsResponse,
  DeckGoUsageSessionsResponse,
  DeckGoUsageTimePoint,
  DeckGoUsageTimeseriesResponse,
  DeckGoUsageToolSummary,
  DeckGoUsageTotals,
  DeckGoWebhook,
  DeckGoWebhookDeliveriesResponse,
  DeckGoWebhookDelivery,
  DeckGoWebhooksResponse,
} from "./api-types";
export type {
  DeckGoActivityEvent,
  DeckGoActivityResponse,
  DeckGoAgentDetailResponse,
  DeckGoAgentEventStreamsResponse,
  DeckGoAgentEventStreamsSetResponse,
  DeckGoAgentFile,
  DeckGoAgentFileResponse,
  DeckGoAgentFilesResponse,
  DeckGoAgentHealthSnapshot,
  DeckGoAgentIdentityResponse,
  DeckGoAgentMutationResponse,
  DeckGoAgentRawConfig,
  DeckGoAgentSkillEntry,
  DeckGoAgentSkillsResponse,
  DeckGoAgentSkillsSetResponse,
  DeckGoAgentsListResponse,
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSubagentConfigSetResponse,
  DeckGoAgentSummary,
  DeckGoAgentSystemPromptPreviewResponse,
  DeckGoAgentToolPolicyPreviewResponse,
  DeckGoAlertAction,
  DeckGoAlertRule,
  DeckGoAlertRuleResponse,
  DeckGoAlertsResponse,
  DeckGoApprovalPolicy,
  DeckGoApprovalPolicyDefaults,
  DeckGoApprovalPolicyResponse,
  DeckGoBootstrapStatusResponse,
  DeckGoBudgetDimension,
  DeckGoBudgetEvaluation,
  DeckGoBudgetEvaluationsResponse,
  DeckGoBudgetRule,
  DeckGoBudgetRulesResponse,
  DeckGoBudgetStatus,
  DeckGoBundledRuntimeGatewayStatus,
  DeckGoCatalogProvider,
  DeckGoChannelsStatusResponse,
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputBucket,
  DeckGoChannelThroughputResponse,
  DeckGoChatAbortRequest,
  DeckGoChatHistoryResponse,
  DeckGoChatSendRequest,
  DeckGoChatSessionCreateRequest,
  DeckGoChatSnapshotResponse,
  DeckGoChatSteerRequest,
  DeckGoChatSteerResponse,
  DeckGoCompactionActionResponse,
  DeckGoCompactionCheckpoint,
  DeckGoCompactionListResponse,
  DeckGoConfigApplyResponse,
  DeckGoConfigLookupChild,
  DeckGoConfigLookupResponse,
  DeckGoConfigSchemaLookupRequest,
  DeckGoConfigSnapshotResponse,
  DeckGoContextWeightReport,
  DeckGoCronJob,
  DeckGoCronJobInput,
  DeckGoCronJobsParams,
  DeckGoCronJobsResponse,
  DeckGoCronRunEntry,
  DeckGoCronRunParams,
  DeckGoCronRunsParams,
  DeckGoCronRunsResponse,
  DeckGoCronSchedule,
  DeckGoCronStatus,
  DeckGoDevicesResponse,
  DeckGoDeviceTokenRotateResponse,
  DeckGoDeviceTokenSummary,
  DeckGoDoc,
  DeckGoDocCategory,
  DeckGoDocsExtractResponse,
  DeckGoDocsResponse,
  DeckGoEffectiveTool,
  DeckGoEffectiveToolGroup,
  DeckGoEffectiveToolsResponse,
  DeckGoGatewayDescribeEvent,
  DeckGoGatewayDescribeMethod,
  DeckGoGatewayDescribeResponse,
  DeckGoGatewayHealthResponse,
  DeckGoGatewayStatusResponse,
  DeckGoIdentityLink,
  DeckGoIdentityLinksResponse,
  DeckGoIdentityPeer,
  DeckGoLogsTailResponse,
  DeckGoLogStreamEvent,
  DeckGoMemoryBrowseResponse,
  DeckGoMemoryDreamAction,
  DeckGoMemoryDreamActionResult,
  DeckGoMemoryDreamDiaryResult,
  DeckGoMemoryDreamsResult,
  DeckGoMemoryFileNode,
  DeckGoMemoryHealthEntry,
  DeckGoMemoryHealthResponse,
  DeckGoMemorySearchResponse,
  DeckGoMemorySearchResult,
  DeckGoMemorySearchScope,
  DeckGoModelAuthOverviewResponse,
  DeckGoModelAuthProvider,
  DeckGoModelCatalogProvidersResponse,
  DeckGoModelProbeResponse,
  DeckGoModelsConfigResponse,
  DeckGoMonitorRun,
  DeckGoMonitorRunDetailResponse,
  DeckGoMonitorRunEvent,
  DeckGoMonitorRunsResponse,
  DeckGoMonitorRunStatus,
  DeckGoMonitorRunSummary,
  DeckGoMonitorStatsResponse,
  DeckGoMonitorTopAgent,
  DeckGoNodeInvokeResponse,
  DeckGoNodePairingResponse,
  DeckGoNodePairRequestInput,
  DeckGoNodePairRequestResponse,
  DeckGoNodePendingEnqueueResponse,
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
  DeckGoNodesResponse,
  DeckGoNodeSummary,
  DeckGoPairedDevice,
  DeckGoPairingRequest,
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
  DeckGoPendingDeviceRequest,
  DeckGoPluginApprovalEntry,
  DeckGoPluginApprovalsResponse,
  DeckGoPluginCapability,
  DeckGoPluginsListResponse,
  DeckGoRemoteRuntimeGatewayStatus,
  DeckGoRoutingAddResponse,
  DeckGoRoutingBinding,
  DeckGoRoutingConflict,
  DeckGoRoutingListResponse,
  DeckGoRoutingMatch,
  DeckGoRoutingPeer,
  DeckGoRoutingRemoveResponse,
  DeckGoRoutingSimulateResponse,
  DeckGoRoutingSimulationTier,
  DeckGoRoutingValidateResponse,
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeConfiguredModel,
  DeckGoRuntimeConfiguredModelsResponse,
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
  DeckGoRuntimeGatewayResponse,
  DeckGoRuntimeGatewayStatus,
  DeckGoSelfDeviceResponse,
  DeckGoServerEvent,
  DeckGoSession,
  DeckGoSessionAbortResponse,
  DeckGoSessionCreateResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionEventsRequest,
  DeckGoSessionEventsResponse,
  DeckGoSessionMutationResponse,
  DeckGoSessionSendResponse,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoSettings,
  DeckGoSettingsConnectionResponse,
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
  DeckGoSettingsVersionResponse,
  DeckGoSkillEntry,
  DeckGoSkillHubBinsResponse,
  DeckGoSkillHubDetailResponse,
  DeckGoSkillHubMutationResponse,
  DeckGoSkillHubSearchResponse,
  DeckGoSkillHubSearchResult,
  DeckGoSkillInstallOption,
  DeckGoSkillsResponse,
  DeckGoSkillStatus,
  DeckGoSkillUpdateResponse,
  DeckGoSubagentKillResponse,
  DeckGoSubagentLineageNode,
  DeckGoSubagentLineageRoot,
  DeckGoSubagentRun,
  DeckGoSubagentsLineageResponse,
  DeckGoSubagentsListResponse,
  DeckGoSubagentSteerResponse,
  DeckGoThreadEntry,
  DeckGoThreadsResponse,
  DeckGoToolCatalogEntry,
  DeckGoToolCatalogGroup,
  DeckGoToolsCatalogResponse,
  DeckGoUsageAggregateEntry,
  DeckGoUsageCostEntry,
  DeckGoUsageCostResponse,
  DeckGoUsageDailyAggregate,
  DeckGoUsageDailyModelAggregate,
  DeckGoUsageLatencyStats,
  DeckGoUsageMessageCounts,
  DeckGoUsageProvidersResponse,
  DeckGoUsageProviderStatus,
  DeckGoUsageProviderWindow,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionLogEntry,
  DeckGoUsageSessionLogsResponse,
  DeckGoUsageSessionsResponse,
  DeckGoUsageTimePoint,
  DeckGoUsageTimeseriesResponse,
  DeckGoUsageToolSummary,
  DeckGoUsageTotals,
  DeckGoWebhook,
  DeckGoWebhookDeliveriesResponse,
  DeckGoWebhookDelivery,
  DeckGoWebhooksResponse,
} from "./api-types";
import { writeStoredDeckAccessToken } from "./lib/deck-auth-storage";
import { deckFetch, deckStream, type DeckEvent } from "./lib/deck-client";
import { createDeckGatewayClient } from "./lib/gateway-client";
import type { A2UIState } from "./stores/chat-types";

export function isBundledRuntimeStatus(
  runtime: DeckGoRuntimeGatewayStatus | null | undefined,
): runtime is DeckGoBundledRuntimeGatewayStatus {
  return runtime?.mode === "bundled";
}

export function isRemoteRuntimeStatus(
  runtime: DeckGoRuntimeGatewayStatus | null | undefined,
): runtime is DeckGoRemoteRuntimeGatewayStatus {
  return runtime?.mode === "remote";
}

function normalizeRuntimeGatewayStatus(
  raw: DeckApi.DeckGoRuntimeGatewayStatus,
): DeckGoRuntimeGatewayStatus {
  if (raw.mode === "remote") {
    return {
      configured: raw.configured,
      gatewayUrl: raw.gatewayUrl,
      health: raw.health,
      lastConnectedAt: raw.lastConnectedAt,
      lastError: raw.lastError,
      latencyP50: raw.latencyP50,
      mode: "remote",
      status: raw.status,
      tlsVerified: raw.tlsVerified,
    };
  }
  return {
    autoStart: raw.autoStart ?? false,
    configured: raw.configured,
    failurePhase: raw.failurePhase,
    gatewayUrl: raw.gatewayUrl,
    health: raw.health,
    lastError: raw.lastError,
    lastExitAt: raw.lastExitAt,
    lastExitCode: raw.lastExitCode,
    managed: raw.managed,
    mode: "bundled",
    owner: raw.owner,
    ownershipFile: raw.ownershipFile,
    ownershipState: raw.ownershipState,
    pid: raw.pid,
    restartAttempts: raw.restartAttempts,
    restartDelayMs: raw.restartDelayMs,
    startedAt: raw.startedAt,
    status: raw.status,
  };
}

function buildApiPath(path: string) {
  if (path.startsWith("/api/")) {
    return path;
  }
  if (path.startsWith("/")) {
    return `/api${path}`;
  }
  return `/api/${path}`;
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { code?: string; error?: string; message?: string };
    if (payload.code && payload.message) {
      return `${payload.code}: ${payload.message}`;
    }
    return payload.error || payload.message || payload.code || fallback;
  } catch {
    return fallback;
  }
}

async function fetchDeckJson<T>(path: string, init: RequestInit | undefined, fallback: string) {
  const res = await deckFetch(buildApiPath(path), init);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, fallback));
  }
  return (await res.json()) as T;
}

async function fetchDeckJsonNoPrompt<T>(
  path: string,
  init: RequestInit | undefined,
  fallback: string,
) {
  const res = await deckFetch(buildApiPath(path), init, { allowPrompt: false });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, fallback));
  }
  return (await res.json()) as T;
}

type PersistedA2UIState = Omit<A2UIState, "bridgeStatus" | "treeData">;

function sanitizeA2UIState(state: A2UIState | null): PersistedA2UIState | null {
  if (!state) {
    return null;
  }
  const { bridgeStatus: _bridgeStatus, treeData: _treeData, ...rest } = state;
  void _bridgeStatus;
  void _treeData;
  return rest;
}

export async function fetchSettings() {
  return fetchDeckJson<DeckGoSettingsResponse>("/settings", undefined, "settings fetch failed");
}

export async function saveSettings(settings: DeckGoSettings) {
  return fetchDeckJson<DeckGoSettingsSaveResponse>(
    "/settings",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    },
    "settings save failed",
  );
}

export async function testSettingsConnection(url: string, token: string) {
  return fetchDeckJson<DeckGoSettingsConnectionResponse>(
    "/settings/test-connection",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, token }),
    },
    "settings connection test failed",
  );
}

export async function fetchSettingsVersion() {
  return fetchDeckJson<DeckGoSettingsVersionResponse>(
    "/settings/version",
    undefined,
    "settings version fetch failed",
  );
}

export async function fetchDevices() {
  return fetchDeckJson<DeckGoDevicesResponse>("/devices", undefined, "devices fetch failed");
}

export async function fetchSelfDevice() {
  return fetchDeckJson<DeckGoSelfDeviceResponse>(
    "/devices/self",
    undefined,
    "self device fetch failed",
  );
}

export async function approveDeviceRequest(requestId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/devices/approve",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    },
    "device request approve failed",
  );
}

export async function rejectDeviceRequest(requestId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/devices/reject",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    },
    "device request reject failed",
  );
}

export async function removeDevice(deviceId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/devices/remove",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    },
    "device remove failed",
  );
}

export async function rotateDeviceToken(deviceId: string, role: string) {
  return fetchDeckJson<DeckGoDeviceTokenRotateResponse>(
    "/devices/token/rotate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, role }),
    },
    "device token rotate failed",
  );
}

export async function revokeDeviceToken(deviceId: string, role: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/devices/token/revoke",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, role }),
    },
    "device token revoke failed",
  );
}

export async function fetchBootstrapStatus() {
  const payload = await fetchDeckJsonNoPrompt<DeckApi.DeckGoBootstrapStatusResponse>(
    "/bootstrap/status",
    undefined,
    "bootstrap fetch failed",
  );
  return {
    ...payload,
    runtime: normalizeRuntimeGatewayStatus(payload.runtime),
  } satisfies DeckGoBootstrapStatusResponse;
}

export async function fetchRuntimeGatewayStatus() {
  const runtime = await fetchDeckJsonNoPrompt<DeckApi.DeckGoRuntimeGatewayStatus>(
    "/runtime/gateway",
    undefined,
    "runtime gateway fetch failed",
  );
  return {
    ok: true,
    runtime: normalizeRuntimeGatewayStatus(runtime),
  } satisfies DeckGoRuntimeGatewayResponse;
}

export async function fetchCapabilities() {
  return fetchDeckJsonNoPrompt<DeckGoRuntimeCapabilities>(
    "/runtime/capabilities",
    undefined,
    "runtime capabilities fetch failed",
  );
}

export async function fetchEndpoint() {
  return fetchDeckJsonNoPrompt<DeckGoRuntimeEndpointResponse>(
    "/runtime/endpoint",
    undefined,
    "runtime endpoint fetch failed",
  );
}

export async function updateEndpoint(payload: DeckGoRuntimeEndpointPutRequest) {
  return fetchDeckJson<DeckGoRuntimeEndpointResponse>(
    "/runtime/endpoint",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "runtime endpoint update failed",
  );
}

export async function testEndpoint(payload?: DeckGoRuntimeEndpointTestRequest) {
  return fetchDeckJson<DeckGoRuntimeEndpointTestResponse>(
    "/runtime/endpoint:test",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    },
    "runtime endpoint test failed",
  );
}

export async function fetchGatewayHealth() {
  return fetchDeckJsonNoPrompt<DeckGoGatewayHealthResponse>(
    "/gateway/health",
    undefined,
    "gateway health fetch failed",
  );
}

export async function fetchGatewayStatus() {
  return fetchDeckJsonNoPrompt<DeckGoGatewayStatusResponse>(
    "/gateway/status",
    undefined,
    "gateway status fetch failed",
  );
}

export async function postConfigSchemaLookup(body: DeckGoConfigSchemaLookupRequest) {
  return fetchDeckJson<Record<string, unknown>>(
    "/config/schema-lookup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "config schema lookup failed",
  );
}

export async function logoutChannel(channelId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/channels/${encodeURIComponent(channelId)}/logout`,
    { method: "POST" },
    "channel logout failed",
  );
}

export async function fetchChannels() {
  return fetchDeckJson<DeckGoChannelsStatusResponse>(
    "/channels",
    undefined,
    "channels fetch failed",
  );
}

export async function testChannel(channelId: string) {
  const res = await deckFetch(buildApiPath(`/channels/${encodeURIComponent(channelId)}/test`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = (await res.json().catch(() => ({}))) as DeckGoChannelTestResponse;
  if (!res.ok) {
    return {
      ...payload,
      ok: false,
      error: payload.error || `channel test failed (${res.status})`,
    } satisfies DeckGoChannelTestResponse;
  }
  return payload;
}

export async function fetchChannelThroughput(channelId: string, window = "1h") {
  return fetchDeckJson<DeckGoChannelThroughputResponse>(
    `/channels/${encodeURIComponent(channelId)}/throughput?window=${encodeURIComponent(window)}`,
    undefined,
    "channel throughput fetch failed",
  );
}

export async function patchChannelConfig(channelId: string, patch: Record<string, unknown>) {
  return fetchDeckJson<Record<string, unknown>>(
    `/channels/${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "channel config patch failed",
  );
}

export async function fetchPlugins() {
  return fetchPluginsWithCapability();
}

export async function fetchPluginsWithCapability(capability: DeckGoPluginCapability = "channel") {
  const suffix = capability === "all" ? "?capability=all" : "";
  return fetchDeckJson<DeckGoPluginsListResponse>(
    `/deck/plugins${suffix}`,
    undefined,
    "plugins fetch failed",
  );
}

type DeckGoBudgetEvaluationWire = Omit<DeckGoBudgetEvaluation, "current"> & {
  current?: number;
  currentValue?: number;
};

type DeckGoBudgetEvaluationsWireResponse = {
  evaluations?: DeckGoBudgetEvaluationWire[];
};

function normalizeBudgetEvaluation(evaluation: DeckGoBudgetEvaluationWire): DeckGoBudgetEvaluation {
  const { current, currentValue, ...rest } = evaluation;
  const resolvedCurrent =
    typeof current === "number" && Number.isFinite(current)
      ? current
      : typeof currentValue === "number" && Number.isFinite(currentValue)
        ? currentValue
        : 0;
  return { ...rest, current: resolvedCurrent };
}

type TypedGatewayAgentSummary = {
  id: string;
  identity?: {
    avatar?: string;
    avatarUrl?: string;
    emoji?: string;
    name?: string;
  };
  model?: {
    fallbacks?: string[];
    primary?: string;
  };
  name?: string;
  workspace?: string;
};

function normalizeGatewayAgentSummary(agent: TypedGatewayAgentSummary): DeckGoAgentSummary {
  return {
    ...agent,
    avatar: agent.identity?.avatar ?? agent.identity?.avatarUrl,
    emoji: agent.identity?.emoji,
    model: agent.model?.primary,
    name: agent.name ?? agent.identity?.name,
  };
}

export async function fetchLogsTail(params?: {
  cursor?: number;
  limit?: number;
  maxBytes?: number;
}) {
  const query = new URLSearchParams();
  if (typeof params?.cursor === "number") {
    query.set("cursor", String(params.cursor));
  }
  if (typeof params?.limit === "number") {
    query.set("limit", String(params.limit));
  }
  if (typeof params?.maxBytes === "number") {
    query.set("maxBytes", String(params.maxBytes));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchDeckJson<DeckGoLogsTailResponse>(`/logs${suffix}`, undefined, "logs tail failed");
}

export async function fetchGatewayDescribe() {
  return fetchDeckJson<DeckGoGatewayDescribeResponse>(
    "/gateway/describe",
    undefined,
    "gateway describe failed",
  );
}

export async function fetchApprovalsPolicy() {
  return fetchDeckJson<DeckGoApprovalPolicyResponse>(
    "/approvals/policy",
    undefined,
    "approvals policy fetch failed",
  );
}

export async function fetchPendingApprovals() {
  return fetchDeckJson<DeckGoPendingApprovalsResponse>(
    "/approvals/pending",
    undefined,
    "pending approvals fetch failed",
  );
}

export async function resolveApproval(
  id: string,
  decision: "allow-once" | "allow-always" | "deny",
) {
  return fetchDeckJson<Record<string, unknown>>(
    "/approvals",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    },
    "approval resolution failed",
  );
}

export async function updateApprovalsPolicy(file: DeckGoApprovalPolicy, baseHash?: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/approvals/policy",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file,
        ...(baseHash ? { baseHash } : {}),
      }),
    },
    "approval policy update failed",
  );
}

export async function fetchPluginApprovals() {
  return fetchDeckJson<DeckGoPluginApprovalsResponse>(
    "/approvals/plugins",
    undefined,
    "plugin approvals fetch failed",
  );
}

export async function resolvePluginApproval(
  id: string,
  decision: "allow-once" | "allow-always" | "deny",
) {
  return fetchDeckJson<Record<string, unknown>>(
    "/approvals/plugins",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    },
    "plugin approval resolution failed",
  );
}

export async function fetchSkills(agentId?: string) {
  const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
  return fetchDeckJson<DeckGoSkillsResponse>(`/skills${query}`, undefined, "skills fetch failed");
}

export async function updateSkill(
  skillKey: string,
  patch: { enabled?: boolean; apiKey?: string; env?: Record<string, string> },
) {
  return fetchDeckJson<DeckGoSkillUpdateResponse>(
    `/skills/${encodeURIComponent(skillKey)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "skill update failed",
  );
}

export async function installSkill(name: string, installId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/skills/install",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, installId }),
    },
    "skill install failed",
  );
}

export async function fetchSkillHubBins() {
  return fetchDeckJson<DeckGoSkillHubBinsResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bins" }),
    },
    "skill hub bins fetch failed",
  );
}

export async function searchSkillHub(query: string, limit = 20) {
  return fetchDeckJson<DeckGoSkillHubSearchResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search", query, limit }),
    },
    "skill hub search failed",
  );
}

export async function fetchSkillHubDetail(slug: string) {
  return fetchDeckJson<DeckGoSkillHubDetailResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detail", slug }),
    },
    "skill hub detail failed",
  );
}

export async function installSkillHub(slug: string, version?: string) {
  const body: Record<string, unknown> = { action: "install", slug };
  if (version) {
    body.version = version;
  }
  return fetchDeckJson<DeckGoSkillHubMutationResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "skill hub install failed",
  );
}

export async function updateSkillHub(slug?: string) {
  const body: Record<string, unknown> = { action: "update" };
  if (slug) {
    body.slug = slug;
  }
  return fetchDeckJson<DeckGoSkillHubMutationResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "skill hub update failed",
  );
}

export async function fetchCronJobs(params?: DeckGoCronJobsParams) {
  const search = new URLSearchParams();
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset)) {
    search.set("offset", String(params.offset));
  }
  if (params?.query?.trim()) {
    search.set("query", params.query.trim());
  }
  if (params?.enabled) {
    search.set("enabled", params.enabled);
  }
  if (params?.sortBy) {
    search.set("sortBy", params.sortBy);
  }
  if (params?.sortDir) {
    search.set("sortDir", params.sortDir);
  }
  if (params?.includeDisabled != null) {
    search.set("includeDisabled", String(params.includeDisabled));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoCronJobsResponse>(
    `/cron${suffix}`,
    undefined,
    "cron jobs fetch failed",
  );
}

export async function fetchCronStatus() {
  return fetchDeckJson<DeckGoCronStatus>("/cron/status", undefined, "cron status fetch failed");
}

export async function fetchCronRuns(jobId: string, params?: DeckGoCronRunsParams) {
  const search = new URLSearchParams();
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset)) {
    search.set("offset", String(params.offset));
  }
  if (params?.sortDir) {
    search.set("sortDir", params.sortDir);
  }
  if (params?.statuses?.length) {
    search.set("statuses", params.statuses.join(","));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoCronRunsResponse>(
    `/cron/${encodeURIComponent(jobId)}/runs${suffix}`,
    undefined,
    "cron runs fetch failed",
  );
}

export async function createCronJob(input: DeckGoCronJobInput) {
  return fetchDeckJson<DeckGoCronJob>(
    "/cron",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "cron create failed",
  );
}

export async function updateCronJob(jobId: string, input: Partial<DeckGoCronJobInput>) {
  return fetchDeckJson<DeckGoCronJob>(
    `/cron/${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "cron update failed",
  );
}

export async function runCronJob(jobId: string, params?: DeckGoCronRunParams) {
  const init: RequestInit = { method: "POST" };
  if (params?.mode) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify({ mode: params.mode });
  }
  return fetchDeckJson<Record<string, unknown>>(
    `/cron/${encodeURIComponent(jobId)}/run`,
    init,
    "cron run failed",
  );
}

export async function deleteCronJob(jobId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/cron/${encodeURIComponent(jobId)}`,
    { method: "DELETE" },
    "cron delete failed",
  );
}

export async function fetchDocs(params?: { category?: DeckGoDocCategory | null; query?: string }) {
  const search = new URLSearchParams();
  if (params?.category) {
    search.set("category", params.category);
  }
  if (params?.query?.trim()) {
    search.set("q", params.query.trim());
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoDocsResponse>(`/docs${suffix}`, undefined, "docs fetch failed");
}

export async function fetchDoc(docId: string) {
  return fetchDeckJson<DeckGoDoc>(
    `/docs/${encodeURIComponent(docId)}`,
    undefined,
    "doc fetch failed",
  );
}

export async function extractDocs(sessionKey: string) {
  return fetchDeckJson<DeckGoDocsExtractResponse>(
    "/docs/extract",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    },
    "docs extract failed",
  );
}

export async function deleteDoc(docId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/docs/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
    "doc delete failed",
  );
}

export async function fetchAlertRules() {
  return fetchDeckJson<DeckGoAlertsResponse>("/alerts", undefined, "alert rules fetch failed");
}

export async function createAlertRule(
  rule: Omit<DeckGoAlertRule, "id" | "lastFiredAt" | "createdAt" | "updatedAt">,
) {
  return fetchDeckJson<DeckGoAlertRuleResponse>(
    "/alerts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    },
    "alert rule create failed",
  );
}

export async function updateAlertRule(id: string, patch: Partial<DeckGoAlertRule>) {
  return fetchDeckJson<DeckGoAlertRuleResponse>(
    `/alerts/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "alert rule update failed",
  );
}

export async function deleteAlertRule(id: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/alerts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "alert rule delete failed",
  );
}

export async function fetchWebhooks() {
  return fetchDeckJson<DeckGoWebhooksResponse>("/webhooks", undefined, "webhooks fetch failed");
}

export async function createWebhook(input: {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled?: boolean;
}) {
  return fetchDeckJson<DeckGoWebhook>(
    "/webhooks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "webhook create failed",
  );
}

export async function updateWebhook(
  id: string,
  input: Partial<{
    name: string;
    url: string;
    secret?: string;
    events: string[];
    enabled?: boolean;
  }>,
) {
  return fetchDeckJson<DeckGoWebhook>(
    `/webhooks/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "webhook update failed",
  );
}

export async function deleteWebhook(id: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/webhooks/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "webhook delete failed",
  );
}

export async function fetchWebhookDeliveries(id: string) {
  return fetchDeckJson<DeckGoWebhookDeliveriesResponse>(
    `/webhooks/${encodeURIComponent(id)}/deliveries`,
    undefined,
    "webhook deliveries fetch failed",
  );
}

export async function testWebhook(id: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/webhooks/${encodeURIComponent(id)}/test`,
    { method: "POST" },
    "webhook test failed",
  );
}

export async function fetchNodes() {
  return fetchDeckJson<DeckGoNodesResponse>("/nodes", undefined, "nodes fetch failed");
}

export async function fetchNodePairing() {
  return fetchDeckJson<DeckGoNodePairingResponse>(
    "/nodes/pair",
    undefined,
    "node pairing fetch failed",
  );
}

export async function describeNode(nodeId: string) {
  return fetchDeckJson<DeckGoNodeSummary>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "describe", nodeId }),
    },
    "node describe failed",
  );
}

export async function renameNode(nodeId: string, displayName: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", nodeId, displayName }),
    },
    "node rename failed",
  );
}

function createIdempotencyKey() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `deck-go-${uuid}` : `deck-go-${Date.now()}`;
}

export async function invokeNodeCommand(
  nodeId: string,
  command: string,
  params: unknown,
  timeoutMs?: number,
) {
  const body: Record<string, unknown> = {
    action: "invoke",
    command,
    idempotencyKey: createIdempotencyKey(),
    nodeId,
  };
  if (params !== undefined) {
    body.params = params;
  }
  if (timeoutMs != null && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    body.timeoutMs = timeoutMs;
  }
  return fetchDeckJson<DeckGoNodeInvokeResponse>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "node invoke failed",
  );
}

export async function enqueueNodePendingWork(params: {
  nodeId: string;
  priority?: DeckGoNodePendingWorkPriority;
  type: DeckGoNodePendingWorkType;
  wake?: boolean;
}) {
  return fetchDeckJson<DeckGoNodePendingEnqueueResponse>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pending.enqueue", ...params }),
    },
    "node pending enqueue failed",
  );
}

export async function approveNodePairing(requestId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", requestId }),
    },
    "node pairing approve failed",
  );
}

export async function requestNodePairing(params: DeckGoNodePairRequestInput) {
  return fetchDeckJson<DeckGoNodePairRequestResponse>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", ...params }),
    },
    "node pairing request failed",
  );
}

export async function rejectNodePairing(requestId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", requestId }),
    },
    "node pairing reject failed",
  );
}

export async function verifyNodePairing(nodeId: string, token: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", nodeId, token }),
    },
    "node pairing verify failed",
  );
}

export async function browseMemory(agentId: string, path?: string) {
  const search = new URLSearchParams({ agentId });
  if (path) {
    search.set("path", path);
  }
  return fetchDeckJson<DeckGoMemoryBrowseResponse>(
    `/memory/browse?${search.toString()}`,
    undefined,
    "memory browse failed",
  );
}

export async function readMemoryFile(agentId: string, path: string) {
  const search = new URLSearchParams({ agentId, path, read: "1" });
  return fetchDeckJson<DeckGoMemoryBrowseResponse>(
    `/memory/browse?${search.toString()}`,
    undefined,
    "memory read failed",
  );
}

export async function fetchMemoryHealth() {
  return fetchDeckJson<DeckGoMemoryHealthResponse>(
    "/memory/health",
    undefined,
    "memory health fetch failed",
  );
}

export async function searchMemory(params: {
  query: string;
  agentId?: string;
  scope?: DeckGoMemorySearchScope;
}) {
  const search = new URLSearchParams();
  search.set("q", params.query);
  if (params.agentId?.trim()) {
    search.set("agentId", params.agentId.trim());
  }
  if (params.scope && params.scope !== "all") {
    search.set("scope", params.scope);
  }
  const res = await deckFetch(buildApiPath(`/memory/search?${search.toString()}`), undefined);
  if (!res.ok) {
    const message = await readErrorMessage(res, "memory search failed");
    if (res.status === 501) {
      return {
        results: [],
        unavailableReason: message,
        lanceDbEnabled: false,
      } satisfies DeckGoMemorySearchResponse;
    }
    throw new Error(message);
  }
  const payload = (await res.json()) as DeckGoMemorySearchResponse;
  return {
    ...payload,
    results: payload.results ?? [],
    unavailableReason: null,
    lanceDbEnabled: true,
  } satisfies DeckGoMemorySearchResponse;
}

export async function runMemoryDreams(action: DeckGoMemoryDreamAction) {
  return fetchDeckJson<DeckGoMemoryDreamsResult>(
    "/memory/dreams",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    },
    "memory dreams action failed",
  );
}

export async function fetchBudgetRules() {
  return fetchDeckJson<DeckGoBudgetRulesResponse>(
    "/usage/budget",
    undefined,
    "budget rules fetch failed",
  );
}

export async function createBudgetRule(
  input: Omit<DeckGoBudgetRule, "id" | "createdAt" | "updatedAt">,
) {
  return fetchDeckJson<DeckGoBudgetRule>(
    "/usage/budget",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "budget rule create failed",
  );
}

export async function updateBudgetRule(id: string, input: Partial<DeckGoBudgetRule>) {
  return fetchDeckJson<DeckGoBudgetRule>(
    `/usage/budget/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "budget rule update failed",
  );
}

export async function deleteBudgetRule(id: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/usage/budget/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "budget rule delete failed",
  );
}

export async function evaluateBudgetRules() {
  const response = await fetchDeckJson<DeckGoBudgetEvaluationsWireResponse>(
    "/usage/budget/evaluate",
    undefined,
    "budget evaluation failed",
  );
  return {
    evaluations: (response.evaluations ?? []).map(normalizeBudgetEvaluation),
  };
}

export async function fetchIdentityLinks() {
  return fetchDeckJson<DeckGoIdentityLinksResponse>(
    "/deck/identity",
    undefined,
    "identity links fetch failed",
  );
}

export async function linkIdentityPeer(
  canonical: string,
  channel: string,
  peerId: string,
  baseHash: string,
) {
  return fetchDeckJson<Record<string, unknown>>(
    "/deck/identity",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", canonical, channel, peerId, baseHash }),
    },
    "identity link failed",
  );
}

export async function unlinkIdentityPeer(
  canonical: string,
  channel: string,
  peerId: string,
  baseHash: string,
) {
  return fetchDeckJson<Record<string, unknown>>(
    "/deck/identity",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink", canonical, channel, peerId, baseHash }),
    },
    "identity unlink failed",
  );
}

export async function fetchThreads(params?: {
  agentId?: string;
  channel?: string;
  status?: "active" | "all";
}) {
  const search = new URLSearchParams();
  if (params?.agentId?.trim()) {
    search.set("agentId", params.agentId.trim());
  }
  if (params?.channel?.trim()) {
    search.set("channel", params.channel.trim());
  }
  if (params?.status) {
    search.set("status", params.status);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoThreadsResponse>(
    `/deck/threads${suffix}`,
    undefined,
    "threads fetch failed",
  );
}

export async function fetchRoutingBindings(params?: {
  agentId?: string;
  channel?: string;
  accountId?: string;
}) {
  const search = new URLSearchParams();
  if (params?.agentId?.trim()) {
    search.set("agentId", params.agentId.trim());
  }
  if (params?.channel?.trim()) {
    search.set("channel", params.channel.trim());
  }
  if (params?.accountId?.trim()) {
    search.set("accountId", params.accountId.trim());
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoRoutingListResponse>(
    `/deck/routing${suffix}`,
    undefined,
    "routing fetch failed",
  );
}

export async function validateRoutingBinding(params: {
  agentId: string;
  match: DeckGoRoutingMatch;
}) {
  return fetchDeckJson<DeckGoRoutingValidateResponse>(
    "/deck/routing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", ...params }),
    },
    "routing validate failed",
  );
}

export async function addRoutingBinding(params: {
  agentId: string;
  match: DeckGoRoutingMatch;
  baseHash: string;
  comment?: string;
  position?: number;
}) {
  return fetchDeckJson<DeckGoRoutingAddResponse>(
    "/deck/routing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...params }),
    },
    "routing add failed",
  );
}

export async function removeRoutingBinding(params: { id: string; baseHash: string }) {
  return fetchDeckJson<DeckGoRoutingRemoveResponse>(
    "/deck/routing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", ...params }),
    },
    "routing remove failed",
  );
}

export async function simulateRouting(params: {
  channel: string;
  accountId?: string;
  guildId?: string;
  teamId?: string;
  memberRoleIds?: string[];
  peer?: DeckGoRoutingPeer;
}) {
  return fetchDeckJson<DeckGoRoutingSimulateResponse>(
    "/deck/routing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "simulate", ...params }),
    },
    "routing simulate failed",
  );
}

export async function fetchSubagentRuns(params?: {
  status?: string;
  agentId?: string;
  requesterAgentId?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status?.trim()) {
    search.set("status", params.status.trim());
  }
  if (params?.agentId?.trim()) {
    search.set("agentId", params.agentId.trim());
  }
  if (params?.requesterAgentId?.trim()) {
    search.set("requesterAgentId", params.requesterAgentId.trim());
  }
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset)) {
    search.set("offset", String(params.offset));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoSubagentsListResponse>(
    `/deck/subagents${suffix}`,
    undefined,
    "subagent runs fetch failed",
  );
}

export async function fetchSubagentLineage(params: { runId?: string; sessionKey?: string }) {
  return fetchDeckJson<DeckGoSubagentsLineageResponse>(
    "/deck/subagents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lineage", ...params }),
    },
    "subagent lineage fetch failed",
  );
}

export async function killSubagentRun(runId: string) {
  return fetchDeckJson<DeckGoSubagentKillResponse>(
    "/deck/subagents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "kill", runId }),
    },
    "subagent kill failed",
  );
}

export async function steerSubagentRun(runId: string, instruction: string) {
  return fetchDeckJson<DeckGoSubagentSteerResponse>(
    "/deck/subagents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "steer", runId, instruction }),
    },
    "subagent steer failed",
  );
}

export async function fetchActivityEvents(limit = 100) {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  return fetchDeckJson<DeckGoActivityResponse>(
    `/activity?${search.toString()}`,
    undefined,
    "activity fetch failed",
  );
}

export async function fetchMonitorRuns(params?: {
  agentId?: string;
  cursor?: string;
  limit?: number;
  sessionKey?: string;
  since?: string;
  status?: string;
  until?: string;
}) {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 50));
  if (params?.agentId) {
    search.set("agentId", params.agentId);
  }
  if (params?.cursor) {
    search.set("cursor", params.cursor);
  }
  if (params?.sessionKey) {
    search.set("sessionKey", params.sessionKey);
  }
  if (params?.since) {
    search.set("since", params.since);
  }
  if (params?.status) {
    search.set("status", params.status);
  }
  if (params?.until) {
    search.set("until", params.until);
  }
  return fetchDeckJson<DeckGoMonitorRunsResponse>(
    `/monitor/runs?${search.toString()}`,
    undefined,
    "monitor runs fetch failed",
  );
}

export async function fetchMonitorStats() {
  return fetchDeckJson<DeckGoMonitorStatsResponse>(
    "/monitor/stats",
    undefined,
    "monitor stats fetch failed",
  );
}

export async function fetchMonitorRunDetail(runId: string) {
  return fetchDeckJson<DeckGoMonitorRunDetailResponse>(
    `/monitor/runs/${encodeURIComponent(runId)}`,
    undefined,
    "monitor run detail fetch failed",
  );
}

export async function fetchModelUsageCost(days?: number) {
  const search = new URLSearchParams();
  if (typeof days === "number") {
    search.set("days", String(days));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoUsageCostResponse>(
    `/models/usage/cost${suffix}`,
    undefined,
    "usage cost fetch failed",
  );
}

export async function fetchModelUsageProviders() {
  return fetchDeckJson<DeckGoUsageProvidersResponse>(
    "/models/usage/providers",
    undefined,
    "usage providers fetch failed",
  );
}

export async function fetchUsageSessions(params?: {
  startDate?: string;
  endDate?: string;
  key?: string;
  includeContextWeight?: boolean;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.startDate?.trim()) {
    search.set("startDate", params.startDate.trim());
  }
  if (params?.endDate?.trim()) {
    search.set("endDate", params.endDate.trim());
  }
  if (params?.key?.trim()) {
    search.set("key", params.key.trim());
  }
  if (params?.includeContextWeight) {
    search.set("includeContextWeight", "true");
  }
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchDeckJson<DeckGoUsageSessionsResponse>(
    `/usage/sessions${suffix}`,
    undefined,
    "usage sessions fetch failed",
  );
}

export async function fetchUsageSessionLogs(params: { key: string; limit?: number }) {
  const search = new URLSearchParams();
  search.set("key", params.key);
  if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  return fetchDeckJson<DeckGoUsageSessionLogsResponse>(
    `/usage/sessions/logs?${search.toString()}`,
    undefined,
    "usage session logs fetch failed",
  );
}

export async function fetchUsageTimeseries(params: {
  key: string;
  startDate?: string;
  endDate?: string;
  mode?: string;
  utcOffset?: string;
}) {
  const search = new URLSearchParams();
  search.set("key", params.key);
  if (params.startDate?.trim()) {
    search.set("startDate", params.startDate.trim());
  }
  if (params.endDate?.trim()) {
    search.set("endDate", params.endDate.trim());
  }
  if (params.mode?.trim()) {
    search.set("mode", params.mode.trim());
  }
  if (params.utcOffset?.trim()) {
    search.set("utcOffset", params.utcOffset.trim());
  }
  return fetchDeckJson<DeckGoUsageTimeseriesResponse>(
    `/usage/timeseries?${search.toString()}`,
    undefined,
    "usage timeseries fetch failed",
  );
}

export async function fetchDeckConfig() {
  return fetchDeckJson<DeckGoConfigSnapshotResponse>("/config", undefined, "config fetch failed");
}

export async function applyDeckConfig(raw: string, baseHash?: string) {
  return fetchDeckJson<DeckGoConfigApplyResponse>(
    "/config/apply",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, baseHash }),
    },
    "config apply failed",
  );
}

export async function patchDeckConfig(patch: Record<string, unknown>, baseHash?: string) {
  return fetchDeckJson<DeckGoConfigApplyResponse>(
    "/config/patch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch, baseHash }),
    },
    "config patch failed",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readConfigObject(snapshot: DeckGoConfigSnapshotResponse) {
  if (isRecord(snapshot.config)) {
    return snapshot.config;
  }
  if (typeof snapshot.raw === "string" && snapshot.raw.trim()) {
    const parsed = JSON.parse(snapshot.raw) as unknown;
    if (isRecord(parsed)) {
      return parsed;
    }
  }
  return {};
}

function mergeConfigEntry(
  current: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current };
  for (const [key, value] of Object.entries(updates)) {
    const currentValue = next[key];
    if (isRecord(currentValue) && isRecord(value)) {
      next[key] = mergeConfigEntry(currentValue, value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

export async function fetchAgentRawConfig(agentId: string): Promise<DeckGoAgentRawConfig> {
  const snapshot = await fetchDeckConfig();
  const config = readConfigObject(snapshot);
  const agentsConfig = isRecord(config.agents) ? config.agents : {};
  const defaults = isRecord(agentsConfig.defaults) ? { ...agentsConfig.defaults } : {};
  const list = Array.isArray(agentsConfig.list)
    ? agentsConfig.list.filter(isRecord).map((entry) => ({ ...entry }))
    : [];
  const entry = list.find((agent) => agent.id === agentId) ?? null;
  return {
    agentId,
    defaults,
    entry,
    list,
    baseHash: snapshot.baseHash ?? snapshot.hash ?? null,
  };
}

export async function updateAgentRawConfig(
  agentId: string,
  params: {
    entry?: Record<string, unknown> | null;
    updates: Record<string, unknown>;
    baseHash?: string | null;
  },
) {
  const nextEntry = mergeConfigEntry({ id: agentId, ...params.entry }, params.updates);
  nextEntry.id = agentId;
  return fetchDeckJson<DeckGoConfigApplyResponse>(
    "/config/patch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patch: { agents: { list: [nextEntry] } },
        baseHash: params.baseHash ?? undefined,
      }),
    },
    "agent config update failed",
  );
}

export async function fetchModelsConfig() {
  return fetchDeckJson<DeckGoModelsConfigResponse>(
    "/models/config",
    undefined,
    "models config fetch failed",
  );
}

export async function fetchRuntimeConfiguredModels(
  runtimeId = "rt_local",
): Promise<DeckGoRuntimeConfiguredModelsResponse> {
  const payload = await createDeckGatewayClient({ runtimeId }).models.configured({});
  const responsePayload: DeckGoRuntimeConfiguredModelsResponse["payload"] = { ...payload };
  return {
    runtimeId,
    payload: responsePayload,
  };
}

export async function fetchRuntimeModelAuthOverview(
  runtimeId = "rt_local",
): Promise<DeckGoModelAuthOverviewResponse> {
  const payload = await createDeckGatewayClient({ runtimeId }).deck.auth.overview({});
  const responsePayload: DeckGoModelAuthOverviewResponse["payload"] = { ...payload };
  return {
    runtimeId,
    payload: responsePayload,
    providers: responsePayload.providers,
  };
}

export async function fetchRuntimeModelCatalogProviders(
  runtimeId = "rt_local",
): Promise<DeckGoModelCatalogProvidersResponse> {
  const payload = await createDeckGatewayClient({ runtimeId }).models.catalog.providers({});
  const responsePayload: DeckGoModelCatalogProvidersResponse["payload"] = { ...payload };
  return {
    runtimeId,
    payload: responsePayload,
    providers: responsePayload.providers,
  };
}

export async function probeRuntimeModelAuth(
  provider: string,
  runtimeId = "rt_local",
): Promise<DeckGoModelProbeResponse> {
  const payload = await createDeckGatewayClient({ runtimeId }).deck.auth.probe({ provider });
  const responsePayload: DeckGoModelProbeResponse["payload"] = { ...payload };
  return {
    ...responsePayload,
    runtimeId,
    payload: responsePayload,
  };
}

export async function saveModelsConfig(raw: string, baseHash?: string) {
  return fetchDeckJson<DeckGoConfigApplyResponse>(
    "/models/config",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, baseHash }),
    },
    "models config save failed",
  );
}

export async function lookupConfigPath(path: string) {
  return fetchDeckJson<DeckGoConfigLookupResponse>(
    "/config/schema-lookup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    },
    "config schema lookup failed",
  );
}

export async function fetchAgentsList(): Promise<DeckGoAgentsListResponse> {
  const payload = await createDeckGatewayClient({ runtimeId: "rt_local" }).agents.list({});
  return {
    agents: payload.agents.map(normalizeGatewayAgentSummary),
    defaultId: payload.defaultId,
  };
}

export async function fetchAgentDetail(agentId: string) {
  return fetchDeckJson<DeckGoAgentDetailResponse>(
    `/deck/agents?agentId=${encodeURIComponent(agentId)}`,
    undefined,
    "agent detail fetch failed",
  );
}

export async function fetchAgentHealthSnapshot() {
  return fetchDeckJson<DeckGoAgentHealthSnapshot>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "health" }),
    },
    "agent health fetch failed",
  );
}

export async function fetchAgentEventStreams(agentId: string) {
  return fetchDeckJson<DeckGoAgentEventStreamsResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "eventStreams.get", agentId }),
    },
    "agent event streams fetch failed",
  );
}

export async function updateAgentEventStreams(
  agentId: string,
  eventStreams: string[],
  baseHash: string,
) {
  return fetchDeckJson<DeckGoAgentEventStreamsSetResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "eventStreams.set", agentId, eventStreams, baseHash }),
    },
    "agent event streams update failed",
  );
}

export async function fetchAgentSkills(agentId: string) {
  return fetchDeckJson<DeckGoAgentSkillsResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skills.get", agentId }),
    },
    "agent skills fetch failed",
  );
}

export async function updateAgentSkills(
  agentId: string,
  params: { mode: "all" | "whitelist"; skills: string[]; baseHash: string },
) {
  return fetchDeckJson<DeckGoAgentSkillsSetResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "skills.set",
        agentId,
        mode: params.mode,
        skills: params.skills,
        baseHash: params.baseHash,
      }),
    },
    "agent skills update failed",
  );
}

export async function fetchAgentSubagentConfig(agentId: string) {
  return fetchDeckJson<DeckGoAgentSubagentConfigResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subagents.get", agentId }),
    },
    "agent subagent config fetch failed",
  );
}

export async function updateAgentSubagentConfig(
  agentId: string,
  params: { allowAgents: string[]; model?: string; baseHash: string },
) {
  return fetchDeckJson<DeckGoAgentSubagentConfigSetResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subagents.set",
        agentId,
        allowAgents: params.allowAgents,
        ...(params.model !== undefined ? { model: params.model } : {}),
        baseHash: params.baseHash,
      }),
    },
    "agent subagent config update failed",
  );
}

export async function fetchAgentToolPolicyPreview(agentId: string) {
  return fetchDeckJson<DeckGoAgentToolPolicyPreviewResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toolPolicy.preview", agentId }),
    },
    "agent tool policy preview fetch failed",
  );
}

export async function fetchAgentSystemPromptPreview(agentId: string) {
  return fetchDeckJson<DeckGoAgentSystemPromptPreviewResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "systemPrompt.preview", agentId }),
    },
    "agent system prompt preview fetch failed",
  );
}

export async function fetchAgentFile(agentId: string, name: string) {
  return fetchDeckJson<DeckGoAgentFileResponse>(
    `/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(name)}`,
    undefined,
    "agent file fetch failed",
  );
}

export async function fetchAgentFiles(agentId: string) {
  return fetchDeckJson<DeckGoAgentFilesResponse>(
    `/agents/${encodeURIComponent(agentId)}/files`,
    undefined,
    "agent files fetch failed",
  );
}

export async function fetchAgentIdentity(agentId: string) {
  return fetchDeckJson<DeckGoAgentIdentityResponse>(
    `/agents/${encodeURIComponent(agentId)}/identity`,
    undefined,
    "agent identity fetch failed",
  );
}

export async function saveAgentFile(agentId: string, name: string, content: string) {
  return fetchDeckJson<DeckGoAgentFileResponse>(
    `/agents/${encodeURIComponent(agentId)}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    },
    "agent file save failed",
  );
}

export async function fetchToolsCatalog(agentId: string) {
  return fetchDeckJson<DeckGoToolsCatalogResponse>(
    "/tools/catalog",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    },
    "tools catalog fetch failed",
  );
}

export async function fetchEffectiveTools(params: { agentId: string; sessionKey: string }) {
  return fetchDeckJson<DeckGoEffectiveToolsResponse>(
    "/deck/tools-effective",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "effective tools fetch failed",
  );
}

export async function createAgent(params: {
  name: string;
  workspace?: string;
  emoji?: string;
  avatar?: string;
}) {
  return fetchDeckJson<DeckGoAgentMutationResponse>(
    "/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "agent create failed",
  );
}

export async function updateAgent(
  agentId: string,
  params: { name?: string; workspace?: string; emoji?: string; avatar?: string },
) {
  return fetchDeckJson<DeckGoAgentMutationResponse>(
    `/agents/${encodeURIComponent(agentId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "agent update failed",
  );
}

export async function deleteAgent(agentId: string) {
  return fetchDeckJson<DeckGoAgentMutationResponse>(
    `/agents?agentId=${encodeURIComponent(agentId)}`,
    { method: "DELETE" },
    "agent delete failed",
  );
}

type FetchSessionsParams = {
  agentId?: string;
  search?: string;
  limit?: number;
  activeMinutes?: number;
};

function buildSessionsQuery(params?: FetchSessionsParams) {
  const search = new URLSearchParams();
  if (params?.agentId) {
    search.set("agentId", params.agentId);
  }
  if (params?.search) {
    search.set("search", params.search);
  }
  if (typeof params?.limit === "number") {
    search.set("limit", String(params.limit));
  }
  if (typeof params?.activeMinutes === "number") {
    search.set("activeMinutes", String(params.activeMinutes));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchSessions(params?: FetchSessionsParams) {
  return fetchDeckJson<DeckGoSessionsListResponse>(
    `/sessions${buildSessionsQuery(params)}`,
    undefined,
    "sessions fetch failed",
  );
}

export async function fetchSessionPreviews(keys: string[]) {
  return fetchDeckJson<DeckGoSessionsPreviewResponse>(
    "/chat/sessions/preview",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    },
    "session preview failed",
  );
}

function buildSessionQuery(params: { sessionKey: string; agentId?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params.agentId) {
    search.set("agentId", params.agentId);
  }
  if (typeof params.limit === "number") {
    search.set("limit", String(params.limit));
  }
  return search.toString();
}

export async function fetchSessionDetail(params: {
  sessionKey: string;
  agentId?: string;
  limit?: number;
}) {
  const query = buildSessionQuery(params);
  const suffix = query ? `?${query}` : "";
  return fetchDeckJson<DeckGoSessionDetailResponse>(
    `/sessions/${encodeURIComponent(params.sessionKey)}${suffix}`,
    undefined,
    "session detail failed",
  );
}

export async function fetchChatSnapshot(params: {
  sessionKey: string;
  agentId?: string;
  limit?: number;
}) {
  const query = new URLSearchParams({ sessionKey: params.sessionKey });
  const detailQuery = buildSessionQuery(params);
  if (detailQuery) {
    for (const [key, value] of new URLSearchParams(detailQuery).entries()) {
      query.set(key, value);
    }
  }
  return fetchDeckJson<DeckGoChatSnapshotResponse>(
    `/chat/snapshot?${query.toString()}`,
    undefined,
    "chat snapshot failed",
  );
}

export async function fetchChatHistory(params: { sessionKey: string; limit?: number }) {
  const query = new URLSearchParams({ sessionKey: params.sessionKey });
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  return fetchDeckJson<DeckGoChatHistoryResponse>(
    `/chat/history?${query.toString()}`,
    undefined,
    "chat history failed",
  );
}

export async function createChatSession(body: DeckGoChatSessionCreateRequest) {
  return fetchDeckJson<DeckGoSessionCreateResponse>(
    "/chat/sessions/create",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat session create failed",
  );
}

export async function sendChatMessage(body: DeckGoChatSendRequest) {
  return fetchDeckJson<DeckGoSessionSendResponse>(
    "/chat/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat send failed",
  );
}

export async function abortChatRun(body: DeckGoChatAbortRequest) {
  return fetchDeckJson<DeckGoSessionAbortResponse>(
    "/chat/abort",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat abort failed",
  );
}

export async function steerChatSession(body: DeckGoChatSteerRequest) {
  return fetchDeckJson<DeckGoChatSteerResponse>(
    "/chat/steer",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat steer failed",
  );
}

export async function resetSession(body: { sessionKey: string; reason?: "new" | "reset" }) {
  return fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions/reset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session reset failed",
  );
}

export async function clearSession(body: { sessionKey: string }) {
  return fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions/clear",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session clear failed",
  );
}

export async function deleteSession(body: { sessionKey: string; agentId?: string | null }) {
  return fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session delete failed",
  );
}

export async function patchSession(body: Record<string, unknown>) {
  return fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions/patch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session patch failed",
  );
}

export async function patchChatSession(body: Record<string, unknown>) {
  const response = await deckFetch(buildApiPath("/chat/sessions/patch"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "session patch failed"));
  }
  return response;
}

export async function compactChatSession(sessionKey: string) {
  const response = await deckFetch(buildApiPath("/chat/compact"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "chat compact failed"));
  }
  return response;
}

export async function fetchCompactionCheckpoints(sessionKey: string) {
  return fetchDeckJson<DeckGoCompactionListResponse>(
    "/chat/compaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", key: sessionKey }),
    },
    "compaction checkpoints fetch failed",
  );
}

export async function branchCompactionCheckpoint(sessionKey: string, checkpointId: string) {
  return fetchDeckJson<DeckGoCompactionActionResponse>(
    "/chat/compaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "branch", key: sessionKey, checkpointId }),
    },
    "compaction branch failed",
  );
}

export async function restoreCompactionCheckpoint(sessionKey: string, checkpointId: string) {
  return fetchDeckJson<DeckGoCompactionActionResponse>(
    "/chat/compaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", key: sessionKey, checkpointId }),
    },
    "compaction restore failed",
  );
}

export async function setSessionEventsSubscription(body: DeckGoSessionEventsRequest) {
  return fetchDeckJson<DeckGoSessionEventsResponse>(
    "/chat/session-events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session events request failed",
  );
}

export async function persistChatProjection(body: {
  sessionKey: string;
  a2uiState: A2UIState | null;
}) {
  const response = await deckFetch(buildApiPath("/chat/projection"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionKey: body.sessionKey,
      a2uiState: sanitizeA2UIState(body.a2uiState),
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "chat projection failed"));
  }
}

export async function setCanvasBridgeReady(body: { sessionKey: string; ready: boolean }) {
  const response = await deckFetch(buildApiPath("/deck/canvas"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: body.ready ? "ready" : "unready",
      sessionKey: body.sessionKey,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "canvas bridge update failed"));
  }
}

export async function resolveCanvasEval(body: { evalId: string; result: unknown }) {
  const response = await deckFetch(buildApiPath("/deck/canvas"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "resolve",
      evalId: body.evalId,
      result: body.result,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "canvas eval resolve failed"));
  }
}

export function persistAccessToken(token: string) {
  writeStoredDeckAccessToken(token);
}

function toDeckServerEvent<TEvent extends DeckGoServerEvent>(event: DeckEvent): TEvent {
  const parsedEvent: DeckGoServerEvent = {
    id: event.id,
    event: event.event,
    data: event.data,
  };
  if (event.data) {
    try {
      parsedEvent.json = JSON.parse(event.data);
    } catch {
      // keep raw string payload when data is not JSON
    }
  }
  return parsedEvent as TEvent;
}

type StreamParams<TEvent extends DeckGoServerEvent> = {
  signal: AbortSignal;
  onEvent: (event: TEvent) => void;
  retryDelayMs?: number;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "error") => void;
  initialLastEventId?: string;
};

async function streamSSE<TEvent extends DeckGoServerEvent>(
  path: string,
  params: StreamParams<TEvent>,
): Promise<void> {
  params.onStatusChange?.("connecting");
  const response = await deckStream(buildApiPath(path), {
    signal: params.signal,
    reconnect: true,
    retryDelayMs: params.retryDelayMs,
    lastEventId: params.initialLastEventId,
    onOpen: () => params.onStatusChange?.("connected"),
    onRetry: () => params.onStatusChange?.("reconnecting"),
    onEvent: (event) => params.onEvent(toDeckServerEvent<TEvent>(event)),
  });
  if (params.signal.aborted || response.status === 499) {
    return;
  }
  if (!response.ok) {
    params.onStatusChange?.("error");
    throw new Error(`stream failed: ${response.status}`);
  }
}

export async function streamEvents(params: StreamParams<DeckGoServerEvent>): Promise<void> {
  return streamSSE("/stream", params);
}

export async function streamLogEvents(params: StreamParams<DeckGoLogStreamEvent>): Promise<void> {
  return streamSSE("/logs/stream", params);
}
