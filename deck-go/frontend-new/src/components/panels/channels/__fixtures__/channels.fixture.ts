import type {
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputResponse,
  DeckGoChannelsStatusResponse,
  DeckGoRoutingListResponse,
} from "../../../../api";

export function telegramDiscordChannelsFixture(): DeckGoChannelsStatusResponse {
  return {
    ts: 1_234,
    channelOrder: ["telegram", "discord"],
    channels: {
      telegram: {
        status: "ready",
        connected: true,
        dmPolicy: "pairing",
        retry: { attempts: 3, minDelayMs: 1_000, maxDelayMs: 30_000, jitter: 0.2 },
      },
      discord: { status: "ready", connected: false },
    },
    channelAccounts: {
      telegram: [
        {
          accountId: "acct_tg_main",
          configured: true,
          connected: true,
          displayName: "Telegram Main",
          enabled: true,
          linked: true,
        },
      ],
      discord: [
        {
          accountId: "acct_disc_ops",
          configured: true,
          connected: false,
          displayName: "Discord Ops",
          enabled: true,
          linked: true,
        },
        {
          accountId: "acct_disc_bot",
          configured: false,
          connected: true,
          displayName: "Discord Bot",
          enabled: true,
          linked: true,
        },
      ],
    },
    channelDefaultAccountId: {
      telegram: "acct_tg_main",
      discord: "acct_disc_bot",
    },
    channelLabels: {
      telegram: "Telegram",
      discord: "Discord",
    },
    channelDetailLabels: {
      telegram: "Telegram Bot",
      discord: "Discord Workspace",
    },
    channelSystemImages: {
      telegram: "paperplane",
      discord: "gamepad",
    },
    channelMeta: [
      {
        id: "telegram",
        label: "Telegram",
        detailLabel: "Telegram Bot",
        systemImage: "paperplane",
        pluginId: "telegram-provider",
        pluginOrigin: "bundled",
        pluginConfigPath: "plugins.entries.telegram.config",
      },
      {
        id: "discord",
        label: "Discord",
        detailLabel: "Discord Workspace",
        systemImage: "gamepad",
        pluginId: "discord-provider",
        pluginOrigin: "local",
        pluginConfigPath: "plugins.entries.discord.config",
      },
    ],
  } as DeckGoChannelsStatusResponse;
}

export function wecomChannelsFixture(
  accounts?: Array<Record<string, unknown>>,
): DeckGoChannelsStatusResponse {
  return {
    ts: 2_345,
    channelOrder: ["wecom"],
    channels: {
      wecom: { status: "ready", connected: true },
    },
    channelAccounts: {
      wecom: accounts ?? [
        {
          accountId: "default",
          configured: true,
          connected: true,
          displayName: "Default",
          enabled: true,
          linked: true,
        },
        {
          accountId: "tenant-b",
          configured: true,
          connected: true,
          displayName: "Tenant B",
          enabled: true,
          linked: true,
        },
      ],
    },
    channelDefaultAccountId: {
      wecom: "default",
    },
    channelLabels: {
      wecom: "WeCom",
    },
    channelDetailLabels: {
      wecom: "WeCom Operations",
    },
    channelSystemImages: {
      wecom: "wecom",
    },
    channelMeta: [
      {
        id: "wecom",
        label: "WeCom",
        detailLabel: "WeCom Operations",
        systemImage: "wecom",
        pluginId: "wecom",
        pluginOrigin: "bundled",
        pluginConfigPath: "plugins.entries.wecom.config",
      },
    ],
  } as DeckGoChannelsStatusResponse;
}

export function emptyChannelsFixture(): DeckGoChannelsStatusResponse {
  return {
    channelAccounts: {},
    channelDefaultAccountId: {},
    channelLabels: {},
    channelOrder: [],
    channels: {},
    ts: 9_999,
  } as DeckGoChannelsStatusResponse;
}

export function throughputFixture(): DeckGoChannelThroughputResponse {
  return {
    buckets: [{ time: 1_234, in: 3, out: 4 }],
    messagesIn: 12,
    messagesOut: 9,
  } as DeckGoChannelThroughputResponse;
}

export function emptyThroughputFixture(): DeckGoChannelThroughputResponse {
  return {
    buckets: [],
    messagesIn: 0,
    messagesOut: 0,
  } as DeckGoChannelThroughputResponse;
}

export function routingFixture(): DeckGoRoutingListResponse {
  return {
    bindings: [
      {
        id: "wecom-default",
        agentId: "main",
        tier: "account",
        match: { channel: "wecom", accountId: "default" },
      },
    ],
    defaultAgentId: "main",
    dmScope: "account",
    configHash: "routing-h1",
  } as DeckGoRoutingListResponse;
}

export function emptyRoutingFixture(): DeckGoRoutingListResponse {
  return {
    bindings: [],
    defaultAgentId: "main",
    dmScope: "account",
    configHash: "routing-h1",
  } as DeckGoRoutingListResponse;
}

export function probeSuccessFixture(channelId = "discord"): DeckGoChannelTestResponse {
  return {
    ok: true,
    channelId,
    check: "probe",
    latencyMs: 42,
    checkedAt: 1_235,
  } as DeckGoChannelTestResponse;
}

export function probeTimeoutFixture(channelId = "discord"): DeckGoChannelTestResponse {
  return {
    ok: false,
    channelId,
    check: "probe",
    latencyMs: 5_000,
    error: "request timeout",
    checkedAt: 1_235,
  } as DeckGoChannelTestResponse;
}

export function probeFailureFixture(channelId = "discord"): DeckGoChannelTestResponse {
  return {
    ok: false,
    channelId,
    check: "probe",
    error: "auth failed",
    checkedAt: 1_235,
  } as DeckGoChannelTestResponse;
}
