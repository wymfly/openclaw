import type {
  DeckGoBootstrapStatusResponse,
  DeckGoChannelsStatusResponse,
  DeckGoChatAbortRequest,
  DeckGoChatHistoryResponse,
  DeckGoChatSendRequest,
  DeckGoChatSessionCreateRequest,
  DeckGoChatSnapshotResponse,
  DeckGoChatSteerRequest,
  DeckGoChatSteerResponse,
  DeckGoConfigSchemaLookupRequest,
  DeckGoLogStreamEvent,
  DeckGoPluginsListResponse,
  DeckGoRuntimeGatewayActionResponse,
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
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
} from "../../contracts/generated/ts/deck-api.generated";
import { writeStoredDeckAccessToken } from "./lib/deck-auth-storage";
import { deckFetch, deckStream, type DeckEvent } from "./lib/deck-client";
import type { A2UIState } from "./stores/chat-types";

export type DeckGoSession = DeckGoSessionMeta;
export type { DeckGoServerEvent };

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
    const payload = (await res.json()) as { error?: string };
    return payload.error || fallback;
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

export type DeckGoSettingsConnectionResponse = {
  ok?: boolean;
  error?: string;
};

export type DeckGoSettingsVersionResponse = {
  deck?: string;
  gateway?: string;
  cli?: string;
};

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

export type DeckGoDeviceTokenSummary = {
  role: string;
  scopes?: string[];
  createdAtMs?: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
};

export type DeckGoPairedDevice = {
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: DeckGoDeviceTokenSummary[];
  createdAtMs?: number;
  approvedAtMs?: number;
};

export type DeckGoPendingDeviceRequest = {
  requestId: string;
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  ts: number;
};

export type DeckGoDevicesResponse = {
  pending?: DeckGoPendingDeviceRequest[];
  paired?: DeckGoPairedDevice[];
};

export type DeckGoSelfDeviceResponse = {
  deviceId?: string | null;
};

export type DeckGoDeviceTokenRotateResponse = Record<string, unknown> & {
  token?: string;
};

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
  return fetchDeckJsonNoPrompt<DeckGoBootstrapStatusResponse>(
    "/bootstrap/status",
    undefined,
    "bootstrap fetch failed",
  );
}

export async function fetchRuntimeGatewayStatus() {
  return fetchDeckJsonNoPrompt<DeckGoRuntimeGatewayActionResponse>(
    "/runtime/gateway",
    undefined,
    "runtime gateway fetch failed",
  );
}

export type DeckGoGatewayHealthResponse = Record<string, unknown> & {
  ok?: boolean;
  durationMs?: number;
  agents?: Array<{ sessions?: { count?: number } }>;
  channels?: Record<string, unknown>;
};

export type DeckGoGatewayStatusResponse = Record<string, unknown> & {
  state?: string;
  heartbeat?:
    | string
    | {
        agents?: Array<{ agentId?: string; enabled?: boolean; every?: string; everyMs?: number }>;
        defaultAgentId?: string;
      };
  sessions?: number | { count?: number };
  channels?: Record<string, unknown>;
};

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

export async function startRuntimeGateway() {
  return fetchDeckJson<DeckGoRuntimeGatewayActionResponse>(
    "/runtime/gateway/start",
    { method: "POST" },
    "runtime gateway start failed",
  );
}

export async function stopRuntimeGateway() {
  return fetchDeckJson<DeckGoRuntimeGatewayActionResponse>(
    "/runtime/gateway/stop",
    { method: "POST" },
    "runtime gateway stop failed",
  );
}

