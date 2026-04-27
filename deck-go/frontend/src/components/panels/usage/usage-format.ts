import type {
  DeckGoContextWeightReport,
  DeckGoUsageCostEntry,
  DeckGoUsageSessionEntry,
  DeckGoUsageSessionsResponse,
} from "../../../api";

export type UsageAggregateRow = {
  kind: "agent" | "channel" | "model" | "provider";
  label: string;
  totals: {
    totalCost?: number;
    totalTokens?: number;
  };
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function formatReset(resetAt?: number) {
  if (!resetAt) {
    return "n/a";
  }
  const remaining = Math.max(0, resetAt - Date.now());
  const hours = Math.floor(remaining / (60 * 60 * 1_000));
  const minutes = Math.floor((remaining % (60 * 60 * 1_000)) / (60 * 1_000));
  return `${hours}h ${minutes}m`;
}

export function parseUsageDays(value: string) {
  const parsedDays = Number.parseInt(value, 10);
  return Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined;
}

function localDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function usageRangeFromDays(daysValue: string) {
  const parsedDays = parseUsageDays(daysValue) ?? 14;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - parsedDays + 1);
  return {
    endDate: localDateString(end),
    startDate: localDateString(start),
  };
}

export function usageEntryCost(entry: DeckGoUsageSessionEntry) {
  return entry.usage?.totalCost ?? 0;
}

export function usageEntryTokens(entry: DeckGoUsageSessionEntry) {
  return entry.usage?.totalTokens ?? 0;
}

export function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "n/a";
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toLocaleString();
}

export function formatChars(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export function formatDurationMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}

export function usageAggregateRows(response: DeckGoUsageSessionsResponse | null) {
  const aggregates = response?.aggregates;
  if (!aggregates) {
    return [];
  }
  return [
    ...(aggregates.byModel ?? []).map(
      (entry): UsageAggregateRow => ({
        kind: "model",
        label: entry.model || "",
        totals: entry.totals,
      }),
    ),
    ...(aggregates.byProvider ?? []).map(
      (entry): UsageAggregateRow => ({
        kind: "provider",
        label: entry.provider || "",
        totals: entry.totals,
      }),
    ),
    ...(aggregates.byAgent ?? []).map(
      (entry): UsageAggregateRow => ({
        kind: "agent",
        label: entry.agentId || "",
        totals: entry.totals,
      }),
    ),
    ...(aggregates.byChannel ?? []).map(
      (entry): UsageAggregateRow => ({
        kind: "channel",
        label: entry.channel || "",
        totals: entry.totals,
      }),
    ),
  ].slice(0, 12);
}

export function costEntryTotal(entry: DeckGoUsageCostEntry) {
  return entry.totalCost ?? entry.cost ?? 0;
}

export function contextWeightSummary(report: DeckGoContextWeightReport) {
  const system = report.systemPrompt.chars;
  const tools = report.tools.listChars + report.tools.schemaChars;
  const skills = report.skills.promptChars;
  const files = report.injectedWorkspaceFiles.reduce((sum, file) => sum + file.injectedChars, 0);
  return {
    files,
    skills,
    system,
    tools,
    total: system + tools + skills + files,
  };
}
