import type {
  DeckGoBundledRuntimeGatewayStatus as GeneratedDeckGoBundledRuntimeGatewayStatus,
  DeckGoBootstrapStatusResponse as GeneratedDeckGoBootstrapStatusResponse,
  DeckGoChannelLogoutResponse as GeneratedDeckGoChannelLogoutResponse,
  DeckGoChannelTestResponse as GeneratedDeckGoChannelTestResponse,
  DeckGoChannelThroughputBucket as GeneratedDeckGoChannelThroughputBucket,
  DeckGoChannelThroughputResponse as GeneratedDeckGoChannelThroughputResponse,
  DeckGoChannelsStatusResponse,
  DeckGoChatAbortRequest,
  DeckGoChatHistoryResponse,
  DeckGoChatSendRequest,
  DeckGoChatSessionCreateRequest,
  DeckGoChatSnapshotResponse,
  DeckGoChatSteerRequest,
  DeckGoChatSteerResponse,
  DeckGoConfigSchemaLookupRequest,
  DeckGoControlAuditEntry,
  DeckGoControlAuditEventsResponse,
  DeckGoControlAuditRetention,
  DeckGoGatewayBatchCall as GeneratedDeckGoGatewayBatchCall,
  DeckGoGatewayBatchError as GeneratedDeckGoGatewayBatchError,
  DeckGoGatewayBatchOptions as GeneratedDeckGoGatewayBatchOptions,
  DeckGoGatewayBatchRequest as GeneratedDeckGoGatewayBatchRequest,
  DeckGoGatewayBatchResponse as GeneratedDeckGoGatewayBatchResponse,
  DeckGoGatewayBatchResultEntry as GeneratedDeckGoGatewayBatchResultEntry,
  DeckGoGatewayDescribeEvent as GeneratedDeckGoGatewayDescribeEvent,
  DeckGoGatewayDescribeMethod as GeneratedDeckGoGatewayDescribeMethod,
  DeckGoGatewayDescribeResponse as GeneratedDeckGoGatewayDescribeResponse,
  DeckGoGatewayHealthResponse as GeneratedDeckGoGatewayHealthResponse,
  DeckGoGatewayInvokeResult as GeneratedDeckGoGatewayInvokeResult,
  DeckGoGatewayStatusResponse as GeneratedDeckGoGatewayStatusResponse,
  DeckGoLogStreamEvent,
  DeckGoPluginCapability as GeneratedDeckGoPluginCapability,
  DeckGoPluginApprovalEntry as GeneratedDeckGoPluginApprovalEntry,
  DeckGoPluginApprovalsResponse as GeneratedDeckGoPluginApprovalsResponse,
  DeckGoPluginsListResponse,
  DeckGoRemoteRuntimeGatewayStatus as GeneratedDeckGoRemoteRuntimeGatewayStatus,
  DeckGoRuntimeConfiguredModel as GeneratedDeckGoRuntimeConfiguredModel,
  DeckGoRuntimeConfiguredModelsResponse as GeneratedDeckGoRuntimeConfiguredModelsResponse,
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
  DeckGoRuntimeGatewayResponse as GeneratedDeckGoRuntimeGatewayResponse,
  DeckGoServerEvent,
  DeckGoSessionAbortResponse,
  DeckGoSessionCreateResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionEventsRequest,
  DeckGoSessionEventsResponse,
  DeckGoSessionMutationResponse,
  DeckGoSessionSendResponse,
  DeckGoSessionMeta,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoSettings,
  DeckGoSettingsConnectionResponse as GeneratedDeckGoSettingsConnectionResponse,
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
  DeckGoSettingsVersionResponse as GeneratedDeckGoSettingsVersionResponse,
} from "../../contracts/generated/ts/deck-api.generated";
import type * as DeckApi from "../../contracts/generated/ts/deck-api.generated";
export type {
  DeckGoChannelsStatusResponse,
  DeckGoChatAbortRequest,
  DeckGoChatHistoryResponse,
  DeckGoChatSendRequest,
  DeckGoChatSessionCreateRequest,
  DeckGoChatSnapshotResponse,
  DeckGoChatSteerRequest,
  DeckGoChatSteerResponse,
  DeckGoConfigSchemaLookupRequest,
  DeckGoControlAuditEntry,
  DeckGoControlAuditEventsResponse,
  DeckGoControlAuditRetention,
  DeckGoLogStreamEvent,
  DeckGoPluginsListResponse,
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
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
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
};

