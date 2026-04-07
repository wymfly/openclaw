import {
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk/core";
import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  OpenClawConfig,
} from "openclaw/plugin-sdk/wecom";
import { probeWecomAccount } from "./channel-probe.js";
import {
  DEFAULT_ACCOUNT_ID,
  listWecomAccountIds,
  resolveDerivedPathSummary,
  resolveDefaultWecomAccountId,
  resolveWecomAccount,
  resolveWecomAccountConflict,
} from "./config/index.js";
import { monitorWecomProvider } from "./gateway-monitor.js";
import { wecomSetupWizard } from "./onboarding.js";
import { wecomOutbound } from "./outbound.js";
import type { ResolvedWecomAccount, WecomChannelSnapshot } from "./types/index.js";

const meta = {
  id: "wecom",
  label: "WeCom (企业微信)",
  selectionLabel: "WeCom (企业微信)",
  docsPath: "/channels/wecom",
  docsLabel: "企业微信",
  blurb: "企业微信官方推荐三方插件，默认 Bot WS 配置简单，支持主动发消息与 Agent 全能力。",
  selectionDocsPrefix: "文档：",
  aliases: ["wechatwork", "wework", "qywx", "企微", "企业微信"],
  order: 85,
  quickstartAllowFrom: true,
};

function resolveAccountInboundPath(account: ResolvedWecomAccount): string | undefined {
  const derivedPaths = resolveDerivedPathSummary(account.accountId);
  if (account.bot?.primaryTransport === "webhook" && account.bot.webhookConfigured) {
    return derivedPaths.botWebhook[0];
  }
  if (account.agent?.callbackConfigured) {
    return derivedPaths.agentCallback[0];
  }
  return undefined;
}

function normalizeWecomMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^wecom-agent:/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/^(wecom|wechatwork|wework|qywx):/i, "").trim() || undefined;
}

export const wecomPlugin: ChannelPlugin<ResolvedWecomAccount> = {
  id: "wecom",
  meta,
  setupWizard: wecomSetupWizard,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.wecom"] },
  // NOTE: We intentionally avoid Zod -> JSON Schema conversion at plugin-load time.
  // Some OpenClaw runtime environments load plugin modules via jiti in a way that can
  // surface zod `toJSONSchema()` binding issues (e.g. `this` undefined leading to `_zod` errors).
  // A permissive schema keeps config UX working while preventing startup failures.
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: true,
      properties: {},
    },
  },
  config: {
    listAccountIds: (cfg) => listWecomAccountIds(cfg as OpenClawConfig),
    resolveAccount: (cfg, accountId) =>
      resolveWecomAccount({ cfg: cfg as OpenClawConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultWecomAccountId(cfg as OpenClawConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as OpenClawConfig,
        sectionKey: "wecom",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as OpenClawConfig,
        sectionKey: "wecom",
        accountId,
        clearBaseFields: ["bot", "agent"],
      }),
    isConfigured: (account, cfg) => {
      if (!account.configured) {
        return false;
      }
      return !resolveWecomAccountConflict({
        cfg: cfg as OpenClawConfig,
        accountId: account.accountId,
      });
    },
    unconfiguredReason: (account, cfg) =>
      resolveWecomAccountConflict({
        cfg: cfg as OpenClawConfig,
        accountId: account.accountId,
      })?.message ?? "not configured",
    describeAccount: (account, cfg): ChannelAccountSnapshot => {
      const conflict = resolveWecomAccountConflict({
        cfg: cfg as OpenClawConfig,
        accountId: account.accountId,
      });
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured && !conflict,
        webhookPath: resolveAccountInboundPath(account),
      };
    },
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveWecomAccount({ cfg: cfg as OpenClawConfig, accountId });
      // 与其他渠道保持一致：直接返回 allowFrom，空则允许所有人
      const allowFrom =
        account.agent?.config.dm?.allowFrom ?? account.bot?.config.dm?.allowFrom ?? [];
      return allowFrom.map((entry) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  // security 配置在 WeCom 中不需要，框架会通过 resolveAllowFrom 自动判断
  groups: {
    // WeCom bots are usually mention-gated by the platform in groups already.
    resolveRequireMention: () => true,
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
  messaging: {
    normalizeTarget: normalizeWecomMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => Boolean(raw.trim()),
      hint: "<userid|chatid>",
    },
  },
  outbound: {
    ...wecomOutbound,
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }: { snapshot: WecomChannelSnapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      webhookPath: snapshot.webhookPath ?? null,
      transport: snapshot.transport ?? null,
      ownerId: snapshot.ownerId ?? null,
      health: snapshot.health ?? "idle",
      ownerDriftAt: snapshot.ownerDriftAt ?? null,
      connected: snapshot.connected,
      authenticated: snapshot.authenticated,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      lastErrorAt: snapshot.lastErrorAt ?? null,
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null,
      recentInboundSummary: snapshot.recentInboundSummary ?? null,
      recentOutboundSummary: snapshot.recentOutboundSummary ?? null,
      recentIssueCategory: snapshot.recentIssueCategory ?? null,
      recentIssueSummary: snapshot.recentIssueSummary ?? null,
      transportSessions: snapshot.transportSessions ?? [],
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => probeWecomAccount({ account, timeoutMs }),
    buildAccountSnapshot: ({
      account,
      runtime,
      cfg,
    }: {
      account: ResolvedWecomAccount;
      runtime?: WecomChannelSnapshot;
      cfg: unknown;
    }) => {
      const conflict = resolveWecomAccountConflict({
        cfg: cfg as OpenClawConfig,
        accountId: account.accountId,
      });
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured && !conflict,
        webhookPath: resolveAccountInboundPath(account),
        primaryTransport:
          account.bot?.primaryTransport ?? (account.agent ? "agent-callback" : null),
        transport: runtime?.transport ?? null,
        ownerId: runtime?.ownerId ?? null,
        health: runtime?.health ?? "idle",
        ownerDriftAt: runtime?.ownerDriftAt ?? null,
        connected: runtime?.connected,
        authenticated: runtime?.authenticated,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? conflict?.message ?? null,
        lastErrorAt: runtime?.lastErrorAt ?? null,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
        recentInboundSummary: runtime?.recentInboundSummary ?? null,
        recentOutboundSummary: runtime?.recentOutboundSummary ?? null,
        recentIssueCategory: runtime?.recentIssueCategory ?? null,
        recentIssueSummary: runtime?.recentIssueSummary ?? null,
        transportSessions: runtime?.transportSessions ?? [],
        dmPolicy: account.bot?.config.dm?.policy ?? "pairing",
      };
    },
  },
  gateway: {
    /**
     * **startAccount (启动账号)**
     *
     * WeCom lifecycle is long-running: keep webhook targets active until
     * gateway stop/reload aborts the account.
     */
    startAccount: monitorWecomProvider,
    stopAccount: async (ctx) => {
      ctx.setStatus({
        accountId: ctx.account.accountId,
        running: false,
        lastStopAt: Date.now(),
      });
    },
  },
};
