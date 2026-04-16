import type { ChannelInfo } from "../../../stores/channels";

export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";

export type WecomDmState = {
  policy: DmPolicy;
  allowFrom: string[];
};

export type WecomDynamicAgentState = {
  enabled: boolean;
  dmCreateAgent: boolean;
  groupEnabled: boolean;
  adminUsers: string[];
};

export type WecomAccountAccessState = {
  botConfigured: boolean;
  agentConfigured: boolean;
  bot: WecomDmState;
  agent: WecomDmState;
};

export type WecomAccessModel = {
  defaultAccountId: string;
  isMatrix: boolean;
  accountIds: string[];
  dynamicAgents: WecomDynamicAgentState;
  failClosedOnDefaultRoute: boolean;
  accounts: Record<string, WecomAccountAccessState>;
};

type WecomRootConfig = Record<string, unknown> & {
  accounts?: Record<string, Record<string, unknown>>;
  defaultAccount?: string;
};

function toPolicy(value: unknown): DmPolicy {
  if (value === "pairing" || value === "allowlist" || value === "open" || value === "disabled") {
    return value;
  }
  return "pairing";
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => String(value)).filter(Boolean);
}

export function normalizeWecomAllowFromEntry(raw: string): string {
  return raw
    .trim()
    .replace(/^(wecom:|user:|userid:)+/i, "")
    .trim()
    .toLowerCase();
}

export function buildWecomAccessModel(
  channel: ChannelInfo,
  channelConfig: Record<string, unknown> | null,
): WecomAccessModel {
  const root = (channelConfig ?? {}) as WecomRootConfig;
  const rawAccounts = root.accounts ?? {};
  const accountIdsFromChannel = channel.accounts.map((account) => account.accountId);
  const accountIdsFromConfig = Object.keys(rawAccounts);
  const rawDefaultAccountId =
    channel.defaultAccountId ??
    (typeof root.defaultAccount === "string" && root.defaultAccount) ??
    accountIdsFromChannel[0] ??
    accountIdsFromConfig[0] ??
    "default";
  const defaultAccountId =
    typeof rawDefaultAccountId === "string" && rawDefaultAccountId
      ? rawDefaultAccountId
      : "default";
  const accountIds = Array.from(
    new Set(
      [defaultAccountId, ...accountIdsFromChannel, ...accountIdsFromConfig].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
  const isMatrix = accountIds.length > 1 || accountIdsFromConfig.length > 0;

  const accounts = Object.fromEntries(
    accountIds.map((accountId) => {
      // When multiple runtime accounts exist before explicit matrix config has
      // been saved, inherit root-level defaults as the per-account baseline.
      const scoped = isMatrix ? ({ ...root, ...rawAccounts[accountId] } as WecomRootConfig) : root;
      const bot = (scoped.bot ?? {}) as Record<string, unknown>;
      const agent = (scoped.agent ?? {}) as Record<string, unknown>;
      const botDm = (bot.dm ?? {}) as Record<string, unknown>;
      const agentDm = (agent.dm ?? {}) as Record<string, unknown>;

      return [
        accountId,
        {
          botConfigured: Object.keys(bot).length > 0,
          agentConfigured: Object.keys(agent).length > 0,
          bot: {
            policy: toPolicy(botDm.policy),
            allowFrom: normalizeList(botDm.allowFrom),
          },
          agent: {
            policy: toPolicy(agentDm.policy),
            allowFrom: normalizeList(agentDm.allowFrom),
          },
        },
      ] as const;
    }),
  ) as Record<string, WecomAccountAccessState>;

  const dynamicAgents = (root.dynamicAgents ?? {}) as Record<string, unknown>;
  const routing = (root.routing ?? {}) as Record<string, unknown>;

  return {
    defaultAccountId,
    isMatrix,
    accountIds,
    dynamicAgents: {
      enabled: dynamicAgents.enabled === true,
      dmCreateAgent: dynamicAgents.dmCreateAgent !== false,
      groupEnabled: dynamicAgents.groupEnabled !== false,
      adminUsers: normalizeList(dynamicAgents.adminUsers),
    },
    failClosedOnDefaultRoute: routing.failClosedOnDefaultRoute === true,
    accounts,
  } satisfies WecomAccessModel;
}
