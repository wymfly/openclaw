export interface DeckGoManagedGatewaySettings {
  mode?: "managed";
  command?: string;
  args?: string[];
  workingDir?: string;
  bindHost?: string;
  bindPort?: number;
  gatewayToken?: string;
  autoStart?: boolean;
  env?: Record<string, string>;
}

export interface DeckGoSettings {
  accessToken?: string;
  managedGateway?: DeckGoManagedGatewaySettings;
}

export interface DeckGoSettingsResponse {
  ok: boolean;
  settings: DeckGoSettings;
  path: string;
}

export interface DeckGoSettingsSaveResponse {
  ok: boolean;
  settings: DeckGoSettings;
}

export interface DeckGoBootstrapSettingsStatus {
  path: string;
  accessTokenConfigured: boolean;
  managedGatewayConfigured: boolean;
  commandConfigured: boolean;
  gatewayTokenConfigured: boolean;
  autoStart: boolean;
}

export interface DeckGoRuntimeGatewayStatus {
  managed: boolean;
  configured?: boolean;
  status?: "stopped" | "starting" | "running" | "degraded" | "stopping" | "failed";
  failurePhase?: "preflight" | "launch" | "runtime";
  pid?: number;
  startedAt?: string;
  lastExitAt?: string;
  lastExitCode?: number;
  health?: "unknown" | "healthy" | "unhealthy";
  gatewayUrl?: string;
  lastError?: string;
  autoStart?: boolean;
}

export interface DeckGoBootstrapGatewayStatus {
  connected: boolean;
  error?: string;
  capabilitySnapshotAvailable?: boolean;
  methodCount?: number;
  eventCount?: number;
  schemaVersion?: string;
}

export interface DeckGoBootstrapStatusResponse {
  ok: boolean;
  settings: DeckGoBootstrapSettingsStatus;
  runtime: DeckGoRuntimeGatewayStatus;
  gateway: DeckGoBootstrapGatewayStatus;
}

export interface DeckGoRuntimeGatewayActionResponse {
  ok: boolean;
  runtime: DeckGoRuntimeGatewayStatus;
}

export interface DeckGoGatewayBatchCall {
  id: string;
  method: string;
  params?: unknown;
}

export interface DeckGoGatewayBatchOptions {
  failFast?: boolean;
  timeoutMs?: number;
}

export interface DeckGoGatewayBatchRequest {
  calls: DeckGoGatewayBatchCall[];
  options?: DeckGoGatewayBatchOptions;
}

export interface DeckGoGatewayBatchError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

export interface DeckGoGatewayBatchResultEntry {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: DeckGoGatewayBatchError;
}

export interface DeckGoGatewayBatchResponse {
  runtimeId: string;
  requestId: string;
  results: DeckGoGatewayBatchResultEntry[];
}

export interface DeckGoConfigSchemaLookupRequest {
  path: string;
}

export interface DeckGoChatSessionCreateRequest {
  agentId?: string;
  message?: string;
  model?: string;
  label?: string;
  parentSessionKey?: string;
}

export interface DeckGoChatSendRequest {
  sessionKey: string;
  message?: string;
  thinking?: string;
  idempotencyKey?: string;
  attachments?: Array<Record<string, unknown>>;
}

export interface DeckGoChatAbortRequest {
  sessionKey: string;
  runId?: string;
}

export interface DeckGoChatSteerRequest {
  sessionKey: string;
  message: string;
}

export interface DeckGoChatSteerResponse {
  ok?: boolean;
  runId?: string;
  status?: string;
  messageSeq?: number;
  interruptedActiveRun?: boolean;
}

export interface DeckGoSessionCreateResponse {
  ok?: boolean;
  key?: string;
  sessionId?: string;
  runId?: string;
  status?: string;
  messageSeq?: number;
  interruptedActiveRun?: boolean;
  runStarted?: boolean;
  runError?: unknown;
  entry?: Record<string, unknown>;
}

export interface DeckGoSessionSendResponse {
  runId?: string;
  status?: "started" | "in_flight";
  messageSeq?: number;
  interruptedActiveRun?: boolean;
}

export interface DeckGoSessionAbortResponse {
  ok?: boolean;
  abortedRunId?: string;
  status?: "aborted" | "no-active-run";
}

export interface DeckGoSessionMutationResponse {
  ok?: boolean;
  key?: string;
  entry?: Record<string, unknown>;
}

export interface DeckGoSessionMeta {
  key: string;
  agentId?: string;
  label?: string;
  title?: string;
  kind?: string;
  updatedAt?: number;
  lastMessagePreview?: string;
  compactionCount?: number;
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  model?: string;
  modelProvider?: string;
  thinkingLevel?: string;
  fastMode?: boolean;
  verboseLevel?: string;
  reasoningLevel?: string;
  responseUsage?: string;
  sendPolicy?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  contextTokens?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
}