export async function restartRuntimeGateway() {
  return fetchDeckJson<DeckGoRuntimeGatewayActionResponse>(
    "/runtime/gateway/restart",
    { method: "POST" },
    "runtime gateway restart failed",
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

export type DeckGoChannelTestResponse = Record<string, unknown> & {
  ok?: boolean;
  channelId?: string;
  check?: string;
  error?: string;
  latencyMs?: number;
  checkedAt?: number;
};

export type DeckGoChannelThroughputBucket = {
  time?: number;
  in?: number;
  out?: number;
};

export type DeckGoChannelThroughputResponse = {
  buckets?: DeckGoChannelThroughputBucket[];
  messagesIn?: number;
  messagesOut?: number;
};

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

export type DeckGoPluginCapability = "channel" | "all";

export async function fetchPluginsWithCapability(capability: DeckGoPluginCapability = "channel") {
  const suffix = capability === "all" ? "?capability=all" : "";
  return fetchDeckJson<DeckGoPluginsListResponse>(
    `/deck/plugins${suffix}`,
    undefined,
    "plugins fetch failed",
  );
}

export type DeckGoLogsTailResponse = {
  cursor?: number;
  lines?: unknown[];
  reset?: boolean;
};

export type DeckGoGatewayDescribeMethod = {
  scope?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  since?: number;
};

export type DeckGoGatewayDescribeEvent = {
  payload?: Record<string, unknown>;
  since?: number;
};

export type DeckGoGatewayDescribeResponse = {
  methods?: Record<string, DeckGoGatewayDescribeMethod>;
  events?: Record<string, DeckGoGatewayDescribeEvent>;
  untyped?: string[];
};

export type DeckGoPendingApproval = {
  id: string;
  command: string;
  commandArgv?: string[];
  agentId?: string;
  sessionKey?: string;
  runId?: string;
  cwd?: string;
  createdAtMs: number;
  expiresAtMs: number;
};

export type DeckGoApprovalPolicyDefaults = {
  security?: "deny" | "allowlist" | "full";
  ask?: "off" | "on-miss" | "always";
  askFallback?: "deny" | "allowlist" | "full";
  autoAllowSkills?: boolean;
};

export type DeckGoApprovalPolicy = {
  defaults: DeckGoApprovalPolicyDefaults;
  agents: Record<string, DeckGoApprovalPolicyDefaults>;
  allowlist: string[];
};

export type DeckGoApprovalPolicyResponse = {
  hash?: string;
  file?: {
    defaults?: DeckGoApprovalPolicyDefaults;
    agents?: Record<string, DeckGoApprovalPolicyDefaults>;
    allowlist?: string[];
  };
};

export type DeckGoPendingApprovalsResponse = {
  pending?: DeckGoPendingApproval[];
};

export type DeckGoPluginApprovalEntry = {
  id: string;
  pluginId?: string;
  command?: string;
  description?: string;
  createdAtMs?: number;
  expiresAtMs?: number;
  status?: string;
  decision?: string | null;
};

export type DeckGoPluginApprovalsResponse =
  | DeckGoPluginApprovalEntry[]
  | {
      entries?: DeckGoPluginApprovalEntry[];
    };

export type DeckGoSkillStatus = "ready" | "needs-setup" | "disabled";

export type DeckGoSkillInstallOption = {
  id: string;
  label: string;
  bins: string[];
};

export type DeckGoSkillEntry = {
  key: string;
  name: string;
  status: DeckGoSkillStatus;
  source: "bundled" | "managed" | "plugin";
  enabled: boolean;
  missingRequirements?: string[];
  config?: Record<string, unknown>;
  description?: string;
  emoji?: string;
  homepage?: string;
  installOptions?: DeckGoSkillInstallOption[];
  primaryEnv?: string;
};

export type DeckGoSkillsResponse = {
  skills?: Record<string, unknown>[];
};

export type DeckGoSkillUpdateResponse = {
  ok?: boolean;
  config?: Record<string, unknown>;
};

export type DeckGoSkillHubSearchResult = {
  score?: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
};

export type DeckGoSkillHubSearchResponse = {
  results?: DeckGoSkillHubSearchResult[];
};

export type DeckGoSkillHubDetailResponse = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt?: number;
    updatedAt?: number;
  } | null;
  latestVersion?: {
    version: string;
    createdAt?: number;
    changelog?: string;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
  owner?: {
    handle?: string;
    displayName?: string;
  } | null;
};

export type DeckGoSkillHubBinsResponse = {
  bins?: string[];
};

export type DeckGoSkillHubMutationResponse = Record<string, unknown> & {
  ok?: boolean;
  message?: string;
  error?: string;
};

export type DeckGoCronSchedule = {
  kind: "at" | "every" | "cron";
  at?: string;
  everyMs?: number;
  anchorMs?: number;
  expr?: string;
  tz?: string;
  staggerMs?: number;
};

export type DeckGoCronJob = {
  id: string;
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  delivery?: unknown;
  failureAlert?: boolean;
  agentId?: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  nextRunAtMs?: number;
  updatedAtMs?: number;
  createdAtMs?: number;
};

export type DeckGoCronJobInput = {
  name: string;
  schedule: DeckGoCronSchedule;
  sessionTarget: string;
  wakeMode: string;
  payload: { kind: "systemEvent" | "agentTurn"; [key: string]: unknown };
  agentId?: string;
  description?: string;
  enabled?: boolean;
};

export type DeckGoCronRunEntry = {
  id: string;
  jobId: string;
  status: "ok" | "error" | "skipped";
  ts: number;
  runAtMs?: number;
  durationMs?: number;
  delivery?: unknown;
  error?: string;
};

export type DeckGoCronStatus = {
  running: boolean;
  jobCount?: number;
  nextRunAtMs?: number;
};

export type DeckGoCronJobsResponse = {
  jobs?: DeckGoCronJob[];
};

export type DeckGoCronRunsResponse = {
  entries?: DeckGoCronRunEntry[];
};

export type DeckGoCronJobsParams = {
  includeDisabled?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  enabled?: "all" | "enabled" | "disabled";
  sortBy?: "nextRunAtMs" | "updatedAtMs" | "name";
  sortDir?: "asc" | "desc";
};

export type DeckGoCronRunsParams = {
  limit?: number;
  offset?: number;
  statuses?: DeckGoCronRunEntry["status"][];
  sortDir?: "asc" | "desc";
};

export type DeckGoCronRunParams = {
  mode?: "due" | "force";
};

export type DeckGoDocCategory = "summary" | "plan" | "spec" | "manual" | "draft";

export type DeckGoDoc = {
  id: string;
  title: string;
  category: DeckGoDocCategory;
  content: string;
  sourceSession: string | null;
  sourceAgent: string | null;
  keywords: string[];
  language: string;
  extractedAt: string;
  updatedAt: string;
};

export type DeckGoDocsResponse = {
  docs?: DeckGoDoc[];
};

export type DeckGoDocsExtractResponse = {
  extracted?: number;
  docs?: DeckGoDoc[];
};

export type DeckGoAlertAction = "toast" | "activity" | "webhook";

export type DeckGoAlertRule = {
  id: string;
  name: string;
  entityType: string;
  condition: string;
  threshold: number;
  action: DeckGoAlertAction;
  cooldownMs: number;
  lastFiredAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeckGoAlertsResponse = {
  rules: DeckGoAlertRule[];
};

export type DeckGoAlertRuleResponse = {
  rule: DeckGoAlertRule;
};

export type DeckGoWebhook = {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  consecutiveFailures: number;
  lastFiredAt: string | null;
  lastStatus: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DeckGoWebhookDelivery = {
  id: string;
  webhookId: string;
  eventType: string;
  payload: string;
  statusCode: number | null;
  responseBody?: string | null;
  error: string | null;
  durationMs: number | null;
  attempt?: number | null;
  isRetry: boolean;
  parentDeliveryId?: string | null;
  success: boolean;
  nextRetryAt?: number | null;
  createdAt: string;
};

export type DeckGoWebhooksResponse = {
  webhooks: DeckGoWebhook[];
};

export type DeckGoWebhookDeliveriesResponse = {
  deliveries: DeckGoWebhookDelivery[];
};

export type DeckGoNodeSummary = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  pathEnv?: string;
  permissions?: Record<string, boolean>;
  connectedAtMs?: number;
  paired: boolean;
  connected: boolean;
};

export type DeckGoPairingRequest = {
  requestId: string;
  nodeId: string;
  displayName?: string;
  platform?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
};

export type DeckGoNodesResponse = {
  nodes?: DeckGoNodeSummary[];
};

export type DeckGoNodePairingResponse = {
  pending?: DeckGoPairingRequest[];
};

export type DeckGoNodePairRequestInput = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  silent?: boolean;
};

export type DeckGoNodePairRequestResponse = {
  status?: string;
  request?: DeckGoPairingRequest;
  created?: boolean;
};

export type DeckGoNodeInvokeResponse = {
  ok?: boolean;
  nodeId?: string;
  command?: string;
  payload?: unknown;
  payloadJSON?: string | null;
};

export type DeckGoNodePendingWorkType = "status.request" | "location.request";
export type DeckGoNodePendingWorkPriority = "normal" | "high";

export type DeckGoNodePendingEnqueueResponse = {
  nodeId?: string;
  revision?: number;
  queued?: Record<string, unknown>;
  wakeTriggered?: boolean;
};

export type DeckGoMemoryFileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
};

