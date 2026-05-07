import type * as DeckApi from "../../contracts/generated/ts/deck-api.generated";
import type {
  DeckGoActivityEvent,
  DeckGoActivityResponse,
  DeckGoAgentCreateRequest,
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
  DeckGoAgentStatus,
  DeckGoAgentPatchRequest,
  DeckGoAgentSkillEntry,
  DeckGoAgentSkillsResponse,
  DeckGoAgentSkillsSetResponse,
  DeckGoAgentsListResponse,
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSubagentConfigSetResponse,
  DeckGoAgentSubagentPermissionOption,
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
  DeckGoApprovalResolutionResponse,
  DeckGoBootstrapStatusResponse,
  DeckGoBudgetDimension,
  DeckGoBudgetEvaluation,
  DeckGoBudgetEvaluationsResponse,
  DeckGoBudgetRule,
  DeckGoBudgetRulesResponse,
  DeckGoBudgetStatus,
  DeckGoBundledRuntimeGatewayStatus,
  DeckGoCatalogProvider,
  DeckGoChannelLogoutResponse,
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
  DeckGoControlAuditEventsResponse,
  DeckGoContextWeightReport,
  DeckGoCronDeleteResponse,
  DeckGoCronJob,
  DeckGoCronJobInput,
  DeckGoCronJobsParams,
  DeckGoCronJobsResponse,
  DeckGoCronRunEntry,
  DeckGoCronRunParams,
  DeckGoCronRunResponse,
  DeckGoCronRunsParams,
  DeckGoCronRunsResponse,
  DeckGoCronSchedule,
  DeckGoCronStatus,
  DeckGoDevicesResponse,
  DeckGoDeviceTokenRotateResponse,
  DeckGoDeviceTokenSummary,
  DeckGoDoc,
  DeckGoDocCategory,
  DeckGoDocDeleteResponse,
  DeckGoDocsExtractResponse,
  DeckGoDocsResponse,
  DeckGoEffectiveTool,
  DeckGoEffectiveToolGroup,
  DeckGoEffectiveToolsResponse,
  DeckGoGatewayBatchCall,
  DeckGoGatewayBatchError,
  DeckGoGatewayBatchOptions,
  DeckGoGatewayBatchRequest,
  DeckGoGatewayBatchResponse,
  DeckGoGatewayBatchResultEntry,
  DeckGoGatewayDescribeEvent,
  DeckGoGatewayDescribeMethod,
  DeckGoGatewayDescribeResponse,
  DeckGoGatewayHealthResponse,
  DeckGoGatewayInvokeResult,
  DeckGoGatewayStatusResponse,
  DeckGoIdentityLink,
  DeckGoIdentityLinksResponse,
  DeckGoIdentityMutationResponse,
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
  DeckGoNodePairApproveResponse,
  DeckGoNodePairingResponse,
  DeckGoNodePairRejectResponse,
  DeckGoNodePairRequestInput,
  DeckGoNodePairRequestResponse,
  DeckGoNodePairVerifyResponse,
  DeckGoNodePendingEnqueueResponse,
  DeckGoNodePendingWorkItem,
  DeckGoNodePendingWorkItemPriority,
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
  DeckGoNodesResponse,
  DeckGoNodeRenameResponse,
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
  DeckGoSkillInstallResponse,
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
  DeckGoWebhookTestResponse,
  DeckGoWebhooksResponse,
} from "./api-types";
export type {
  DeckGoActivityEvent,
  DeckGoActivityResponse,
  DeckGoAgentCreateRequest,
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
  DeckGoAgentStatus,
  DeckGoAgentPatchRequest,
  DeckGoAgentSkillEntry,
  DeckGoAgentSkillsResponse,
  DeckGoAgentSkillsSetResponse,
  DeckGoAgentsListResponse,
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSubagentConfigSetResponse,
  DeckGoAgentSubagentPermissionOption,
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
  DeckGoApprovalResolutionResponse,
  DeckGoBootstrapStatusResponse,
  DeckGoBudgetDimension,
  DeckGoBudgetEvaluation,
  DeckGoBudgetEvaluationsResponse,
  DeckGoBudgetRule,
  DeckGoBudgetRulesResponse,
  DeckGoBudgetStatus,
  DeckGoBundledRuntimeGatewayStatus,
  DeckGoCatalogProvider,
  DeckGoChannelLogoutResponse,
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
  DeckGoControlAuditEventsResponse,
  DeckGoContextWeightReport,
  DeckGoCronDeleteResponse,
  DeckGoCronJob,
  DeckGoCronJobInput,
  DeckGoCronJobsParams,
  DeckGoCronJobsResponse,
  DeckGoCronRunEntry,
  DeckGoCronRunParams,
  DeckGoCronRunResponse,
  DeckGoCronRunsParams,
  DeckGoCronRunsResponse,
  DeckGoCronSchedule,
  DeckGoCronStatus,
  DeckGoDevicesResponse,
  DeckGoDeviceTokenRotateResponse,
  DeckGoDeviceTokenSummary,
  DeckGoDoc,
  DeckGoDocCategory,
  DeckGoDocDeleteResponse,
  DeckGoDocsExtractResponse,
  DeckGoDocsResponse,
  DeckGoEffectiveTool,
  DeckGoEffectiveToolGroup,
  DeckGoEffectiveToolsResponse,
  DeckGoGatewayBatchCall,
  DeckGoGatewayBatchError,
  DeckGoGatewayBatchOptions,
  DeckGoGatewayBatchRequest,
  DeckGoGatewayBatchResponse,
  DeckGoGatewayBatchResultEntry,
  DeckGoGatewayDescribeEvent,
  DeckGoGatewayDescribeMethod,
  DeckGoGatewayDescribeResponse,
  DeckGoGatewayHealthResponse,
  DeckGoGatewayInvokeResult,
  DeckGoGatewayStatusResponse,
  DeckGoIdentityLink,
  DeckGoIdentityLinksResponse,
  DeckGoIdentityMutationResponse,
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
  DeckGoNodePairApproveResponse,
  DeckGoNodePairingResponse,
  DeckGoNodePairRejectResponse,
  DeckGoNodePairRequestInput,
  DeckGoNodePairRequestResponse,
  DeckGoNodePairVerifyResponse,
  DeckGoNodePendingEnqueueResponse,
  DeckGoNodePendingWorkItem,
  DeckGoNodePendingWorkItemPriority,
  DeckGoNodePendingWorkPriority,
  DeckGoNodePendingWorkType,
  DeckGoNodesResponse,
  DeckGoNodeRenameResponse,
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
  DeckGoSkillInstallResponse,
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
  DeckGoWebhookTestResponse,
  DeckGoWebhooksResponse,
} from "./api-types";
import { writeStoredDeckAccessToken } from "./lib/deck-auth-storage";
import { deckFetch, deckStream, type DeckEvent } from "./lib/deck-client";
import { createDeckGatewayClient } from "./lib/gateway-client";
import { buildListQueryString, withListQuery } from "./lib/list-query-contract";
import { acknowledgeMutationResponse } from "./lib/mutation-evidence";
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

