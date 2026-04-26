import type { DeckGoUsageCostEntry, DeckGoUsageSessionsResponse } from "../../../api";

export type UsageTrendRow = {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
  toolCalls: number;
  errors: number;
  source: "cost" | "sessions";
};

export type UsageModelTrendRow = {
  label: string;
  tokens: number;
  cost: number;
  count: number;
};

function costEntryValue(entry: DeckGoUsageCostEntry) {
  return entry.totalCost ?? entry.cost ?? 0;
}

export function buildUsageTrendRows(
  response: DeckGoUsageSessionsResponse | null,
  costEntries: DeckGoUsageCostEntry[],
) {
  const byDate = new Map<string, UsageTrendRow>();
  for (const entry of costEntries) {
    byDate.set(entry.date, {
      cost: costEntryValue(entry),
      date: entry.date,
      errors: 0,
      messages: 0,
      source: "cost",
      tokens: 0,
      toolCalls: 0,
    });
  }
  for (const entry of response?.aggregates?.daily ?? []) {
    byDate.set(entry.date, {
      cost: entry.cost,
      date: entry.date,
      errors: entry.errors,
      messages: entry.messages,
      source: "sessions",
      tokens: entry.tokens,
      toolCalls: entry.toolCalls,
    });
  }
  return Array.from(byDate.values()).toSorted((left, right) => left.date.localeCompare(right.date));
}

export function buildUsageModelTrendRows(response: DeckGoUsageSessionsResponse | null) {
  const byLabel = new Map<string, UsageModelTrendRow>();
  for (const entry of response?.aggregates?.modelDaily ?? []) {
    const label = entry.model || entry.provider || "unknown model";
    const current = byLabel.get(label) ?? { cost: 0, count: 0, label, tokens: 0 };
    current.cost += entry.cost;
    current.count += entry.count;
    current.tokens += entry.tokens;
    byLabel.set(label, current);
  }
  return Array.from(byLabel.values()).toSorted((left, right) => right.tokens - left.tokens);
}