export type DeckGoMemoryHealthEntry = {
  agentId: string;
  provider: string;
  embeddingStatus: "ok" | "error" | "unknown";
  error?: string;
};

export type DeckGoMemoryBrowseResponse = {
  files?: DeckGoMemoryFileNode[];
  content?: string;
  path?: string;
};

export type DeckGoMemoryHealthResponse = {
  entries?: DeckGoMemoryHealthEntry[];
  lanceDbEnabled?: boolean;
  agentId?: string;
  provider?: string;
  embedding?: { ok?: boolean; error?: string };
  error?: string;
};

export type DeckGoMemorySearchScope = "all" | "global" | "agent";

export type DeckGoMemorySearchResult = {
  path: string;
  content: string;
  relevance: number;
  tier?: "core" | "working" | "peripheral";
  scope?: string;
  decayScore?: number;
};

export type DeckGoMemorySearchResponse = {
  results?: DeckGoMemorySearchResult[];
  unavailableReason?: string | null;
  lanceDbEnabled?: boolean;
};

export type DeckGoMemoryDreamAction =
  | "read"
  | "backfill"
  | "reset"
  | "resetShortTerm"
  | "repair"
  | "dedupe";

export type DeckGoMemoryDreamDiaryResult = {
  agentId: string;
  found: boolean;
  path: string;
  content?: string;
  updatedAtMs?: number;
};