export interface DeckGoSessionPreviewOverlay {
  role: "user" | "assistant" | "tool" | "system" | "other";
  text: string;
}

export interface DeckGoSessionPreviewEntry {
  key: string;
  status?: "ok" | "empty" | "missing" | "error";
  items?: DeckGoSessionPreviewOverlay[];
}

export interface DeckGoTranscriptBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  toolUseId?: string;
  content?: unknown;
  isError?: boolean;
  data?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  kind?: string;
  surface?: string;
  render?: string;
  url?: string;
  title?: string;
  preferredHeight?: number;
  summary?: Record<string, unknown>;
}

export interface DeckGoTranscriptMessage {
  id: string;
  role: string;
  content: DeckGoTranscriptBlock[];
  timestamp?: number;
  streaming?: boolean;
  error?: string;
}

export interface DeckGoSessionDetailResponse {
  session?: DeckGoSessionMeta;
  messages?: DeckGoTranscriptMessage[];
  activeApproval?: Record<string, unknown> | null;
  a2uiState?: unknown;
}

export interface DeckGoSessionMessageStreamEvent {
  sessionKey: string;
  message?: DeckGoTranscriptMessage;
  messageId?: string;
  messageSeq?: number;
  updatedAt?: number;
  status?: string;
}

export interface DeckGoSessionToolStreamEvent {
  runId: string;
  seq: number;
  stream: "tool";
  ts: number;
  sessionKey: string;
  data: Record<string, unknown>;
}

export interface DeckGoSessionsChangedStreamEvent {
  sessionKey: string;
  phase?: string;
  ts: number;
  runId?: string;
  messageId?: string;
  messageSeq?: number;
  reason?: string;
  label?: string;
  displayName?: string;
  updatedAt?: number;
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
}

export interface DeckGoSessionEventsRequest {
  sessionKey: string;
  action: "subscribe" | "unsubscribe";
}

export interface DeckGoSessionEventsResponse {
  ok: boolean;
  sessionKey: string;
  action: "subscribe" | "unsubscribe";
}

export interface DeckGoChatSnapshotResponse {
  session?: DeckGoSessionMeta;
  messages: DeckGoTranscriptMessage[];
  activeApproval: Record<string, unknown> | null;
  a2uiState: unknown;
}

export interface DeckGoChatHistoryResponse {
  messages: DeckGoTranscriptMessage[];
}

export interface DeckGoChannelUiMeta {
  id: string;
  label: string;
  detailLabel: string;
  systemImage?: string;
  pluginId?: string;
  pluginOrigin?: string;
  pluginNpmSpec?: string;
  pluginLocalPath?: string;
  pluginDefaultInstallChoice?: "npm" | "local";
  pluginConfigPath?: string;
}

export interface DeckGoChannelsStatusResponse {
  ts?: number;
  channelOrder?: string[];
  channels?: Record<string, unknown>;
  channelAccounts?: Record<string, unknown>;
  channelDefaultAccountId?: Record<string, string>;
  channelLabels?: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelSystemImages?: Record<string, string>;
  channelMeta?: DeckGoChannelUiMeta[];
}

export interface DeckGoPluginInventoryEntry {
  id: string;
  name?: string;
  version?: string;
  status?: string;
  origin?: string;
  enabled?: boolean;
  explicitlyEnabled?: boolean;
  activated?: boolean;
  imported?: boolean;
  activationSource?: string;
  activationReason?: string;
  configPath?: string;
  capabilityKinds?: string[];
  channelIds?: string[];
  providerIds?: string[];
  toolNames?: string[];
  deckActionCapabilities?: DeckGoPluginActionCapabilities;
  diagnostics?: DeckGoPluginDiagnostic[];
}

export interface DeckGoPluginActionCapabilities {
  login?: boolean;
  probe?: boolean;
  testMessage?: boolean;
  qrCodeAuth?: boolean;
}

export interface DeckGoPluginDiagnostic {
  level: string;
  message: string;
}

export interface DeckGoPluginsListResponse {
  scope?: string;
  plugins?: DeckGoPluginInventoryEntry[];
}

export interface DeckGoSessionsListResponse {
  sessions?: DeckGoSessionMeta[];
}

export interface DeckGoServerEvent {
  id?: string;
  event?: string;
  data?: string;
  json?: unknown;
}

export interface DeckGoProjectionGapEvent {
  reason: string;
}

export interface DeckGoLogStreamEvent {
  id?: string;
  event?: string;
  data?: string;
  json?: unknown;
}

export interface DeckGoSessionsPreviewResponse {
  ts?: number;
  previews?: DeckGoSessionPreviewEntry[];
}
