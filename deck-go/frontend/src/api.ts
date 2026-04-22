import type {
  DeckGoBootstrapStatusResponse,
  DeckGoChannelsStatusResponse,
  DeckGoChatAbortRequest,
  DeckGoChatHistoryResponse,
  DeckGoChatSendRequest,
  DeckGoChatSessionCreateRequest,
  DeckGoChatSnapshotResponse,
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
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoSettings,
  DeckGoSettingsResponse,
  DeckGoSettingsSaveResponse,
} from "../../contracts/generated/ts/deck-api.generated";
import { deckFetch, deckStream, persistDeckAccessToken, type DeckEvent } from "./lib/deck-client";

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

export async function fetchBootstrapStatus() {
  return fetchDeckJson<DeckGoBootstrapStatusResponse>(
    "/bootstrap/status",
    undefined,
    "bootstrap fetch failed",
  );
}

export async function fetchRuntimeGatewayStatus() {
  return fetchDeckJson<DeckGoRuntimeGatewayActionResponse>(
    "/runtime/gateway",
    undefined,
    "runtime gateway fetch failed",
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

export async function fetchPlugins() {
  return fetchDeckJson<DeckGoPluginsListResponse>(
    "/deck/plugins",
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

export type DeckGoRoutingListResponse = {
  bindings: DeckGoRoutingBinding[];
  defaultAgentId: string;
  dmScope: string;
  configHash: string;
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

export type DeckGoConfigSnapshotResponse = {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  raw?: string | null;
  config?: unknown;
  hash?: string;
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

export type DeckGoConfigLookupChild = {
  key: string;
  path: string;
  required: boolean;
  hasChildren: boolean;
  hint?: Record<string, unknown>;
};

export type DeckGoConfigLookupResponse = {
  path: string;
  schema?: Record<string, unknown>;
  hint?: Record<string, unknown>;
  children: DeckGoConfigLookupChild[];
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

export async function fetchCronJobs() {
  return fetchDeckJson<DeckGoCronJobsResponse>("/cron", undefined, "cron jobs fetch failed");
}

export async function fetchCronStatus() {
  return fetchDeckJson<DeckGoCronStatus>("/cron/status", undefined, "cron status fetch failed");
}

export async function fetchCronRuns(jobId: string) {
  return fetchDeckJson<DeckGoCronRunsResponse>(
    `/cron/${encodeURIComponent(jobId)}/runs`,
    undefined,
    "cron runs fetch failed",
  );
}

export async function runCronJob(jobId: string) {
  return fetchDeckJson<Record<string, unknown>>(
    `/cron/${encodeURIComponent(jobId)}/run`,
    { method: "POST" },
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

export async function extractDocs(sessionKey?: string) {
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

export async function renameNode(nodeId: string, name: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", nodeId, name }),
    },
    "node rename failed",
  );
}

export async function approveNodePairing(pairingCode: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", pairingCode }),
    },
    "node pairing approve failed",
  );
}

export async function rejectNodePairing(pairingCode: string) {
  return fetchDeckJson<Record<string, unknown>>(
    "/nodes/pair",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", pairingCode }),
    },
    "node pairing reject failed",
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

export async function runMemoryDreams(
  action: "read" | "backfill" | "reset" | "resetShortTerm" | "repair" | "dedupe",
) {
  return fetchDeckJson<Record<string, unknown>>(
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
  return fetchDeckJson<DeckGoBudgetEvaluationsResponse>(
    "/usage/budget/evaluate",
    undefined,
    "budget evaluation failed",
  );
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
  baseHash?: string,
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
  baseHash?: string,
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

export async function fetchSubagentRuns(params?: { status?: string; requesterAgentId?: string }) {
  const search = new URLSearchParams();
  if (params?.status?.trim()) {
    search.set("status", params.status.trim());
  }
  if (params?.requesterAgentId?.trim()) {
    search.set("requesterAgentId", params.requesterAgentId.trim());
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

export async function fetchModelsConfig() {
  return fetchDeckJson<DeckGoModelsConfigResponse>(
    "/models/config",
    undefined,
    "models config fetch failed",
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

export async function fetchSessions() {
  return fetchDeckJson<DeckGoSessionsListResponse>("/sessions", undefined, "sessions fetch failed");
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

export function persistAccessToken(token: string) {
  persistDeckAccessToken(token);
}

function toDeckServerEvent<TEvent extends DeckGoServerEvent>(event: DeckEvent): TEvent {
  const next: DeckGoServerEvent = {
    id: event.id,
    event: event.event,
    data: event.data,
  };
  if (event.data) {
    try {
      next.json = JSON.parse(event.data);
    } catch {
      // keep raw string payload when data is not JSON
    }
  }
  return next as TEvent;
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