export type DeckGoMemoryDreamActionResult = {
  agentId: string;
  action: string;
  path?: string;
  found?: boolean;
  scannedFiles?: number;
  written?: number;
  replaced?: number;
  removedEntries?: number;
  removedShortTermEntries?: number;
  changed?: boolean;
  archiveDir?: string;
  archivedDreamsDiary?: boolean;
  archivedSessionCorpus?: boolean;
  archivedSessionIngestion?: boolean;
  warnings?: string[];
  dedupedEntries?: number;
  keptEntries?: number;
};

export type DeckGoMemoryDreamsResult = DeckGoMemoryDreamDiaryResult | DeckGoMemoryDreamActionResult;

export type DeckGoBudgetDimension = "tokensIn" | "tokensOut" | "totalTokens" | "cost";
export type DeckGoBudgetStatus = "ok" | "warn" | "over";

export type DeckGoBudgetRule = {
  id: string;
  name: string;
  scope: string;
  agentId: string | null;
  taskId: string | null;
  dimension: DeckGoBudgetDimension;
  warnThreshold: number | null;
  overThreshold: number | null;
  period: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeckGoBudgetEvaluation = {
  ruleId: string;
  ruleName: string;
  status: DeckGoBudgetStatus;
  current: number;
  warnThreshold: number | null;
  overThreshold: number | null;
  dimension: DeckGoBudgetDimension;
};

export type DeckGoBudgetRulesResponse = {
  rules: DeckGoBudgetRule[];
};

export type DeckGoBudgetEvaluationsResponse = {
  evaluations: DeckGoBudgetEvaluation[];
};

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

export type DeckGoIdentityPeer = {
  channel: string;
  peerId: string;
};

export type DeckGoIdentityLink = {
  canonical: string;
  peers: DeckGoIdentityPeer[];
};

export type DeckGoIdentityLinksResponse = {
  links: DeckGoIdentityLink[];
  configHash?: string;
};

export type DeckGoThreadEntry = {
  threadId: string;
  channelId: string;
  agentId: string;
  targetSessionKey: string;
  targetKind: string;
  boundAt: number;
  lastActivityAt: number;
  accountId: string;
  boundBy: string;
  label?: string;
};

export type DeckGoThreadsResponse = {
  threads?: DeckGoThreadEntry[];
};

export type DeckGoRoutingPeer = {
  kind: "direct" | "group" | "channel";
  id: string;
};

export type DeckGoRoutingMatch = {
  channel: string;
  accountId?: string;
  peer?: DeckGoRoutingPeer;
  guildId?: string;
  roles?: string[];
  teamId?: string;
};

export type DeckGoRoutingBinding = {
  id: string;
  agentId: string;
  tier: string;
  match: DeckGoRoutingMatch;
  comment?: string;
};

export type DeckGoRoutingConflict = {
  type: string;
  bindingId: string;
  agentId: string;
  detail: string;
};

export type DeckGoRoutingListResponse = {
  bindings: DeckGoRoutingBinding[];
  defaultAgentId: string;
  dmScope: string;
  configHash: string;
};

export type DeckGoRoutingAddResponse = {
  ok: boolean;
  binding: DeckGoRoutingBinding;
  configHash: string;
  warnings: DeckGoRoutingConflict[];
};

export type DeckGoRoutingRemoveResponse = {
  ok: boolean;
  removed: DeckGoRoutingBinding;
  configHash: string;
  impact: string;
};

export type DeckGoRoutingValidateResponse = {
  ok: boolean;
  tier: string;
  conflicts: DeckGoRoutingConflict[];
};

export type DeckGoRoutingSimulationTier = {
  tier: string;
  matched: boolean;
  checked: boolean;
};

export type DeckGoRoutingSimulateResponse = {
  agentId: string;
  matchedBy: string;
  sessionKey: string;
  tiers: DeckGoRoutingSimulationTier[];
};

export type DeckGoSubagentRun = {
  runId: string;
  childSessionKey: string;
  childAgentId: string;
  childAgentName?: string;
  requesterSessionKey: string;
  requesterAgentId: string;
  requesterAgentName?: string;
  task?: string;
  label?: string;
  model?: string;
  spawnMode: string;
  depth: number;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  status: string;
  outcome?: unknown;
};

export type DeckGoSubagentsListResponse = {
  runs: DeckGoSubagentRun[];
  total: number;
};

export type DeckGoSubagentLineageRoot = {
  sessionKey: string;
  agentId: string;
  agentName?: string;
};

export type DeckGoSubagentLineageNode = {
  runId: string;
  sessionKey: string;
  agentId: string;
  agentName?: string;
  task?: string;
  depth: number;
  parentRunId: string;
  status: string;
  durationMs?: number;
};

export type DeckGoSubagentsLineageResponse = {
  root: DeckGoSubagentLineageRoot;
  nodes: DeckGoSubagentLineageNode[];
};

export type DeckGoSubagentKillResponse = {
  ok: boolean;
  runId: string;
  childSessionKey: string;
};

export type DeckGoSubagentSteerResponse = {
  success: boolean;
  dedupKey?: string;
  deduped?: boolean;
  newRunId?: string;
};

export type DeckGoActivityEvent = {
  id: string;
  timestamp: number;
  type: string;
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
};

export type DeckGoActivityResponse = {
  events: DeckGoActivityEvent[];
};

export type DeckGoMonitorRunStatus = "running" | "completed" | "error" | (string & {});

export type DeckGoMonitorRun = {
  runId: string;
  agentId: string | null;
  sessionKey: string | null;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  status: DeckGoMonitorRunStatus;
  toolCalls: number;
  modelCalls: number;
  totalTokens: number;
};

export type DeckGoMonitorRunsResponse = {
  runs: DeckGoMonitorRun[];
  nextCursor?: string | null;
};

export type DeckGoMonitorTopAgent = {
  agentId: string;
  runCount: number;
};

export type DeckGoMonitorStatsResponse = {
  totalRuns: number;
  todayRuns: number;
  avgDurationMs: number;
  topAgents: DeckGoMonitorTopAgent[];
};

export type DeckGoMonitorRunEvent = {
  id: number;
  run_id: string;
  seq: number;
  stream: string;
  data: string;
  agent_id: string | null;
  session_key: string | null;
  created_at: string;
};

export type DeckGoMonitorRunSummary = {
  toolCalls?: number;
  modelCalls?: number;
  fileOps?: number;
  subagentSpawns?: number;
  compacted?: boolean;
  totalTokens?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCacheTokens?: number;
  durationMs?: number;
  eventCount?: number;
};

export type DeckGoMonitorRunDetailResponse = {
  summary?: DeckGoMonitorRunSummary | null;
  events?: DeckGoMonitorRunEvent[];
};

export type DeckGoUsageCostEntry = {
  date: string;
  totalCost?: number;
  cost?: number;
};

export type DeckGoUsageCostResponse = {
  updatedAt?: number;
  days?: number;
  daily: DeckGoUsageCostEntry[];
};

export type DeckGoUsageTotals = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  totalCost?: number;
  [key: string]: unknown;
};

