// Contract-shaped mock data for channels prototype.
// Shapes match DeckGo* DTOs in deck-go/contracts/source/deck-api.contract.ts:
//   DeckGoChannelsStatusResponse, DeckGoChannelUiMeta,
//   DeckGoChannelTestResponse, DeckGoChannelThroughputResponse,
//   DeckGoChannelThroughputBucket, DeckGoConfigSnapshotResponse,
//   DeckGoRoutingListResponse, DeckGoRoutingBinding.
//
// Some richer fields (account diagnostics, dm policy, wecom access state)
// are BFF projections layered on top of channels.status — flagged in
// api-usage.md as "BFF projection" not raw Gateway wire frames.

window.MOCK = {
  // ── DeckGoChannelsStatusResponse ───────────────────────────────────────
  status: {
    ts: 1714680000000,
    channelOrder: ["telegram", "discord", "wecom", "slack", "qq"],
    channels: {
      telegram: { enabled: true, healthy: true, accounts: ["acct_tg_main"] },
      discord: { enabled: true, healthy: false, accounts: ["acct_disc_ops", "acct_disc_bot"] },
      wecom: {
        enabled: true,
        healthy: true,
        accounts: ["acct_wecom_tenant_a", "acct_wecom_tenant_b"],
      },
      slack: { enabled: false, healthy: true, accounts: ["acct_slack_main"] },
      qq: { enabled: true, healthy: true, accounts: [] },
    },
    channelDefaultAccountId: {
      telegram: "acct_tg_main",
      discord: "acct_disc_bot",
      wecom: "acct_wecom_tenant_a",
      slack: "acct_slack_main",
    },
    channelLabels: {
      telegram: "Telegram",
      discord: "Discord",
      wecom: "WeCom",
      slack: "Slack",
      qq: "QQ",
    },
    channelDetailLabels: {
      telegram: "Telegram Bot · production",
      discord: "Discord Workspace · ops guild",
      wecom: "WeCom Tenant · enterprise routing",
      slack: "Slack Workspace · disabled",
      qq: "QQ Bot · pending bind",
    },
    channelMeta: [
      {
        id: "telegram",
        label: "Telegram",
        detailLabel: "Telegram Bot · production",
        pluginId: "telegram-provider",
        pluginOrigin: "bundled",
      },
      {
        id: "discord",
        label: "Discord",
        detailLabel: "Discord Workspace · ops guild",
        pluginId: "discord-provider",
        pluginOrigin: "bundled",
      },
      {
        id: "wecom",
        label: "WeCom",
        detailLabel: "WeCom Tenant · enterprise routing",
        pluginId: "wecom-provider",
        pluginOrigin: "bundled",
        pluginConfigPath: "extensions/wecom-provider/config.json",
      },
      {
        id: "slack",
        label: "Slack",
        detailLabel: "Slack Workspace · disabled",
        pluginId: "slack-provider",
        pluginOrigin: "extension",
      },
      {
        id: "qq",
        label: "QQ",
        detailLabel: "QQ Bot · pending bind",
        pluginId: "qq-provider",
        pluginOrigin: "extension",
        pluginNpmSpec: "@third-party/qq-provider@^0.4",
      },
    ],
  },

  // ── BFF account diagnostics layered on channels.status ─────────────────
  accountDiagnostics: {
    acct_tg_main: {
      displayName: "Telegram Main",
      health: "ok",
      title: "Connected",
      description: "Bot session active. Receiving updates.",
      nextStep: null,
      lastConnectedMs: 1714679800000,
    },
    acct_disc_ops: {
      displayName: "Discord Ops",
      health: "warn",
      title: "Linked but disconnected",
      description: "Bot is registered but websocket gateway has been silent for 4 minutes.",
      nextStep: "Reconnect the provider account before production routing.",
      lastConnectedMs: 1714679640000,
    },
    acct_disc_bot: {
      displayName: "Discord Bot",
      health: "warn",
      title: "Configuration incomplete",
      description: "Slash command registration has not completed for guild ops-guild.",
      nextStep: "Complete required plugin config values, then re-trigger probe.",
      lastConnectedMs: 1714679400000,
    },
    acct_wecom_tenant_a: {
      displayName: "WeCom Tenant A",
      health: "ok",
      title: "Routing ready",
      description: "Token refresh on schedule. Routing bindings reconciled.",
      nextStep: null,
      lastConnectedMs: 1714679800000,
    },
    acct_wecom_tenant_b: {
      displayName: "WeCom Tenant B",
      health: "info",
      title: "Idle",
      description: "Tenant authorized but no inbound traffic in last 24h.",
      nextStep: null,
      lastConnectedMs: 1714593600000,
    },
    acct_slack_main: {
      displayName: "Slack Main",
      health: "muted",
      title: "Channel disabled",
      description: "Channel is disabled at the provider level. No accounts active.",
      nextStep: "Re-enable the channel to resume traffic.",
      lastConnectedMs: 1714248000000,
    },
  },

  // ── DeckGoChannelTestResponse (probe results, by channel id) ───────────
  probe: {
    telegram: {
      ok: true,
      channelId: "telegram",
      check: "gateway.echo",
      latencyMs: 38,
      checkedAt: 1714679800000,
    },
    discord: {
      ok: false,
      channelId: "discord",
      check: "gateway.echo",
      error: "websocket gateway timeout after 4000ms",
      latencyMs: 4000,
      checkedAt: 1714679640000,
    },
    wecom: {
      ok: true,
      channelId: "wecom",
      check: "gateway.echo",
      latencyMs: 65,
      checkedAt: 1714679800000,
    },
    slack: null, // disabled — no probe taken
    qq: {
      ok: true,
      channelId: "qq",
      check: "gateway.echo",
      latencyMs: 142,
      checkedAt: 1714679000000,
    },
  },

  // ── DeckGoChannelThroughputResponse (per channel id, 1h window) ────────
  throughput: {
    telegram: {
      messagesIn: 84,
      messagesOut: 76,
      buckets: [
        { time: 1714676400000, in: 5, out: 4 },
        { time: 1714676700000, in: 7, out: 6 },
        { time: 1714677000000, in: 9, out: 8 },
        { time: 1714677300000, in: 12, out: 11 },
        { time: 1714677600000, in: 14, out: 12 },
        { time: 1714677900000, in: 11, out: 10 },
        { time: 1714678200000, in: 9, out: 9 },
        { time: 1714678500000, in: 7, out: 7 },
        { time: 1714678800000, in: 5, out: 5 },
        { time: 1714679100000, in: 3, out: 2 },
        { time: 1714679400000, in: 1, out: 1 },
        { time: 1714679700000, in: 1, out: 1 },
      ],
    },
    discord: {
      messagesIn: 12,
      messagesOut: 9,
      buckets: [
        { time: 1714676400000, in: 4, out: 3 },
        { time: 1714676700000, in: 3, out: 2 },
        { time: 1714677000000, in: 2, out: 2 },
        { time: 1714677300000, in: 1, out: 1 },
        { time: 1714677600000, in: 1, out: 1 },
        { time: 1714677900000, in: 1, out: 0 },
        { time: 1714678200000, in: 0, out: 0 },
        { time: 1714678500000, in: 0, out: 0 },
        { time: 1714678800000, in: 0, out: 0 },
        { time: 1714679100000, in: 0, out: 0 },
        { time: 1714679400000, in: 0, out: 0 },
        { time: 1714679700000, in: 0, out: 0 },
      ],
    },
    wecom: {
      messagesIn: 158,
      messagesOut: 154,
      buckets: [
        { time: 1714676400000, in: 12, out: 11 },
        { time: 1714676700000, in: 14, out: 13 },
        { time: 1714677000000, in: 18, out: 17 },
        { time: 1714677300000, in: 22, out: 21 },
        { time: 1714677600000, in: 19, out: 18 },
        { time: 1714677900000, in: 16, out: 16 },
        { time: 1714678200000, in: 14, out: 14 },
        { time: 1714678500000, in: 12, out: 12 },
        { time: 1714678800000, in: 11, out: 11 },
        { time: 1714679100000, in: 9, out: 9 },
        { time: 1714679400000, in: 6, out: 7 },
        { time: 1714679700000, in: 5, out: 5 },
      ],
    },
    slack: { messagesIn: 0, messagesOut: 0, buckets: [] },
    qq: {
      messagesIn: 6,
      messagesOut: 4,
      buckets: [
        { time: 1714676400000, in: 1, out: 1 },
        { time: 1714676700000, in: 1, out: 0 },
        { time: 1714677000000, in: 1, out: 1 },
        { time: 1714677300000, in: 0, out: 0 },
        { time: 1714677600000, in: 1, out: 1 },
        { time: 1714677900000, in: 0, out: 0 },
        { time: 1714678200000, in: 1, out: 0 },
        { time: 1714678500000, in: 0, out: 0 },
        { time: 1714678800000, in: 0, out: 1 },
        { time: 1714679100000, in: 0, out: 0 },
        { time: 1714679400000, in: 1, out: 0 },
        { time: 1714679700000, in: 0, out: 0 },
      ],
    },
  },

  // ── DeckGoConfigSnapshotResponse (channel settings slice — BFF JSON) ───
  channelConfig: {
    telegram: {
      hash: "cfg-tg-001",
      baseHash: "cfg-tg-001",
      config: {
        enabled: true,
        retry: { attempts: 3, jitter: 0.2 },
        webhook: { enabled: false },
      },
    },
    discord: {
      hash: "cfg-disc-014",
      baseHash: "cfg-disc-014",
      config: {
        enabled: true,
        retry: { attempts: 4, jitter: 0.3 },
        webhook: { enabled: true, url: "https://hooks.example.com/discord" },
        slashCommands: { autoRegister: true, scope: "guild" },
      },
    },
    wecom: {
      hash: "cfg-wecom-007",
      baseHash: "cfg-wecom-007",
      config: {
        enabled: true,
        tenantId: "tenant-a",
        retry: { attempts: 5, jitter: 0.15 },
        access: { allowBots: true, dynamicAgents: true, failClosedRouting: true },
      },
    },
    slack: {
      hash: "cfg-slack-002",
      baseHash: "cfg-slack-002",
      config: { enabled: false },
    },
    qq: {
      hash: "cfg-qq-001",
      baseHash: "cfg-qq-001",
      config: { enabled: true, retry: { attempts: 2, jitter: 0.1 } },
    },
  },

  // ── DM policy per account (BFF projection) ─────────────────────────────
  dmPolicy: {
    acct_tg_main: { policy: "pairing", scope: "all" },
    acct_disc_ops: { policy: "open", scope: "guild" },
    acct_disc_bot: { policy: "pairing", scope: "guild" },
    acct_wecom_tenant_a: { policy: "pairing", scope: "tenant" },
    acct_wecom_tenant_b: { policy: "pairing", scope: "tenant" },
    acct_slack_main: { policy: "open", scope: "all" },
  },

  // ── DeckGoRoutingListResponse (filtered to wecom for the prototype) ────
  routing: {
    wecom: {
      bindings: [
        {
          id: "rt-wecom-001",
          agentId: "ops",
          tier: "tenant",
          match: { channel: "wecom", accountId: "acct_wecom_tenant_a" },
          comment: "Tenant A → Ops Runner",
        },
        {
          id: "rt-wecom-002",
          agentId: "research",
          tier: "department",
          match: {
            channel: "wecom",
            accountId: "acct_wecom_tenant_a",
            peer: { kind: "group", id: "research-dept" },
          },
          comment: "Tenant A research department → Research",
        },
        {
          id: "rt-wecom-003",
          agentId: "main",
          tier: "user",
          match: {
            channel: "wecom",
            accountId: "acct_wecom_tenant_b",
            peer: { kind: "direct", id: "user-vp-platform" },
          },
        },
      ],
      defaultAgentId: "main",
      dmScope: "tenant",
      configHash: "rt-wecom-cfg-019",
    },
    telegram: {
      bindings: [
        {
          id: "rt-tg-001",
          agentId: "main",
          tier: "default",
          match: { channel: "telegram" },
        },
      ],
      defaultAgentId: "main",
      dmScope: "all",
      configHash: "rt-tg-cfg-003",
    },
    discord: {
      bindings: [],
      defaultAgentId: "main",
      dmScope: "guild",
      configHash: "rt-disc-cfg-001",
    },
    slack: { bindings: [], defaultAgentId: "main", dmScope: "all", configHash: "rt-slack-cfg-001" },
    qq: { bindings: [], defaultAgentId: "main", dmScope: "all", configHash: "rt-qq-cfg-001" },
  },

  // ── WeCom access controls (provider-specific BFF state) ────────────────
  wecomAccess: {
    acct_wecom_tenant_a: {
      allowBots: true,
      allowFromAgents: ["main", "ops"],
      dynamicAgentsEnabled: true,
      failClosedRouting: true,
      lastSavedMs: 1714678200000,
    },
    acct_wecom_tenant_b: {
      allowBots: true,
      allowFromAgents: ["main"],
      dynamicAgentsEnabled: false,
      failClosedRouting: false,
      lastSavedMs: 1714248000000,
    },
  },

  // ── Action result feed (success, error, deduped, etc.) ─────────────────
  actionResult: {
    ok: true,
    channelId: "discord",
    changed: true,
    summary: "Channel settings saved (4 fields).",
    timestamp: 1714679800000,
  },
};