async function acknowledgeResponseMutation(
  id: Parameters<typeof acknowledgeMutationResponse>[0],
  response: Response,
  fallbackPayload: Record<string, unknown>,
  options?: { routeParams?: Record<string, string> },
) {
  let payload: unknown = fallbackPayload;
  try {
    payload = await response.clone().json();
  } catch {
    payload = fallbackPayload;
  }
  acknowledgeMutationResponse(id, payload ?? fallbackPayload, options);
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
  return fetchDeckJson<DeckGoConfigLookupResponse>(
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
  const response = await fetchDeckJson<DeckGoChannelLogoutResponse>(
    `/channels/${encodeURIComponent(channelId)}/logout`,
    { method: "POST" },
    "channel logout failed",
  );
  return acknowledgeMutationResponse("channels.logout", response, { routeParams: { channelId } });
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
    const response = {
      ...payload,
      ok: false,
      error: payload.error || `channel test failed (${res.status})`,
    } satisfies DeckGoChannelTestResponse;
    return acknowledgeMutationResponse("channels.probe", response, { routeParams: { channelId } });
  }
  return acknowledgeMutationResponse("channels.probe", payload, { routeParams: { channelId } });
}

export async function fetchChannelThroughput(channelId: string, window = "1h") {
  return fetchDeckJson<DeckGoChannelThroughputResponse>(
    `/channels/${encodeURIComponent(channelId)}/throughput?window=${encodeURIComponent(window)}`,
    undefined,
    "channel throughput fetch failed",
  );
}