export type DeckGoContextWeightReport = {
  source: "run" | "estimate";
  generatedAt: number;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  workspaceDir?: string;
  systemPrompt: {
    chars: number;
    projectContextChars: number;
    nonProjectContextChars: number;
  };
  injectedWorkspaceFiles: Array<{
    name: string;
    path: string;
    missing: boolean;
    rawChars: number;
    injectedChars: number;
    truncated: boolean;
  }>;
  skills: {
    promptChars: number;
    entries: Array<{ name: string; blockChars: number }>;
  };
  tools: {
    listChars: number;
    schemaChars: number;
    entries: Array<{
      name: string;
      summaryChars: number;
      schemaChars: number;
      propertiesCount?: number | null;
    }>;
  };
  [key: string]: unknown;
};

export type DeckGoUsageSessionEntry = {
  key: string;
  label?: string;
  sessionId?: string;
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  usage: {
    input?: number;
    output?: number;
    totalTokens?: number;
    totalCost?: number;
  } | null;
  contextWeight?: DeckGoContextWeightReport | null;
};

export type DeckGoUsageAggregateEntry = {
  agentId?: string;
  channel?: string;
  model?: string;
  provider?: string;
  totals: DeckGoUsageTotals;
};

export type DeckGoUsageMessageCounts = {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
};

