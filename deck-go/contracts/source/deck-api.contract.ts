export interface DeckGoSettings {
  accessToken?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
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
  gatewayUrlConfigured: boolean;
  gatewayTokenConfigured: boolean;
}

export interface DeckGoBootstrapGatewayStatus {
  connected: boolean;
  error?: string;
  describe?: unknown;
}

export interface DeckGoBootstrapStatusResponse {
  ok: boolean;
  settings: DeckGoBootstrapSettingsStatus;
  gateway: DeckGoBootstrapGatewayStatus;
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

export interface DeckGoSessionEventsRequest {
  sessionKey: string;
  action: "subscribe" | "unsubscribe";
}

export interface DeckGoChatSnapshotResponse {
  messages: Array<Record<string, unknown>>;
  meta: Record<string, unknown> | null;
  activeApproval: Record<string, unknown> | null;
  a2uiState: unknown;
}

export interface DeckGoChatHistoryResponse {
  messages: Array<Record<string, unknown>>;
}

export interface DeckGoChannelsStatusResponse {
  ts?: number;
  channelOrder?: string[];
  channels?: Record<string, unknown>;
  channelAccounts?: Record<string, unknown>;
  channelDefaultAccountId?: Record<string, string>;
  channelLabels?: Record<string, string>;
}

export interface DeckGoPluginInventoryEntry {
  id: string;
  name?: string;
  status?: string;
  origin?: string;
  enabled?: boolean;
}

export interface DeckGoPluginsListResponse {
  scope?: string;
  plugins?: DeckGoPluginInventoryEntry[];
}

export interface DeckGoSessionsListResponse {
  sessions?: Array<Record<string, unknown>>;
}

export interface DeckGoServerEvent {
  id?: string;
  event?: string;
  data?: string;
}

export interface DeckGoLogStreamEvent {
  id?: string;
  event?: string;
  data?: string;
}

export interface DeckGoSessionsPreviewResponse {
  ts?: number;
  previews?: Array<Record<string, unknown>>;
}