export async function patchChannelConfig(channelId: string, patch: Record<string, unknown>) {
  const response = await fetchDeckJson<DeckGoConfigApplyResponse>(
    `/channels/${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "channel config patch failed",
  );
  return acknowledgeMutationResponse("channels.config.patch", response, {
    routeParams: { channelId },
  });
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
  bindingCount?: number;
  lastActiveAtMs?: number;
  model?: {
    fallbacks?: string[];
    primary?: string;
  };
  name?: string;
  sessionCount?: number;
  status?: DeckGoAgentStatus;
  workspace?: string;
};

function normalizeGatewayAgentSummary(
  agent: TypedGatewayAgentSummary,
  defaultId?: string,
  mainKey?: string,
): DeckGoAgentSummary {
  const isMainProtected = agent.id === "main";
  const isConfiguredDefault = agent.id === defaultId;
  return {
    ...agent,
    avatar: agent.identity?.avatar ?? agent.identity?.avatarUrl,
    emoji: agent.identity?.emoji,
    isDefault: isConfiguredDefault,
    isConfiguredDefault,
    isMainProtected,
    mainKey,
    protectedReasons: isMainProtected
      ? ["main is the protected system/fallback agent and cannot be deleted"]
      : undefined,
    availableActions: {
      canEditIdentity: true,
      canEditRuntime: true,
      canDelete: !isMainProtected,
      canChangeDefault: false,
      deleteDisabledReason: isMainProtected
        ? "main is the protected system/fallback agent"
        : undefined,
      guardedEditReasons: isMainProtected
        ? ["Runtime edits affect the protected system/fallback agent"]
        : ["Runtime edits can change live agent behavior"],
      unsupportedReasons: ["Default-agent switching is read-only in this pass"],
    },
    effectiveSources: {
      workspace: "gateway",
      model: "gateway",
    },
    impact: {
      deleteRemovesFiles: false,
    },
    model: agent.model?.primary,
    name: agent.name ?? agent.identity?.name ?? agent.id,
    status: agent.status ?? "idle",
    ...(typeof agent.sessionCount === "number" && Number.isFinite(agent.sessionCount)
      ? { sessionCount: agent.sessionCount }
      : {}),
    ...(typeof agent.bindingCount === "number" && Number.isFinite(agent.bindingCount)
      ? { bindingCount: agent.bindingCount }
      : {}),
    ...(typeof agent.lastActiveAtMs === "number" && Number.isFinite(agent.lastActiveAtMs)
      ? { lastActiveAtMs: agent.lastActiveAtMs }
      : {}),
  };
}

function normalizeAgentDetailResponse(detail: DeckGoAgentDetailResponse): DeckGoAgentDetailResponse {
  const isMainProtected = detail.isMainProtected ?? detail.id === "main";
  const isConfiguredDefault = detail.isConfiguredDefault ?? detail.isDefault;
  return {
    ...detail,
    isConfiguredDefault,
    isMainProtected,
    protectedReasons:
      detail.protectedReasons ??
      (isMainProtected
        ? ["main is the protected system/fallback agent and cannot be deleted"]
        : undefined),
    availableActions:
      detail.availableActions ??
      {
        canEditIdentity: true,
        canEditRuntime: true,
        canDelete: !isMainProtected,
        canChangeDefault: false,
        deleteDisabledReason: isMainProtected
          ? "main is the protected system/fallback agent"
          : undefined,
      },
    impact: detail.impact ?? {
      bindingCount: detail.bindingCount,
      sessionCount: detail.sessionCount,
      activeSubagentCount: detail.activeSubagentCount,
      deleteRemovesFiles: false,
    },
  };
}

export async function fetchLogsTail(params?: {
  cursor?: number;
  limit?: number;
  maxBytes?: number;
}) {
  return fetchDeckJson<DeckGoLogsTailResponse>(
    withListQuery("/logs", "logs-tail", params ?? {}),
    undefined,
    "logs tail failed",
  );
}

export async function fetchGatewayDescribe() {
  return fetchDeckJson<DeckGoGatewayDescribeResponse>(
    "/gateway/describe",
    undefined,
    "gateway describe failed",
  );
}

export async function submitGatewayBatch(
  request: DeckGoGatewayBatchRequest,
  options?: { runtimeId?: string },
) {
  const runtimeId = options?.runtimeId?.trim() || "rt_local";
  return fetchDeckJson<DeckGoGatewayBatchResponse>(
    `/v1/runtimes/${encodeURIComponent(runtimeId)}/gateway/batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "gateway batch failed",
  );
}

export async function invokeGatewayMethod(
  method: string,
  params: Record<string, unknown>,
  options?: { runtimeId?: string; timeoutMs?: number },
): Promise<DeckGoGatewayInvokeResult> {
  const runtimeId = options?.runtimeId?.trim() || "rt_local";
  const response = await deckFetch(
    buildApiPath(`/v1/runtimes/${encodeURIComponent(runtimeId)}/gateway/rpc`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        params,
        ...(options?.timeoutMs != null ? { timeoutMs: options.timeoutMs } : {}),
      }),
    },
  );
  const headers = Object.fromEntries(response.headers.entries());
  let envelope: Record<string, unknown> = {};
  try {
    envelope = (await response.json()) as Record<string, unknown>;
  } catch {
    envelope = {};
  }
  const errorPayload =
    envelope.error && typeof envelope.error === "object"
      ? (envelope.error as { message?: string; code?: string })
      : null;
  const error = errorPayload?.message || errorPayload?.code;
  return {
    body: envelope.result ?? envelope.payload ?? envelope,
    error,
    headers,
    ok: response.ok && !error,
    requestId: typeof envelope.requestId === "string" ? envelope.requestId : undefined,
    statusCode: response.status,
  };
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
  const response = await fetchDeckJson<DeckGoApprovalResolutionResponse>(
    "/approvals",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    },
    "approval resolution failed",
  );
  return acknowledgeMutationResponse("approvals.exec.resolve", response, {
    routeParams: { approvalId: id },
  });
}

export async function updateApprovalsPolicy(file: DeckGoApprovalPolicy, baseHash?: string) {
  const response = await fetchDeckJson<DeckGoApprovalPolicyResponse>(
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
  return acknowledgeMutationResponse("approvals.policy.save", response);
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
  const response = await fetchDeckJson<DeckGoApprovalResolutionResponse>(
    "/approvals/plugins",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    },
    "plugin approval resolution failed",
  );
  return acknowledgeMutationResponse("approvals.plugin.resolve", response, {
    routeParams: { approvalId: id },
  });
}

export async function fetchSkills(agentId?: string) {
  const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
  return fetchDeckJson<DeckGoSkillsResponse>(`/skills${query}`, undefined, "skills fetch failed");
}