export type DeckGoUsageToolSummary = {
  totalCalls: number;
  uniqueTools: number;
  tools: Array<{ name: string; count: number }>;
};

export type DeckGoUsageLatencyStats = {
  count: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
};

export type DeckGoUsageDailyAggregate = {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
  toolCalls: number;
  errors: number;
};

export type DeckGoUsageDailyModelAggregate = {
  date: string;
  provider?: string;
  model?: string;
  tokens: number;
  cost: number;
  count: number;
};

export type DeckGoUsageSessionsResponse = {
  updatedAt?: number;
  startDate?: string;
  endDate?: string;
  sessions: DeckGoUsageSessionEntry[];
  totals?: DeckGoUsageTotals;
  aggregates?: {
    byAgent?: DeckGoUsageAggregateEntry[];
    byChannel?: DeckGoUsageAggregateEntry[];
    byModel?: DeckGoUsageAggregateEntry[];
    byProvider?: DeckGoUsageAggregateEntry[];
    daily?: DeckGoUsageDailyAggregate[];
    dailyLatency?: Array<DeckGoUsageLatencyStats & { date: string }>;
    latency?: DeckGoUsageLatencyStats;
    messages?: DeckGoUsageMessageCounts;
    modelDaily?: DeckGoUsageDailyModelAggregate[];
    tools?: DeckGoUsageToolSummary;
    [key: string]: unknown;
  };
};

export type DeckGoUsageSessionLogEntry = {
  timestamp: number;
  role: string;
  content: string;
  tokens?: number;
  cost?: number;
};

export type DeckGoUsageSessionLogsResponse = {
  logs?: DeckGoUsageSessionLogEntry[];
};

export type DeckGoUsageTimePoint = {
  timestamp: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  cumulativeTokens: number;
  cumulativeCost: number;
};

export type DeckGoUsageTimeseriesResponse = {
  sessionId?: string;
  points: DeckGoUsageTimePoint[];
};

export type DeckGoUsageProviderWindow = {
  label: string;
  usedPercent: number;
  resetAt?: number;
};

export type DeckGoUsageProviderStatus = {
  provider: string;
  displayName: string;
  plan?: string;
  error?: string;
  windows: DeckGoUsageProviderWindow[];
};

export type DeckGoUsageProvidersResponse = {
  updatedAt?: number;
  providers: DeckGoUsageProviderStatus[];
};

export type DeckGoCompactionCheckpoint = {
  checkpointId: string;
  sessionKey: string;
  sessionId: string;
  createdAt: number;
  reason: "manual" | "auto-threshold" | "overflow-retry" | "timeout-retry" | (string & {});
  tokensBefore?: number;
  tokensAfter?: number;
  summary?: string;
};

export type DeckGoCompactionListResponse = {
  ok?: boolean;
  key?: string;
  checkpoints?: DeckGoCompactionCheckpoint[];
};

export type DeckGoCompactionActionResponse = Record<string, unknown> & {
  ok?: boolean;
  key?: string;
};

export type DeckGoConfigSnapshotResponse = {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  raw?: string | null;
  config?: unknown;
  hash?: string;
  baseHash?: string;
};

export type DeckGoConfigApplyResponse = {
  ok?: boolean;
  baseHash?: string;
  hash?: string;
};

export type DeckGoModelsConfigResponse = {
  raw?: string | null;
  hash?: string;
};

export type DeckGoRuntimeConfiguredModel = {
  id?: string;
  name?: string;
  model?: string;
  modelIdentifier?: string;
  provider?: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  maxTokens?: number;
  authStatus?: string;
  source?: string;
  scope?: string;
  editable?: boolean;
  [key: string]: unknown;
};

