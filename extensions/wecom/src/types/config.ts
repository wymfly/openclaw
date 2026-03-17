export type WecomDmPolicy = "open" | "pairing" | "allowlist" | "disabled";
export type WecomBotPrimaryTransport = "ws" | "webhook";

export type WecomDmConfig = {
  policy?: WecomDmPolicy;
  allowFrom?: Array<string | number>;
};

export type WecomMediaConfig = {
  tempDir?: string;
  retentionHours?: number;
  cleanupOnStart?: boolean;
  maxBytes?: number;
};

export type WecomNetworkConfig = {
  egressProxyUrl?: string;
};

export type WecomRoutingConfig = {
  failClosedOnDefaultRoute?: boolean;
};

export type WecomBotWsConfig = {
  botId: string;
  secret: string;
};

export type WecomBotWebhookConfig = {
  token: string;
  encodingAESKey: string;
  receiveId?: string;
};

export type WecomBotConfig = {
  primaryTransport?: WecomBotPrimaryTransport;
  streamPlaceholderContent?: string;
  welcomeText?: string;
  dm?: WecomDmConfig;
  /**
   * Deprecated compatibility fields kept only while old webhook helpers are
   * being extracted into transport adapters.
   */
  aibotid?: string;
  botIds?: string[];
  ws?: WecomBotWsConfig;
  webhook?: WecomBotWebhookConfig;
};

export type WecomAgentConfig = {
  corpId: string;
  agentSecret?: string;
  /**
   * Deprecated compatibility alias for old configs.
   * New configs should use `agentSecret`.
   */
  corpSecret?: string;
  agentId?: number | string;
  token: string;
  encodingAESKey: string;
  welcomeText?: string;
  dm?: WecomDmConfig;
};

export type WecomDynamicAgentsConfig = {
  enabled?: boolean;
  dmCreateAgent?: boolean;
  groupEnabled?: boolean;
  adminUsers?: string[];
};

export type WecomAccountConfig = {
  enabled?: boolean;
  name?: string;
  bot?: WecomBotConfig;
  agent?: WecomAgentConfig;
};

export type WecomConfig = {
  enabled?: boolean;
  bot?: WecomBotConfig;
  agent?: WecomAgentConfig;
  accounts?: Record<string, WecomAccountConfig>;
  defaultAccount?: string;
  media?: WecomMediaConfig;
  network?: WecomNetworkConfig;
  routing?: WecomRoutingConfig;
  dynamicAgents?: WecomDynamicAgentsConfig;
};