export async function updateSkill(
  skillKey: string,
  patch: { enabled?: boolean; apiKey?: string; env?: Record<string, string> },
) {
  const response = await fetchDeckJson<DeckGoSkillUpdateResponse>(
    `/skills/${encodeURIComponent(skillKey)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "skill update failed",
  );
  return acknowledgeMutationResponse("skills.update", response, { routeParams: { skillKey } });
}

export async function installSkill(name: string, installId: string) {
  const response = await fetchDeckJson<DeckGoSkillInstallResponse>(
    "/skills/install",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, installId }),
    },
    "skill install failed",
  );
  return acknowledgeMutationResponse("skills.install", response);
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
  const response = await fetchDeckJson<DeckGoSkillHubMutationResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "skill hub install failed",
  );
  return acknowledgeMutationResponse("skills.hub.install", response);
}

export async function updateSkillHub(slug?: string) {
  const body: Record<string, unknown> = { action: "update" };
  if (slug) {
    body.slug = slug;
  }
  const response = await fetchDeckJson<DeckGoSkillHubMutationResponse>(
    "/skills/hub",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "skill hub update failed",
  );
  return acknowledgeMutationResponse("skills.hub.update", response);
}

type CronJobWithGatewayState = DeckGoCronJob & {
  state?: {
    nextRunAtMs?: number | null;
  };
};

type CronJobsResponseWithGatewayState = Omit<DeckGoCronJobsResponse, "jobs"> & {
  jobs?: CronJobWithGatewayState[];
};

function normalizeCronJob(job: CronJobWithGatewayState): DeckGoCronJob {
  return {
    ...job,
    nextRunAtMs: job.nextRunAtMs ?? job.state?.nextRunAtMs ?? undefined,
  };
}

export async function fetchCronJobs(params?: DeckGoCronJobsParams) {
  const response = await fetchDeckJson<CronJobsResponseWithGatewayState>(
    withListQuery("/cron", "cron-jobs", params ?? {}),
    undefined,
    "cron jobs fetch failed",
  );
  return {
    ...response,
    jobs: response.jobs?.map(normalizeCronJob),
  };
}

export async function fetchCronStatus() {
  const raw = await fetchDeckJson<
    DeckGoCronStatus & {
      enabled?: boolean;
      jobs?: number;
      nextWakeAtMs?: number | null;
    }
  >("/cron/status", undefined, "cron status fetch failed");
  return {
    ...raw,
    running: raw.running ?? raw.enabled ?? false,
    jobCount: raw.jobCount ?? raw.jobs,
    nextRunAtMs: raw.nextRunAtMs ?? raw.nextWakeAtMs ?? undefined,
  };
}

export async function fetchCronRuns(jobId: string, params?: DeckGoCronRunsParams) {
  return fetchDeckJson<DeckGoCronRunsResponse>(
    withListQuery(`/cron/${encodeURIComponent(jobId)}/runs`, "cron-runs", params ?? {}),
    undefined,
    "cron runs fetch failed",
  );
}

export async function createCronJob(input: DeckGoCronJobInput) {
  const response = await fetchDeckJson<CronJobWithGatewayState>(
    "/cron",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "cron create failed",
  );
  const job = normalizeCronJob(response);
  return acknowledgeMutationResponse("cron.create", job);
}

export async function updateCronJob(jobId: string, input: Partial<DeckGoCronJobInput>) {
  const response = await fetchDeckJson<CronJobWithGatewayState>(
    `/cron/${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "cron update failed",
  );
  const job = normalizeCronJob(response);
  return acknowledgeMutationResponse("cron.update", job, { routeParams: { jobId } });
}

export async function runCronJob(jobId: string, params?: DeckGoCronRunParams) {
  const init: RequestInit = { method: "POST" };
  if (params?.mode) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify({ mode: params.mode });
  }
  const response = await fetchDeckJson<DeckGoCronRunResponse>(
    `/cron/${encodeURIComponent(jobId)}/run`,
    init,
    "cron run failed",
  );
  return acknowledgeMutationResponse("cron.run", response, { routeParams: { jobId } });
}

export async function deleteCronJob(jobId: string) {
  const response = await fetchDeckJson<DeckGoCronDeleteResponse>(
    `/cron/${encodeURIComponent(jobId)}`,
    { method: "DELETE" },
    "cron delete failed",
  );
  return acknowledgeMutationResponse("cron.delete", response, { routeParams: { jobId } });
}

export async function fetchDocs(params?: { category?: DeckGoDocCategory | null; query?: string }) {
  return fetchDeckJson<DeckGoDocsResponse>(
    withListQuery("/docs", "docs-list", params ?? {}),
    undefined,
    "docs fetch failed",
  );
}

export async function fetchDoc(docId: string) {
  return fetchDeckJson<DeckGoDoc>(
    `/docs/${encodeURIComponent(docId)}`,
    undefined,
    "doc fetch failed",
  );
}

export async function extractDocs(sessionKey: string) {
  const response = await fetchDeckJson<DeckGoDocsExtractResponse>(
    "/docs/extract",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    },
    "docs extract failed",
  );
  return acknowledgeMutationResponse("docs.extract", response);
}