export type DeckGoSession = DeckGoSessionMeta;
export type { DeckGoServerEvent };
export type DeckGoBundledRuntimeGatewayStatus = GeneratedDeckGoBundledRuntimeGatewayStatus;
export type DeckGoRemoteRuntimeGatewayStatus = GeneratedDeckGoRemoteRuntimeGatewayStatus;
export type DeckGoRuntimeGatewayStatus =
  | DeckGoBundledRuntimeGatewayStatus
  | DeckGoRemoteRuntimeGatewayStatus;
export type DeckGoBootstrapStatusResponse = Omit<
  GeneratedDeckGoBootstrapStatusResponse,
  "runtime"
> & {
  runtime: DeckGoRuntimeGatewayStatus;
};
export type DeckGoRuntimeGatewayResponse = Omit<
  GeneratedDeckGoRuntimeGatewayResponse,
  "runtime"
> & {
  runtime: DeckGoRuntimeGatewayStatus;
};
export type DeckGoSettingsConnectionResponse = GeneratedDeckGoSettingsConnectionResponse;
export type DeckGoSettingsVersionResponse = GeneratedDeckGoSettingsVersionResponse;
export type DeckGoDeviceTokenSummary = DeckApi.DeckGoDeviceTokenSummary;
export type DeckGoPairedDevice = DeckApi.DeckGoPairedDevice;
export type DeckGoPendingDeviceRequest = DeckApi.DeckGoPendingDeviceRequest;
export type DeckGoDevicesResponse = DeckApi.DeckGoDevicesResponse;
export type DeckGoSelfDeviceResponse = DeckApi.DeckGoSelfDeviceResponse;
export type DeckGoDeviceTokenRotateResponse = DeckApi.DeckGoDeviceTokenRotateResponse;
export type DeckGoGatewayHealthResponse = GeneratedDeckGoGatewayHealthResponse;
export type DeckGoGatewayStatusResponse = GeneratedDeckGoGatewayStatusResponse;
export type DeckGoGatewayBatchCall = GeneratedDeckGoGatewayBatchCall;
export type DeckGoGatewayBatchOptions = GeneratedDeckGoGatewayBatchOptions;
export type DeckGoGatewayBatchRequest = GeneratedDeckGoGatewayBatchRequest;
export type DeckGoGatewayBatchError = GeneratedDeckGoGatewayBatchError;
export type DeckGoGatewayBatchResultEntry = GeneratedDeckGoGatewayBatchResultEntry;
export type DeckGoGatewayBatchResponse = GeneratedDeckGoGatewayBatchResponse;
export type DeckGoGatewayInvokeResult = GeneratedDeckGoGatewayInvokeResult;
export type DeckGoChannelLogoutResponse = GeneratedDeckGoChannelLogoutResponse;
export type DeckGoChannelTestResponse = GeneratedDeckGoChannelTestResponse;
export type DeckGoChannelThroughputBucket = GeneratedDeckGoChannelThroughputBucket;
export type DeckGoChannelThroughputResponse = GeneratedDeckGoChannelThroughputResponse;
export type DeckGoPluginCapability = GeneratedDeckGoPluginCapability;
export type DeckGoLogsTailResponse = DeckApi.DeckGoLogsTailResponse;
export type DeckGoGatewayDescribeMethod = GeneratedDeckGoGatewayDescribeMethod;
export type DeckGoGatewayDescribeEvent = GeneratedDeckGoGatewayDescribeEvent;
export type DeckGoGatewayDescribeResponse = GeneratedDeckGoGatewayDescribeResponse;
export type DeckGoPendingApproval = DeckApi.DeckGoPendingApproval;
export type DeckGoApprovalPolicyDefaults = DeckApi.DeckGoApprovalPolicyDefaults;
export type DeckGoApprovalPolicy = DeckApi.DeckGoApprovalPolicy;
export type DeckGoApprovalPolicyResponse = DeckApi.DeckGoApprovalPolicyResponse;
export type DeckGoApprovalResolutionResponse = DeckApi.DeckGoApprovalResolutionResponse;
export type DeckGoPendingApprovalsResponse = DeckApi.DeckGoPendingApprovalsResponse;
export type DeckGoPluginApprovalEntry = GeneratedDeckGoPluginApprovalEntry;
export type DeckGoPluginApprovalsResponse = GeneratedDeckGoPluginApprovalsResponse;
export type DeckGoSkillStatus = DeckApi.DeckGoSkillStatus;
export type DeckGoSkillInstallOption = DeckApi.DeckGoSkillInstallOption;
export type DeckGoSkillEntry = DeckApi.DeckGoSkillEntry;
export type DeckGoSkillsResponse = DeckApi.DeckGoSkillsResponse;
export type DeckGoSkillUpdateResponse = DeckApi.DeckGoSkillUpdateResponse;
export type DeckGoSkillInstallResponse = DeckApi.DeckGoSkillInstallResponse;
export type DeckGoSkillHubSearchResult = DeckApi.DeckGoSkillHubSearchResult;
export type DeckGoSkillHubSearchResponse = DeckApi.DeckGoSkillHubSearchResponse;
export type DeckGoSkillHubDetailResponse = DeckApi.DeckGoSkillHubDetailResponse;
export type DeckGoSkillHubBinsResponse = DeckApi.DeckGoSkillHubBinsResponse;
export type DeckGoSkillHubMutationResponse = DeckApi.DeckGoSkillHubMutationResponse;
export type DeckGoCronSchedule = DeckApi.DeckGoCronSchedule;
export type DeckGoCronJob = DeckApi.DeckGoCronJob;
export type DeckGoCronJobInput = DeckApi.DeckGoCronJobInput;
export type DeckGoCronRunEntry = DeckApi.DeckGoCronRunEntry;
export type DeckGoCronStatus = DeckApi.DeckGoCronStatus;
export type DeckGoCronJobsResponse = DeckApi.DeckGoCronJobsResponse;
export type DeckGoCronRunsResponse = DeckApi.DeckGoCronRunsResponse;
export type DeckGoCronJobsParams = DeckApi.DeckGoCronJobsParams;
export type DeckGoCronRunsParams = DeckApi.DeckGoCronRunsParams;
export type DeckGoCronRunParams = DeckApi.DeckGoCronRunParams;
export type DeckGoCronDeleteResponse = DeckApi.DeckGoCronDeleteResponse;
export type DeckGoCronRunResponse = DeckApi.DeckGoCronRunResponse;
export type DeckGoDocCategory = DeckApi.DeckGoDocCategory;
export type DeckGoDoc = DeckApi.DeckGoDoc;
export type DeckGoDocsResponse = DeckApi.DeckGoDocsResponse;
export type DeckGoDocsExtractResponse = DeckApi.DeckGoDocsExtractResponse;
export type DeckGoDocDeleteResponse = DeckApi.DeckGoDocDeleteResponse;
export type DeckGoAlertAction = DeckApi.DeckGoAlertAction;
export type DeckGoAlertRule = DeckApi.DeckGoAlertRule;
export type DeckGoAlertsResponse = DeckApi.DeckGoAlertsResponse;
export type DeckGoAlertRuleResponse = DeckApi.DeckGoAlertRuleResponse;
export type DeckGoWebhook = DeckApi.DeckGoWebhook;
export type DeckGoWebhookDelivery = DeckApi.DeckGoWebhookDelivery;
export type DeckGoWebhooksResponse = DeckApi.DeckGoWebhooksResponse;
export type DeckGoWebhookDeliveriesResponse = DeckApi.DeckGoWebhookDeliveriesResponse;
export type DeckGoWebhookTestResponse = DeckApi.DeckGoWebhookTestResponse;
export type DeckGoNodeSummary = DeckApi.DeckGoNodeSummary;
export type DeckGoPairingRequest = DeckApi.DeckGoPairingRequest;
export type DeckGoNodesResponse = DeckApi.DeckGoNodesResponse;
export type DeckGoNodePairingResponse = DeckApi.DeckGoNodePairingResponse;
export type DeckGoNodePairRequestInput = DeckApi.DeckGoNodePairRequestInput;
export type DeckGoNodePairRequestResponse = DeckApi.DeckGoNodePairRequestResponse;
export type DeckGoNodePairApproveResponse = DeckApi.DeckGoNodePairApproveResponse;
export type DeckGoNodePairRejectResponse = DeckApi.DeckGoNodePairRejectResponse;
export type DeckGoNodePairVerifyResponse = DeckApi.DeckGoNodePairVerifyResponse;
export type DeckGoNodePairingPairedNode = DeckApi.DeckGoNodePairingPairedNode;
export type DeckGoNodeRenameResponse = DeckApi.DeckGoNodeRenameResponse;
export type DeckGoNodeInvokeResponse = DeckApi.DeckGoNodeInvokeResponse;
export type DeckGoNodePendingWorkType = DeckApi.DeckGoNodePendingWorkType;
export type DeckGoNodePendingWorkPriority = DeckApi.DeckGoNodePendingWorkPriority;
export type DeckGoNodePendingWorkItemPriority = DeckApi.DeckGoNodePendingWorkItemPriority;
export type DeckGoNodePendingWorkItem = DeckApi.DeckGoNodePendingWorkItem;
export type DeckGoNodePendingEnqueueResponse = DeckApi.DeckGoNodePendingEnqueueResponse;
export type DeckGoMemoryFileNode = DeckApi.DeckGoMemoryFileNode;
export type DeckGoMemoryHealthEntry = DeckApi.DeckGoMemoryHealthEntry;
export type DeckGoMemoryBrowseResponse = DeckApi.DeckGoMemoryBrowseResponse;
export type DeckGoMemoryHealthResponse = DeckApi.DeckGoMemoryHealthResponse;
export type DeckGoMemorySearchScope = DeckApi.DeckGoMemorySearchScope;
export type DeckGoMemorySearchResult = DeckApi.DeckGoMemorySearchResult;
export type DeckGoMemorySearchResponse = DeckApi.DeckGoMemorySearchResponse;
export type DeckGoMemoryDreamAction = DeckApi.DeckGoMemoryDreamAction;
export type DeckGoMemoryDreamDiaryResult = DeckApi.DeckGoMemoryDreamDiaryResult;
export type DeckGoMemoryDreamActionResult = DeckApi.DeckGoMemoryDreamActionResult;
export type DeckGoMemoryDreamsResult = DeckApi.DeckGoMemoryDreamsResult;
export type DeckGoBudgetDimension = DeckApi.DeckGoBudgetDimension;
export type DeckGoBudgetStatus = DeckApi.DeckGoBudgetStatus;
export type DeckGoBudgetRule = DeckApi.DeckGoBudgetRule;
export type DeckGoBudgetEvaluation = DeckApi.DeckGoBudgetEvaluation;
export type DeckGoBudgetRulesResponse = DeckApi.DeckGoBudgetRulesResponse;
export type DeckGoBudgetEvaluationsResponse = DeckApi.DeckGoBudgetEvaluationsResponse;
export type DeckGoIdentityPeer = DeckApi.DeckGoIdentityPeer;
export type DeckGoIdentityLink = DeckApi.DeckGoIdentityLink;
export type DeckGoIdentityLinksResponse = DeckApi.DeckGoIdentityLinksResponse;
export type DeckGoIdentityMutationResponse = DeckApi.DeckGoIdentityMutationResponse;
export type DeckGoThreadEntry = DeckApi.DeckGoThreadEntry;
export type DeckGoThreadsResponse = DeckApi.DeckGoThreadsResponse;
export type DeckGoRoutingPeer = DeckApi.DeckGoRoutingPeer;
export type DeckGoRoutingMatch = DeckApi.DeckGoRoutingMatch;
export type DeckGoRoutingBinding = DeckApi.DeckGoRoutingBinding;
export type DeckGoRoutingConflict = DeckApi.DeckGoRoutingConflict;
export type DeckGoRoutingListResponse = DeckApi.DeckGoRoutingListResponse;
export type DeckGoRoutingAddResponse = DeckApi.DeckGoRoutingAddResponse;
export type DeckGoRoutingRemoveResponse = DeckApi.DeckGoRoutingRemoveResponse;
export type DeckGoRoutingValidateResponse = DeckApi.DeckGoRoutingValidateResponse;
export type DeckGoRoutingSimulationTier = DeckApi.DeckGoRoutingSimulationTier;
export type DeckGoRoutingSimulateResponse = DeckApi.DeckGoRoutingSimulateResponse;
export type DeckGoSubagentRun = DeckApi.DeckGoSubagentRun;
export type DeckGoSubagentsListResponse = DeckApi.DeckGoSubagentsListResponse;
export type DeckGoSubagentLineageRoot = DeckApi.DeckGoSubagentLineageRoot;
export type DeckGoSubagentLineageNode = DeckApi.DeckGoSubagentLineageNode;
export type DeckGoSubagentsLineageResponse = DeckApi.DeckGoSubagentsLineageResponse;
export type DeckGoSubagentKillResponse = DeckApi.DeckGoSubagentKillResponse;
export type DeckGoSubagentSteerResponse = DeckApi.DeckGoSubagentSteerResponse;
export type DeckGoActivityEvent = DeckApi.DeckGoActivityEvent;
export type DeckGoActivityResponse = DeckApi.DeckGoActivityResponse;
export type DeckGoMonitorRunStatus = DeckApi.DeckGoMonitorRunStatus;
export type DeckGoMonitorRun = DeckApi.DeckGoMonitorRun;
export type DeckGoMonitorRunsResponse = DeckApi.DeckGoMonitorRunsResponse;
export type DeckGoMonitorTopAgent = DeckApi.DeckGoMonitorTopAgent;
export type DeckGoMonitorStatsResponse = DeckApi.DeckGoMonitorStatsResponse;
export type DeckGoMonitorRunEvent = DeckApi.DeckGoMonitorRunEvent;
export type DeckGoMonitorRunSummary = DeckApi.DeckGoMonitorRunSummary;
export type DeckGoMonitorRunDetailResponse = DeckApi.DeckGoMonitorRunDetailResponse;
export type DeckGoUsageCostEntry = DeckApi.DeckGoUsageCostEntry;
export type DeckGoUsageCostResponse = DeckApi.DeckGoUsageCostResponse;
export type DeckGoUsageTotals = DeckApi.DeckGoUsageTotals;
export type DeckGoContextWeightReport = DeckApi.DeckGoContextWeightReport;
export type DeckGoUsageSessionEntry = DeckApi.DeckGoUsageSessionEntry;
export type DeckGoUsageAggregateEntry = DeckApi.DeckGoUsageAggregateEntry;
export type DeckGoUsageMessageCounts = DeckApi.DeckGoUsageMessageCounts;
export type DeckGoUsageToolSummary = DeckApi.DeckGoUsageToolSummary;
export type DeckGoUsageLatencyStats = DeckApi.DeckGoUsageLatencyStats;
export type DeckGoUsageDailyAggregate = DeckApi.DeckGoUsageDailyAggregate;
export type DeckGoUsageDailyModelAggregate = DeckApi.DeckGoUsageDailyModelAggregate;
export type DeckGoUsageSessionsResponse = DeckApi.DeckGoUsageSessionsResponse;
export type DeckGoUsageSessionLogEntry = DeckApi.DeckGoUsageSessionLogEntry;
export type DeckGoUsageSessionLogsResponse = DeckApi.DeckGoUsageSessionLogsResponse;
export type DeckGoUsageTimePoint = DeckApi.DeckGoUsageTimePoint;
export type DeckGoUsageTimeseriesResponse = DeckApi.DeckGoUsageTimeseriesResponse;
export type DeckGoUsageProviderWindow = DeckApi.DeckGoUsageProviderWindow;
export type DeckGoUsageProviderStatus = DeckApi.DeckGoUsageProviderStatus;
export type DeckGoUsageProvidersResponse = DeckApi.DeckGoUsageProvidersResponse;
export type DeckGoCompactionCheckpoint = DeckApi.DeckGoCompactionCheckpoint;
export type DeckGoCompactionListResponse = DeckApi.DeckGoCompactionListResponse;
export type DeckGoCompactionActionResponse = DeckApi.DeckGoCompactionActionResponse;
export type DeckGoConfigSnapshotResponse = DeckApi.DeckGoConfigSnapshotResponse;
export type DeckGoConfigApplyResponse = DeckApi.DeckGoConfigApplyResponse;
export type DeckGoModelsConfigResponse = DeckApi.DeckGoModelsConfigResponse;
export type DeckGoRuntimeConfiguredModel = GeneratedDeckGoRuntimeConfiguredModel;
export type DeckGoRuntimeConfiguredModelsResponse = GeneratedDeckGoRuntimeConfiguredModelsResponse;
export type DeckGoModelAuthProvider = DeckApi.DeckGoModelAuthProvider;
export type DeckGoModelAuthOverviewResponse = DeckApi.DeckGoModelAuthOverviewResponse;
export type DeckGoCatalogProvider = DeckApi.DeckGoCatalogProvider;
export type DeckGoModelCatalogProvidersResponse = DeckApi.DeckGoModelCatalogProvidersResponse;
export type DeckGoModelProbeResponse = DeckApi.DeckGoModelProbeResponse;
export type DeckGoConfigLookupChild = DeckApi.DeckGoConfigLookupChild;
export type DeckGoConfigLookupResponse = DeckApi.DeckGoConfigLookupResponse;
export type DeckGoAgentStatus = DeckApi.DeckGoAgentStatus;
export type DeckGoAgentSummary = DeckApi.DeckGoAgentSummary;
export type DeckGoAgentsListResponse = DeckApi.DeckGoAgentsListResponse;
export type DeckGoAgentDetailResponse = DeckApi.DeckGoAgentDetailResponse;
export type DeckGoAgentMutationResponse = DeckApi.DeckGoAgentMutationResponse;
export type DeckGoAgentHealthSnapshot = DeckApi.DeckGoAgentHealthSnapshot;
export type DeckGoAgentRawConfig = DeckApi.DeckGoAgentRawConfig;
export type DeckGoAgentIdentityResponse = DeckApi.DeckGoAgentIdentityResponse;
export type DeckGoAgentEventStreamsResponse = DeckApi.DeckGoAgentEventStreamsResponse;
export type DeckGoAgentEventStreamsSetResponse = DeckApi.DeckGoAgentEventStreamsSetResponse;
export type DeckGoAgentSkillEntry = DeckApi.DeckGoAgentSkillEntry;
export type DeckGoAgentSkillsResponse = DeckApi.DeckGoAgentSkillsResponse;
export type DeckGoAgentSkillsSetResponse = DeckApi.DeckGoAgentSkillsSetResponse;
export type DeckGoAgentSubagentConfigResponse = DeckApi.DeckGoAgentSubagentConfigResponse;
export type DeckGoAgentSubagentPermissionOption = DeckApi.DeckGoAgentSubagentPermissionOption;
export type DeckGoAgentSubagentConfigSetResponse = DeckApi.DeckGoAgentSubagentConfigSetResponse;
export type DeckGoAgentToolPolicyPreviewResponse = DeckApi.DeckGoAgentToolPolicyPreviewResponse;
export type DeckGoAgentSystemPromptPreviewResponse = DeckApi.DeckGoAgentSystemPromptPreviewResponse;
export type DeckGoAgentFile = DeckApi.DeckGoAgentFile;
export type DeckGoAgentFileResponse = DeckApi.DeckGoAgentFileResponse;
export type DeckGoAgentFilesResponse = DeckApi.DeckGoAgentFilesResponse;
export type DeckGoAgentCreateRequest = DeckApi.DeckGoAgentCreateRequest;
export type DeckGoAgentPatchRequest = DeckApi.DeckGoAgentPatchRequest;
export type DeckGoAgentStatusChangedStreamEvent = DeckApi.DeckGoAgentStatusChangedStreamEvent;
export type DeckGoToolCatalogEntry = DeckApi.DeckGoToolCatalogEntry;
export type DeckGoToolCatalogGroup = DeckApi.DeckGoToolCatalogGroup;
export type DeckGoToolsCatalogResponse = DeckApi.DeckGoToolsCatalogResponse;
export type DeckGoEffectiveTool = DeckApi.DeckGoEffectiveTool;
export type DeckGoEffectiveToolGroup = DeckApi.DeckGoEffectiveToolGroup;
export type DeckGoEffectiveToolsResponse = DeckApi.DeckGoEffectiveToolsResponse;
