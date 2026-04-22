export interface MockChannelAccount {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  lastError?: string;
  probe?: { ok?: boolean; error?: string; latencyMs?: number; elapsedMs?: number };
  lastProbeAt?: number | null;
}

export interface MockChannelDefinition {
  id: string;
  label: string;
  detailLabel?: string;
  systemImage?: string;
  pluginId?: string;
  pluginOrigin?: string;
  pluginNpmSpec?: string;
  pluginLocalPath?: string;
  pluginDefaultInstallChoice?: "npm" | "local";
  pluginConfigPath?: string;
  defaultAccountId?: string;
  accounts: MockChannelAccount[];
}

export interface MockPluginInventoryEntry {
  id: string;
  name: string;
  version?: string;
  origin?: string;
  status?: string;
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
  setupWizardSpec?: {
    steps: Array<Record<string, unknown>>;
    onComplete: {
      action: string;
      params?: Record<string, unknown>;
    };
  };
  locales?: Record<string, Record<string, unknown>>;
  deckActionCapabilities?: {
    login?: boolean;
    probe?: boolean;
    testMessage?: boolean;
    qrCodeAuth?: boolean;
  };
  diagnostics?: Array<{
    level: string;
    message: string;
  }>;
}

export interface MockRoutingBinding {
  id: string;
  agentId: string;
  match: {
    channel?: string;
    accountId?: string;
    [key: string]: unknown;
  };
  enabled?: boolean;
}

export function buildMockChannelAccount(
  overrides: Partial<MockChannelAccount> & Pick<MockChannelAccount, "accountId">,
): MockChannelAccount {
  return {
    name: overrides.accountId,
    enabled: true,
    configured: true,
    linked: true,
    running: true,
    connected: true,
    lastProbeAt: 1_713_398_400_000,
    ...overrides,
  };
}

export function buildMockChannel(
  overrides: Partial<MockChannelDefinition> & Pick<MockChannelDefinition, "id" | "label">,
): MockChannelDefinition {
  return {
    accounts: [],
    ...overrides,
  };
}

export function buildMockPlugin(
  overrides: Partial<MockPluginInventoryEntry> & Pick<MockPluginInventoryEntry, "id" | "name">,
): MockPluginInventoryEntry {
  return {
    origin: "bundled",
    status: "ready",
    enabled: true,
    explicitlyEnabled: true,
    activated: true,
    imported: true,
    configPath: `plugins.entries.${overrides.id}.config`,
    capabilityKinds: ["channel"],
    channelIds: [overrides.id],
    providerIds: [],
    toolNames: [],
    diagnostics: [],
    ...overrides,
  };
}

export function buildMockRoutingBinding(
  overrides: Partial<MockRoutingBinding> & Pick<MockRoutingBinding, "id" | "agentId" | "match">,
): MockRoutingBinding {
  return {
    enabled: true,
    ...overrides,
  };
}

export function buildChannelsStatusPayload(channels: MockChannelDefinition[]) {
  return {
    channelOrder: channels.map((channel) => channel.id),
    channelLabels: Object.fromEntries(channels.map((channel) => [channel.id, channel.label])),
    channelDetailLabels: Object.fromEntries(
      channels.map((channel) => [channel.id, channel.detailLabel ?? channel.label]),
    ),
    channelSystemImages: Object.fromEntries(
      channels
        .filter((channel) => Boolean(channel.systemImage))
        .map((channel) => [channel.id, channel.systemImage]),
    ),
    channelMeta: channels.map((channel) => ({
      id: channel.id,
      label: channel.label,
      detailLabel: channel.detailLabel ?? channel.label,
      systemImage: channel.systemImage,
      pluginId: channel.pluginId,
      pluginOrigin: channel.pluginOrigin,
      pluginNpmSpec: channel.pluginNpmSpec,
      pluginLocalPath: channel.pluginLocalPath,
      pluginDefaultInstallChoice: channel.pluginDefaultInstallChoice,
      pluginConfigPath: channel.pluginConfigPath,
    })),
    channels: Object.fromEntries(channels.map((channel) => [channel.id, {}])),
    channelAccounts: Object.fromEntries(
      channels.map((channel) => [
        channel.id,
        Object.fromEntries(channel.accounts.map((account) => [account.accountId, account])),
      ]),
    ),
    channelDefaultAccountId: Object.fromEntries(
      channels
        .filter((channel) => Boolean(channel.defaultAccountId))
        .map((channel) => [channel.id, channel.defaultAccountId]),
    ),
  };
}

export function buildChannelProbePayload(channels: MockChannelDefinition[]) {
  return {
    channelAccounts: Object.fromEntries(channels.map((channel) => [channel.id, channel.accounts])),
  };
}

export function buildPluginsInventoryPayload(
  plugins: MockPluginInventoryEntry[],
  scope = "channel",
) {
  return {
    scope,
    plugins: plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      origin: plugin.origin ?? "bundled",
      status: plugin.status ?? "ready",
      enabled: plugin.enabled ?? true,
      explicitlyEnabled: plugin.explicitlyEnabled ?? true,
      activated: plugin.activated ?? true,
      imported: plugin.imported ?? true,
      activationSource: plugin.activationSource,
      activationReason: plugin.activationReason,
      configPath: plugin.configPath ?? `plugins.entries.${plugin.id}.config`,
      capabilityKinds: plugin.capabilityKinds ?? ["channel"],
      channelIds: plugin.channelIds ?? [plugin.id],
      providerIds: plugin.providerIds ?? [],
      toolNames: plugin.toolNames ?? [],
      setupWizardSpec: plugin.setupWizardSpec,
      locales: plugin.locales,
      deckActionCapabilities: plugin.deckActionCapabilities,
      diagnostics: plugin.diagnostics ?? [],
    })),
  };
}

export function buildRoutingPayload(bindings: MockRoutingBinding[]) {
  return {
    bindings,
    configHash: "routing-hash",
    dmScope: "operator",
  };
}

export function buildConfigSchemaPayload(channelIds: string[]) {
  return {
    version: "test-schema-v1",
    generatedAt: "2026-04-18T00:00:00.000Z",
    schema: {
      type: "object",
      properties: {
        channels: {
          type: "object",
          properties: Object.fromEntries(
            channelIds.map((channelId) => [
              channelId,
              {
                type: "object",
                properties: {},
              },
            ]),
          ),
        },
      },
    },
    uiHints: {},
  };
}

export function buildConfigReadPayload(config: Record<string, unknown>, hash: string) {
  return {
    path: "",
    exists: true,
    valid: true,
    raw: JSON.stringify(config, null, 2),
    config,
    hash,
  };
}

export function deepMergeRecord(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const existing = next[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      next[key] = deepMergeRecord(existing, value);
      continue;
    }
    next[key] = cloneValue(value);
  }

  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
    );
  }
  return value;
}