export async function deleteDoc(docId: string) {
  const encodedDocId = encodeURIComponent(docId);
  const res = await deckFetch(buildApiPath(`/docs/${encodedDocId}`), { method: "DELETE" });
  let response: DeckGoDocDeleteResponse;
  if (res.status === 404) {
    response = { ok: true, id: docId, missing: true };
  } else if (!res.ok) {
    throw new Error(await readErrorMessage(res, "doc delete failed"));
  } else if (res.status === 204) {
    response = { ok: true, id: docId };
  } else {
    try {
      const payload = (await res.json()) as Partial<DeckGoDocDeleteResponse>;
      response = { ...payload, ok: payload.ok ?? true, id: payload.id ?? docId };
    } catch {
      response = { ok: true, id: docId };
    }
  }
  return acknowledgeMutationResponse("docs.delete", response, { routeParams: { docId } });
}

export async function fetchAlertRules() {
  return fetchDeckJson<DeckGoAlertsResponse>("/alerts", undefined, "alert rules fetch failed");
}

export async function createAlertRule(
  rule: Omit<DeckGoAlertRule, "id" | "lastFiredAt" | "createdAt" | "updatedAt">,
) {
  const response = await fetchDeckJson<DeckGoAlertRuleResponse>(
    "/alerts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    },
    "alert rule create failed",
  );
  return acknowledgeMutationResponse("alert.rule.create", response);
}

export async function updateAlertRule(id: string, patch: Partial<DeckGoAlertRule>) {
  const response = await fetchDeckJson<DeckGoAlertRuleResponse>(
    `/alerts/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "alert rule update failed",
  );
  return acknowledgeMutationResponse("alert.rule.update", response, { routeParams: { id } });
}

export async function deleteAlertRule(id: string) {
  const response = await fetchDeckJson<Record<string, unknown>>(
    `/alerts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "alert rule delete failed",
  );
  return acknowledgeMutationResponse("alert.rule.delete", response, { routeParams: { id } });
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
  const response = await fetchDeckJson<DeckGoWebhook>(
    "/webhooks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "webhook create failed",
  );
  return acknowledgeMutationResponse("webhook.create", response);
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
  const response = await fetchDeckJson<DeckGoWebhook>(
    `/webhooks/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "webhook update failed",
  );
  return acknowledgeMutationResponse("webhook.update", response, { routeParams: { id } });
}

export async function deleteWebhook(id: string) {
  const response = await fetchDeckJson<Record<string, unknown>>(
    `/webhooks/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "webhook delete failed",
  );
  return acknowledgeMutationResponse("webhook.delete", response, { routeParams: { id } });
}

export async function fetchWebhookDeliveries(id: string) {
  return fetchDeckJson<DeckGoWebhookDeliveriesResponse>(
    `/webhooks/${encodeURIComponent(id)}/deliveries`,
    undefined,
    "webhook deliveries fetch failed",
  );
}

export async function testWebhook(id: string) {
  const response = await fetchDeckJson<DeckGoWebhookTestResponse>(
    `/webhooks/${encodeURIComponent(id)}/test`,
    { method: "POST" },
    "webhook test failed",
  );
  return acknowledgeMutationResponse("webhook.test-delivery", response, { routeParams: { id } });
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
  const response = await fetchDeckJson<DeckGoNodeRenameResponse>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", nodeId, displayName }),
    },
    "node rename failed",
  );
  return acknowledgeMutationResponse("nodes.rename", response, { routeParams: { nodeId } });
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
  const response = await fetchDeckJson<DeckGoNodeInvokeResponse>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "node invoke failed",
  );
  return acknowledgeMutationResponse("nodes.invoke", response, { routeParams: { nodeId } });
}

export async function enqueueNodePendingWork(params: {
  nodeId: string;
  priority?: DeckGoNodePendingWorkPriority;
  type: DeckGoNodePendingWorkType;
  wake?: boolean;
}) {
  const response = await fetchDeckJson<DeckGoNodePendingEnqueueResponse>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pending.enqueue", ...params }),
    },
    "node pending enqueue failed",
  );
  return acknowledgeMutationResponse("nodes.pending.enqueue", response, {
    routeParams: { nodeId: params.nodeId },
  });
}

export async function approveNodePairing(requestId: string) {
  const response = await fetchDeckJson<DeckGoNodePairApproveResponse>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", requestId }),
    },
    "node pairing approve failed",
  );
  return acknowledgeMutationResponse("nodes.pair.approve", response, {
    routeParams: { requestId },
  });
}

export async function requestNodePairing(params: DeckGoNodePairRequestInput) {
  const response = await fetchDeckJson<DeckGoNodePairRequestResponse>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", ...params }),
    },
    "node pairing request failed",
  );
  return acknowledgeMutationResponse("nodes.pair.request", response);
}

export async function rejectNodePairing(requestId: string) {
  const response = await fetchDeckJson<DeckGoNodePairRejectResponse>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", requestId }),
    },
    "node pairing reject failed",
  );
  return acknowledgeMutationResponse("nodes.pair.reject", response, { routeParams: { requestId } });
}