export type DeckGoRuntimeConfiguredModelsResponse = {
  runtimeId?: string;
  payload?: {
    models?: DeckGoRuntimeConfiguredModel[];
    items?: DeckGoRuntimeConfiguredModel[];
    [key: string]: unknown;
  };
  requestId?: string;
};

export type DeckGoModelAuthProvider = {
  provider: string;
  status: string;
  source?: string;
  scope?: string;
  configPresent?: boolean;
  authPresent?: boolean;
  editable?: boolean;
  auth?: { type?: string | null; source?: string; profileId?: string } | null;
  oauth?: { expiresAt?: number; remainingMs?: number; status?: string };
  cooldown?: { reason?: string; remainingMs?: number; until?: number };
  usage?: {
    plan?: string;
    windows?: Array<{ label: string; usedPercent: number; resetsInMs?: number }>;
  };
  [key: string]: unknown;
};

export type DeckGoModelAuthOverviewResponse = {
  runtimeId?: string;
  payload?: {
    providers?: DeckGoModelAuthProvider[];
    [key: string]: unknown;
  };
  providers?: DeckGoModelAuthProvider[];
  requestId?: string;
};

export type DeckGoCatalogProvider = {
  id: string;
  displayName?: string;
  modelCount?: number;
  defaultBaseUrl?: string;
  authType?: string;
  api?: string;
  models?: Array<{
    id: string;
    name?: string;
    contextWindow?: number;
    reasoning?: boolean;
    maxTokens?: number;
  }>;
  [key: string]: unknown;
};

export type DeckGoModelCatalogProvidersResponse = {
  runtimeId?: string;
  payload?: {
    providers?: DeckGoCatalogProvider[];
    [key: string]: unknown;
  };
  providers?: DeckGoCatalogProvider[];
  requestId?: string;
};

export type DeckGoModelProbeResponse = {
  runtimeId?: string;
  payload?: {
    provider?: string;
    model?: string;
    profileId?: string;
    label?: string;
    source?: string;
    mode?: string;
    status?: string;
    reasonCode?: string;
    error?: string;
    latencyMs?: number;
    [key: string]: unknown;
  };
  provider?: string;
  status?: string;
  error?: string;
  latencyMs?: number;
  requestId?: string;
};

export type DeckGoConfigLookupChild = {
  key: string;
  path: string;
  type?: string | string[];
  required: boolean;
  hasChildren: boolean;
  hint?: Record<string, unknown>;
  hintPath?: string;
};

export type DeckGoConfigLookupResponse = {
  path: string;
  schema?: Record<string, unknown>;
  hint?: Record<string, unknown>;
  children: DeckGoConfigLookupChild[];
};

export type DeckGoAgentSummary = {
  id: string;
  name?: string;
  emoji?: string;
  avatar?: string;
  workspace?: string;
  model?: string;
  [key: string]: unknown;
};

export type DeckGoAgentsListResponse = {
  agents: DeckGoAgentSummary[];
  defaultId?: string;
};

export type DeckGoAgentDetailResponse = {
  id: string;
  name?: string;
  workspace: string;
  model?: string;
  reasoningDefault?: "on" | "off" | "stream";
  fastModeDefault?: boolean;
  isDefault: boolean;
  bindingCount: number;
  sessionCount: number;
  activeSubagentCount: number;
  skillMode: string;
  effectiveSkills: string[];
  totalAvailableSkills: number;
  subagents: {
    allowAgents: string[];
    model?: string;
    effectiveMaxSpawnDepth: number;
    effectiveMaxChildrenPerAgent: number;
  };
  sandbox?: unknown;
  identityExists: boolean;
  fallbackModels?: string[];
};

export type DeckGoAgentMutationResponse = {
  ok?: boolean;
  id?: string;
};

