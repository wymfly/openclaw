import type {
  ChannelDiagnosticTone,
  ChannelFilter,
  ChannelInventoryItem,
  ChannelInventoryTotals,
  ChannelNavigationTarget,
  ChannelTranslator,
  ChannelUiMeta,
  DeckGoChannelTestResponse,
  DeckGoChannelsStatusResponse,
  NormalizedChannelAccount,
} from "../types";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function booleanValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

export function numberValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readChannelNavigationTarget(): ChannelNavigationTarget {
  if (typeof window === "undefined") {
    return { accountId: "", channelId: "", section: "" };
  }
  const params = new URL(window.location.href).searchParams;
  return {
    accountId: params.get("channelAccountId")?.trim() ?? "",
    channelId: params.get("channelId")?.trim() ?? "",
    section: params.get("channelSection") === "access" ? "access" : "",
  };
}

export function accountDiagnostic(
  record: Record<string, unknown>,
  t: ChannelTranslator,
): NormalizedChannelAccount["diagnostic"] {
  const enabled = booleanValue(record, "enabled");
  const configured = booleanValue(record, "configured");
  const linked = booleanValue(record, "linked");
  const connected = booleanValue(record, "connected");
  const lastError = stringValue(record, "lastError");

  if (enabled === false) {
    return {
      tone: "neutral",
      title: t("diagDisabledTitle"),
      description: t("diagDisabledDescription"),
      nextStep: t("diagDisabledNextStep"),
    };
  }
  if (configured === false) {
    return {
      tone: "warning",
      title: t("diagConfigIncompleteTitle"),
      description: t("diagConfigIncompleteDescription"),
      nextStep: t("diagConfigIncompleteNextStep"),
    };
  }
  if (lastError) {
    return {
      tone: "error",
      title: t("diagAccountErrorTitle"),
      description: lastError,
      nextStep: t("diagAccountErrorNextStep"),
    };
  }
  if (linked === true && connected === false) {
    return {
      tone: "warning",
      title: t("diagLinkedDisconnectedTitle"),
      description: t("diagLinkedDisconnectedDescription"),
      nextStep: t("diagLinkedDisconnectedNextStep"),
    };
  }
  if (enabled === true && linked === false) {
    return {
      tone: "warning",
      title: t("diagEnabledNotLinkedTitle"),
      description: t("diagEnabledNotLinkedDescription"),
      nextStep: t("diagEnabledNotLinkedNextStep"),
    };
  }
  if (enabled === undefined && configured === undefined && linked === undefined) {
    return {
      tone: "info",
      title: t("diagUnknownTitle"),
      description: t("diagUnknownDescription"),
      nextStep: t("diagUnknownNextStep"),
    };
  }
  return {
    tone: "success",
    title: t("diagHealthyTitle"),
    description: t("diagHealthyDescription"),
    nextStep: t("diagHealthyNextStep"),
  };
}

export function normalizeChannelAccounts(
  value: unknown,
  t: ChannelTranslator,
): NormalizedChannelAccount[] {
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [`${index + 1}`, entry] as const)
    : Object.entries(asRecord(value));

  return entries.map(([fallbackId, entry]) => {
    const payload = asRecord(entry);
    const accountId = stringValue(payload, "accountId") || stringValue(payload, "id") || fallbackId;
    return {
      accountId,
      payload: { accountId, ...payload },
      diagnostic: accountDiagnostic(payload, t),
    };
  });
}

export function countAlertingAccounts(accounts: NormalizedChannelAccount[]) {
  return accounts.filter(
    (account) => account.diagnostic.tone === "warning" || account.diagnostic.tone === "error",
  ).length;
}

export function diagnosticClassName(tone: ChannelDiagnosticTone) {
  if (tone === "success") {
    return "is-positive";
  }
  if (tone === "warning") {
    return "is-warning";
  }
  if (tone === "error") {
    return "is-danger";
  }
  if (tone === "info") {
    return "is-info";
  }
  return "is-muted";
}

export function channelProbeTone(result: DeckGoChannelTestResponse) {
  if (result.ok === true) {
    return "is-positive";
  }
  if (/timeout|deadline/i.test(result.error ?? "")) {
    return "is-warning";
  }
  return "is-danger";
}

export function channelProbeLabel(result: DeckGoChannelTestResponse, t: ChannelTranslator) {
  if (result.ok === true) {
    return t("probeSuccess");
  }
  if (/timeout|deadline/i.test(result.error ?? "")) {
    return t("probeTimeout");
  }
  return t("probeFailure");
}