export async function verifyNodePairing(nodeId: string, token: string) {
  const response = await fetchDeckJson<DeckGoNodePairVerifyResponse>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", nodeId, token }),
    },
    "node pairing verify failed",
  );
  return acknowledgeMutationResponse("nodes.pair.verify", response, { routeParams: { nodeId } });
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
  const body: { query: string; agentId?: string; scope?: DeckGoMemorySearchScope } = {
    query: params.query,
  };
  if (params.agentId?.trim()) {
    body.agentId = params.agentId.trim();
  }
  if (params.scope && params.scope !== "all") {
    body.scope = params.scope;
  }
  const res = await deckFetch(buildApiPath("/memory/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

export async function runMemoryDreams(action: DeckGoMemoryDreamAction, agentId?: string) {
  const body: { action: DeckGoMemoryDreamAction; agentId?: string } = { action };
  if (agentId?.trim()) {
    body.agentId = agentId.trim();
  }
  return fetchDeckJson<DeckGoMemoryDreamsResult>(
    "/memory/dreams",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  const response = await fetchDeckJson<DeckGoBudgetRule>(
    "/usage/budget",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "budget rule create failed",
  );
  return acknowledgeMutationResponse("budget.rule.create", response);
}

export async function updateBudgetRule(id: string, input: Partial<DeckGoBudgetRule>) {
  const response = await fetchDeckJson<DeckGoBudgetRule>(
    `/usage/budget/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "budget rule update failed",
  );
  return acknowledgeMutationResponse("budget.rule.update", response, { routeParams: { id } });
}

export async function deleteBudgetRule(id: string) {
  const response = await fetchDeckJson<Record<string, unknown>>(
    `/usage/budget/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "budget rule delete failed",
  );
  return acknowledgeMutationResponse("budget.rule.delete", response, { routeParams: { id } });
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
  const response = await fetchDeckJson<DeckGoIdentityMutationResponse>(
    "/deck/identity",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", canonical, channel, peerId, baseHash }),
    },
    "identity link failed",
  );
  return acknowledgeMutationResponse("identity.link", response, { routeParams: { canonical } });
}

export async function unlinkIdentityPeer(
  canonical: string,
  channel: string,
  peerId: string,
  baseHash: string,
) {
  const response = await fetchDeckJson<DeckGoIdentityMutationResponse>(
    "/deck/identity",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink", canonical, channel, peerId, baseHash }),
    },
    "identity unlink failed",
  );
  return acknowledgeMutationResponse("identity.unlink", response, { routeParams: { canonical } });
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
  const response = await fetchDeckJson<DeckGoRoutingAddResponse>(
    "/deck/routing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...params }),
    },
    "routing add failed",
  );
  return acknowledgeMutationResponse("routing.add", response);
}

export async function removeRoutingBinding(params: { id: string; baseHash: string }) {
  const response = await fetchDeckJson<DeckGoRoutingRemoveResponse>(
    "/deck/routing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", ...params }),
    },
    "routing remove failed",
  );
  return acknowledgeMutationResponse("routing.remove", response);
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

export async function patchRoutingDmScope(scope: string, baseHash: string) {
  const response = await patchDeckConfig({ session: { dmScope: scope } }, baseHash);
  return acknowledgeMutationResponse("routing.dm-scope.patch", response);
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
  const response = await fetchDeckJson<DeckGoSubagentKillResponse>(
    "/deck/subagents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "kill", runId }),
    },
    "subagent kill failed",
  );
  return acknowledgeMutationResponse("subagents.kill", response, { routeParams: { runId } });
}

export async function steerSubagentRun(runId: string, instruction: string) {
  const response = await fetchDeckJson<DeckGoSubagentSteerResponse>(
    "/deck/subagents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "steer", runId, instruction }),
    },
    "subagent steer failed",
  );
  return acknowledgeMutationResponse("subagents.steer", response, { routeParams: { runId } });
}

export async function fetchActivityEvents(limit = 100) {
  return fetchDeckJson<DeckGoActivityResponse>(
    withListQuery("/activity", "activity-events", { limit }),
    undefined,
    "activity fetch failed",
  );
}

export async function fetchControlAuditEvents(limit = 100) {
  return fetchDeckJson<DeckGoControlAuditEventsResponse>(
    withListQuery("/audit/events", "control-audit-events", { limit }),
    undefined,
    "audit history fetch failed",
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
  return fetchDeckJson<DeckGoMonitorRunsResponse>(
    withListQuery("/monitor/runs", "monitor-runs", { limit: 50, ...params }),
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
    `/usage/cost${suffix}`,
    undefined,
    "usage cost fetch failed",
  );
}

export async function fetchModelUsageProviders() {
  return fetchDeckJson<DeckGoUsageProvidersResponse>(
    "/usage/providers",
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
  return fetchDeckJson<DeckGoUsageSessionsResponse>(
    withListQuery("/usage/sessions", "usage-sessions", params ?? {}),
    undefined,
    "usage sessions fetch failed",
  );
}

export async function fetchUsageSessionLogs(params: { key: string; limit?: number }) {
  return fetchDeckJson<DeckGoUsageSessionLogsResponse>(
    withListQuery("/usage/sessions/logs", "usage-session-logs", params),
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
  const response = {
    ...responsePayload,
    runtimeId,
    payload: responsePayload,
  };
  return acknowledgeMutationResponse("models.auth.probe", response);
}

export async function saveModelsConfig(raw: string, baseHash?: string) {
  const response = await fetchDeckJson<DeckGoConfigApplyResponse>(
    "/models/config",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, baseHash }),
    },
    "models config save failed",
  );
  return acknowledgeMutationResponse("models.config.save", response);
}