export type DeckGoAgentHealthSnapshot = {
  agents?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type DeckGoAgentRawConfig = {
  agentId: string;
  defaults: Record<string, unknown>;
  entry: Record<string, unknown> | null;
  list: Record<string, unknown>[];
  baseHash: string | null;
};

export type DeckGoAgentIdentityResponse = {
  agentId: string;
  name?: string;
  avatar?: string;
  emoji?: string;
};

export type DeckGoAgentEventStreamsResponse = {
  agentId?: string;
  eventStreams: string[];
  isDefault?: boolean;
  configHash: string;
};

export type DeckGoAgentEventStreamsSetResponse = {
  ok?: boolean;
  agentId?: string;
  eventStreams?: string[];
  configHash?: string;
};

export type DeckGoAgentSkillEntry = {
  key: string;
  name: string;
  eligible: boolean;
  assigned: boolean;
};

export type DeckGoAgentSkillsResponse = {
  agentId?: string;
  mode: string;
  skills: string[];
  available: DeckGoAgentSkillEntry[];
  configHash: string;
};

export type DeckGoAgentSkillsSetResponse = {
  ok?: boolean;
  agentId?: string;
  mode?: string;
  skills?: string[];
  configHash?: string;
};

export type DeckGoAgentSubagentConfigResponse = {
  agentId?: string;
  allowAgents: string[];
  allowAny?: boolean;
  model?: string;
  effectiveMaxSpawnDepth?: number;
  effectiveMaxChildrenPerAgent?: number;
  effectiveThinking?: unknown;
  allowedAgents?: Array<{ id: string; name?: string }>;
  allAgents?: Array<{ id: string; name?: string }>;
  configHash: string;
};

export type DeckGoAgentSubagentConfigSetResponse = {
  ok?: boolean;
  agentId?: string;
  allowAgents?: string[];
  model?: string;
  configHash?: string;
};

export type DeckGoAgentToolPolicyPreviewResponse = {
  layers?: Array<{ label: string; ruleCount: number; effect: string }>;
  tools?: Array<{
    name: string;
    allowed: boolean;
    decisiveLayer?: string;
    trace?: Array<{ layer: string; decision: string }>;
  }>;
  configHash?: string;
};

export type DeckGoAgentSystemPromptPreviewResponse = {
  layers?: Array<{ label: string; source: string; charCount: number; fileCount: number }>;
  bootstrapFiles?: Array<{ name: string; exists: boolean; charCount: number }>;
  totalChars?: number;
  configHash?: string;
};

export type DeckGoAgentFile = {
  name: string;
  path?: string;
  missing?: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

export type DeckGoAgentFileResponse = {
  ok?: boolean;
  agentId?: string;
  workspace?: string;
  file: DeckGoAgentFile;
};

export type DeckGoAgentFilesResponse = {
  agentId?: string;
  workspace?: string;
  files: DeckGoAgentFile[];
};

export type DeckGoToolCatalogEntry = {
  id: string;
  label: string;
  description?: string;
  source?: "core" | "plugin" | "channel";
  pluginId?: string;
  channelId?: string;
  optional?: boolean;
  defaultProfiles?: string[];
};

export type DeckGoToolCatalogGroup = {
  id: string;
  label: string;
  source?: "core" | "plugin" | "channel";
  pluginId?: string;
  tools: DeckGoToolCatalogEntry[];
};

export type DeckGoToolsCatalogResponse = {
  agentId?: string;
  profiles?: Array<{ id: string; label: string }>;
  groups: DeckGoToolCatalogGroup[];
};

export type DeckGoEffectiveTool = {
  id: string;
  label?: string;
  name?: string;
  description?: string;
  source?: "core" | "plugin" | "channel";
  pluginId?: string;
  channelId?: string;
};

export type DeckGoEffectiveToolGroup = {
  id?: string;
  name?: string;
  label?: string;
  source?: "core" | "plugin" | "channel";
  tools: DeckGoEffectiveTool[];
};

export type DeckGoEffectiveToolsResponse = {
  agentId?: string;
  profile?: string;
  groups: DeckGoEffectiveToolGroup[];
};

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

export async function fetchRuntimeConfiguredModels(runtimeId = "rt_local") {
  return fetchDeckJson<DeckGoRuntimeConfiguredModelsResponse>(
    `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/models/configured`,
    undefined,
    "configured models fetch failed",
  );
}

export async function fetchRuntimeModelAuthOverview(runtimeId = "rt_local") {
  return fetchDeckJson<DeckGoModelAuthOverviewResponse>(
    `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/models/auth`,
    undefined,
    "model auth overview fetch failed",
  );
}

export async function fetchRuntimeModelCatalogProviders(runtimeId = "rt_local") {
  return fetchDeckJson<DeckGoModelCatalogProvidersResponse>(
    `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/models/catalog-providers`,
    undefined,
    "model catalog providers fetch failed",
  );
}

export async function probeRuntimeModelAuth(provider: string, runtimeId = "rt_local") {
  return fetchDeckJson<DeckGoModelProbeResponse>(
    `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/models/probe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    },
    "model auth probe failed",
  );
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

export async function fetchAgentsList() {
  return fetchDeckJson<DeckGoAgentsListResponse>("/agents", undefined, "agents fetch failed");
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