export function readThroughputSummary(channel: Record<string, unknown>) {
  const throughput = asRecord(channel.throughput);
  const messagesIn =
    numberValue(channel, "messagesIn") ??
    numberValue(channel, "throughputIn") ??
    numberValue(throughput, "messagesIn") ??
    numberValue(throughput, "in") ??
    0;
  const messagesOut =
    numberValue(channel, "messagesOut") ??
    numberValue(channel, "throughputOut") ??
    numberValue(throughput, "messagesOut") ??
    numberValue(throughput, "out") ??
    0;
  return { messagesIn, messagesOut };
}

export function formatThroughputSummary(
  summary: ChannelInventoryItem["throughputSummary"],
  t: ChannelTranslator,
) {
  if (summary.messagesIn === 0 && summary.messagesOut === 0) {
    return t("throughputUnavailable");
  }
  return t("throughputInOut", { in: summary.messagesIn, out: summary.messagesOut });
}

export function throughputSparkClass(
  summary: ChannelInventoryItem["throughputSummary"],
  totalMessagesIn: number,
) {
  if (summary.messagesIn <= 0) {
    return "is-zero";
  }
  const ratio = summary.messagesIn / Math.max(1, totalMessagesIn);
  if (ratio >= 0.66) {
    return "is-high";
  }
  if (ratio >= 0.33) {
    return "is-mid";
  }
  return "is-low";
}

export function displayAccountName(account: NormalizedChannelAccount) {
  return (
    stringValue(account.payload, "displayName") ||
    stringValue(account.payload, "name") ||
    account.accountId
  );
}

export function channelMatchesFilter(item: ChannelInventoryItem, filter: ChannelFilter) {
  if (filter === "enabled") {
    return item.enabled;
  }
  if (filter === "alerts") {
    return item.alertCount > 0;
  }
  if (filter === "wecom") {
    return item.id === "wecom" || item.meta?.pluginId === "wecom";
  }
  return true;
}

export function hasWecomChannel(items: ChannelInventoryItem[]) {
  return items.some((item) => item.id === "wecom" || item.meta?.pluginId === "wecom");
}

export function buildChannelInventory(
  payload: DeckGoChannelsStatusResponse | null,
  t: ChannelTranslator,
): ChannelInventoryItem[] {
  const rawChannels = asRecord(payload?.channels);
  const rawChannelAccounts = asRecord(payload?.channelAccounts);
  const order = payload?.channelOrder?.length ? payload.channelOrder : Object.keys(rawChannels);
  const labels = payload?.channelLabels ?? {};
  const detailLabels = payload?.channelDetailLabels ?? {};
  const meta = Array.isArray(payload?.channelMeta) ? payload.channelMeta : [];
  const metaById = new Map(meta.map((entry: ChannelUiMeta) => [entry.id, entry]));
  return order.map((channelId) => {
    const channel = asRecord(rawChannels[channelId]);
    const accounts = normalizeChannelAccounts(rawChannelAccounts[channelId], t);
    const channelMeta = metaById.get(channelId);
    const enabled =
      booleanValue(channel, "enabled") ??
      accounts.some((account) => booleanValue(account.payload, "enabled") === true);
    return {
      accounts,
      alertCount: countAlertingAccounts(accounts),
      channel,
      defaultAccountId: payload?.channelDefaultAccountId?.[channelId] || "",
      detailLabel: channelMeta?.detailLabel || detailLabels[channelId] || "",
      enabled,
      id: channelId,
      label: labels[channelId] || channelMeta?.label || channelId,
      meta: channelMeta,
      throughputSummary: readThroughputSummary(channel),
    };
  });
}

export function summarizeInventoryTotals(items: ChannelInventoryItem[]): ChannelInventoryTotals {
  const totalAccounts = items.reduce((sum, item) => sum + item.accounts.length, 0);
  const enabled = items.filter((item) => item.enabled).length;
  const alerts = items.reduce((sum, item) => sum + item.alertCount, 0);
  const degraded = items.filter((item) => item.enabled && item.alertCount > 0).length;
  const messagesIn = items.reduce((sum, item) => sum + item.throughputSummary.messagesIn, 0);
  const messagesOut = items.reduce((sum, item) => sum + item.throughputSummary.messagesOut, 0);
  return { alerts, degraded, enabled, messagesIn, messagesOut, totalAccounts };
}

export function applyChannelFilter(
  items: ChannelInventoryItem[],
  filter: ChannelFilter,
  searchQuery: string,
) {
  const query = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (!channelMatchesFilter(item, filter)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [item.id, item.label, item.detailLabel, item.meta?.pluginId ?? ""].some((candidate) =>
      candidate.toLowerCase().includes(query),
    );
  });
}