export async function lookupConfigPath(path: string) {
  return postConfigSchemaLookup({ path });
}

export async function fetchAgentsList(): Promise<DeckGoAgentsListResponse> {
  const payload = await createDeckGatewayClient({ runtimeId: "rt_local" }).agents.list({});
  return {
    agents: payload.agents.map((agent) =>
      normalizeGatewayAgentSummary(agent, payload.defaultId, payload.mainKey),
    ),
    defaultId: payload.defaultId,
    mainKey: payload.mainKey,
  };
}

export async function fetchAgentDetail(agentId: string) {
  const detail = await fetchDeckJson<DeckGoAgentDetailResponse>(
    `/deck/agents?agentId=${encodeURIComponent(agentId)}`,
    undefined,
    "agent detail fetch failed",
  );
  return normalizeAgentDetailResponse(detail);
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
  const response = await fetchDeckJson<DeckGoAgentEventStreamsSetResponse>(
    "/deck/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "eventStreams.set", agentId, eventStreams, baseHash }),
    },
    "agent event streams update failed",
  );
  return acknowledgeMutationResponse("agents.eventStreams.save", response, {
    routeParams: { agentId },
  });
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
  const response = await fetchDeckJson<DeckGoAgentSkillsSetResponse>(
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
  return acknowledgeMutationResponse("agents.skills.save", response, { routeParams: { agentId } });
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

export function normalizeAgentSubagentPermissionOptions(
  response: DeckGoAgentSubagentConfigResponse,
): DeckGoAgentSubagentPermissionOption[] {
  const allowed = new Set(response.allowAgents);
  const allowAny = response.allowAny === true || allowed.has("*");
  const sourceRows: Array<{ id: string; name?: string }> =
    response.allAgents && response.allAgents.length > 0
      ? response.allAgents
      : response.allowedAgents && response.allowedAgents.length > 0
        ? response.allowedAgents
        : response.allowAgents.map((id) => ({ id }));

  return sourceRows.map((row) => ({
    id: row.id,
    name: row.name,
    allowed: allowAny || allowed.has(row.id),
  }));
}

export async function updateAgentSubagentConfig(
  agentId: string,
  params: { allowAgents: string[]; model?: string; baseHash: string },
) {
  const response = await fetchDeckJson<DeckGoAgentSubagentConfigSetResponse>(
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
  return acknowledgeMutationResponse("agents.subagents.save", response, {
    routeParams: { agentId },
  });
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
  const response = await fetchDeckJson<DeckGoAgentFileResponse>(
    `/agents/${encodeURIComponent(agentId)}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    },
    "agent file save failed",
  );
  return acknowledgeMutationResponse("agents.files.save", response, { routeParams: { agentId } });
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

export async function createAgent(params: DeckApi.DeckGoAgentCreateRequest) {
  const response = await fetchDeckJson<DeckGoAgentMutationResponse>(
    "/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "agent create failed",
  );
  return acknowledgeMutationResponse("agents.create", response);
}

export async function updateAgent(agentId: string, params: DeckApi.DeckGoAgentPatchRequest) {
  const response = await fetchDeckJson<DeckGoAgentMutationResponse>(
    `/agents/${encodeURIComponent(agentId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "agent update failed",
  );
  return acknowledgeMutationResponse("agents.update", response, { routeParams: { agentId } });
}

export async function deleteAgent(agentId: string) {
  const response = await fetchDeckJson<DeckGoAgentMutationResponse>(
    `/agents?agentId=${encodeURIComponent(agentId)}&deleteFiles=false`,
    { method: "DELETE" },
    "agent delete failed",
  );
  return acknowledgeMutationResponse("agents.delete", response, { routeParams: { agentId } });
}

type FetchSessionsParams = {
  agentId?: string;
  search?: string;
  limit?: number;
  activeMinutes?: number;
};

export async function fetchSessions(params?: FetchSessionsParams) {
  return fetchDeckJson<DeckGoSessionsListResponse>(
    withListQuery("/sessions", "sessions-list", params ?? {}),
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
  return buildListQueryString("session-detail", params);
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
  return fetchDeckJson<DeckGoChatHistoryResponse>(
    withListQuery("/chat/history", "chat-history", params),
    undefined,
    "chat history failed",
  );
}

export async function createChatSession(body: DeckGoChatSessionCreateRequest) {
  const response = await fetchDeckJson<DeckGoSessionCreateResponse>(
    "/chat/sessions/create",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat session create failed",
  );
  return acknowledgeMutationResponse("chat.session.create", response);
}

export async function sendChatMessage(body: DeckGoChatSendRequest) {
  const response = await fetchDeckJson<DeckGoSessionSendResponse>(
    "/chat/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat send failed",
  );
  return acknowledgeMutationResponse("chat.send", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
}

export async function abortChatRun(body: DeckGoChatAbortRequest) {
  const response = await fetchDeckJson<DeckGoSessionAbortResponse>(
    "/chat/abort",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat abort failed",
  );
  return acknowledgeMutationResponse("chat.abort", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
}

export async function steerChatSession(body: DeckGoChatSteerRequest) {
  const response = await fetchDeckJson<DeckGoChatSteerResponse>(
    "/chat/steer",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "chat steer failed",
  );
  return acknowledgeMutationResponse("chat.steer", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
}

export async function resetSession(body: DeckApi.DeckGoChatSessionResetRequest) {
  const response = await fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions/reset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session reset failed",
  );
  return acknowledgeMutationResponse("chat.session.reset", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
}

export async function clearSession(body: DeckApi.DeckGoChatSessionClearRequest) {
  const response = await fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions/clear",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session clear failed",
  );
  return acknowledgeMutationResponse("chat.session.clear", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
}

export async function deleteSession(body: DeckApi.DeckGoChatSessionDeleteRequest) {
  const response = await fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session delete failed",
  );
  return acknowledgeMutationResponse("chat.session.delete", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
}

export async function patchSession(body: DeckApi.DeckGoChatSessionPatchRequest) {
  const response = await fetchDeckJson<DeckGoSessionMutationResponse>(
    "/chat/sessions/patch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "session patch failed",
  );
  return acknowledgeMutationResponse("chat.session.patch", response, {
    routeParams: { sessionKey: body.sessionKey },
  });
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
  const routeParams =
    typeof body.sessionKey === "string" ? { sessionKey: body.sessionKey } : undefined;
  await acknowledgeResponseMutation(
    "chat.session.patch",
    response,
    { ok: response.ok, key: typeof body.sessionKey === "string" ? body.sessionKey : "" },
    routeParams ? { routeParams } : undefined,
  );
  return response;
}

export async function compactChatSession(sessionKey: string) {
  const body: DeckApi.DeckGoChatCompactRequest = { sessionKey };
  const response = await deckFetch(buildApiPath("/chat/compact"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "chat compact failed"));
  }
  await acknowledgeResponseMutation(
    "chat.compact",
    response,
    { ok: response.ok },
    {
      routeParams: { sessionKey },
    },
  );
  return response;
}

export async function fetchCompactionCheckpoints(sessionKey: string) {
  const body: DeckApi.DeckGoChatCompactionRequest = { action: "list", key: sessionKey };
  return fetchDeckJson<DeckGoCompactionListResponse>(
    "/chat/compaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "compaction checkpoints fetch failed",
  );
}

export async function branchCompactionCheckpoint(sessionKey: string, checkpointId: string) {
  const body: DeckApi.DeckGoChatCompactionRequest = {
    action: "branch",
    key: sessionKey,
    checkpointId,
  };
  const response = await fetchDeckJson<DeckGoCompactionActionResponse>(
    "/chat/compaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "compaction branch failed",
  );
  return acknowledgeMutationResponse("chat.compaction.branch", response, {
    routeParams: { sessionKey },
  });
}

export async function restoreCompactionCheckpoint(sessionKey: string, checkpointId: string) {
  const body: DeckApi.DeckGoChatCompactionRequest = {
    action: "restore",
    key: sessionKey,
    checkpointId,
  };
  const response = await fetchDeckJson<DeckGoCompactionActionResponse>(
    "/chat/compaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "compaction restore failed",
  );
  return acknowledgeMutationResponse("chat.compaction.restore", response, {
    routeParams: { sessionKey },
  });
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

export async function persistChatProjection(input: {
  sessionKey: string;
  a2uiState: A2UIState | null;
}) {
  const body: DeckApi.DeckGoChatProjectionRequest = {
    sessionKey: input.sessionKey,
    a2uiState: sanitizeA2UIState(input.a2uiState),
  };
  const response = await deckFetch(buildApiPath("/chat/projection"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "chat projection failed"));
  }
  await acknowledgeResponseMutation(
    "chat.projection.persist",
    response,
    { ok: response.ok },
    {
      routeParams: { sessionKey: input.sessionKey },
    },
  );
}

export async function setCanvasBridgeReady(input: { sessionKey: string; ready: boolean }) {
  const body: DeckApi.DeckGoCanvasBridgeReadyRequest = {
    action: input.ready ? "ready" : "unready",
    sessionKey: input.sessionKey,
  };
  const response = await deckFetch(buildApiPath("/deck/canvas"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "canvas bridge update failed"));
  }
}

export async function resolveCanvasEval(input: { evalId: string; result: unknown }) {
  const body: DeckApi.DeckGoCanvasBridgeEvalRequest = {
    action: "resolve",
    evalId: input.evalId,
    result: input.result,
  };
  const response = await deckFetch(buildApiPath("/deck/canvas"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
