import type { DeckGoThreadEntry } from "../../../api";

export type ThreadFilters = {
  agentId: string;
  channel: string;
  status: "active" | "all";
};

export type ThreadRecencyFilter = "all" | "active" | "stale";

export type ThreadLocalFilters = {
  channelKind: string;
  query: string;
  recency: ThreadRecencyFilter;
  targetKind: string;
};

export const THREAD_FILTER_DEBOUNCE_MS = 300;
export const ALL_THREADS_FILTER = "__all__";
export const THREAD_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_THREAD_FILTERS: ThreadFilters = {
  agentId: "",
  channel: "",
  status: "active",
};

export const DEFAULT_THREAD_LOCAL_FILTERS: ThreadLocalFilters = {
  channelKind: ALL_THREADS_FILTER,
  query: "",
  recency: "all",
  targetKind: ALL_THREADS_FILTER,
};

export function normalizeThreadFilters(filters: ThreadFilters): ThreadFilters {
  return {
    agentId: filters.agentId.trim(),
    channel: filters.channel.trim(),
    status: filters.status,
  };
}

export function areThreadFiltersEqual(left: ThreadFilters, right: ThreadFilters) {
  return (
    left.agentId === right.agentId && left.channel === right.channel && left.status === right.status
  );
}

export function sortThreadsByActivity(threads: DeckGoThreadEntry[]) {
  return [...threads].toSorted(
    (left, right) =>
      right.lastActivityAt - left.lastActivityAt || left.threadId.localeCompare(right.threadId),
  );
}

export function channelKindFromId(channelId: string) {
  return channelId.split(":")[0]?.trim() || channelId;
}

export function isThreadStale(thread: DeckGoThreadEntry, now = Date.now()) {
  return now - thread.lastActivityAt > THREAD_STALE_THRESHOLD_MS;
}

export function listThreadChannelKinds(threads: DeckGoThreadEntry[]) {
  return [
    ...new Set(threads.map((thread) => channelKindFromId(thread.channelId)).filter(Boolean)),
  ].toSorted((left, right) => left.localeCompare(right));
}

export function listThreadTargetKinds(threads: DeckGoThreadEntry[]) {
  return [...new Set(threads.map((thread) => thread.targetKind).filter(Boolean))].toSorted(
    (left, right) => left.localeCompare(right),
  );
}

export function filterThreadsByLocalState(
  threads: DeckGoThreadEntry[],
  filters: ThreadLocalFilters,
  now = Date.now(),
) {
  const query = filters.query.trim().toLowerCase();
  return threads.filter((thread) => {
    if (
      filters.channelKind !== ALL_THREADS_FILTER &&
      channelKindFromId(thread.channelId) !== filters.channelKind
    ) {
      return false;
    }
    if (filters.targetKind !== ALL_THREADS_FILTER && thread.targetKind !== filters.targetKind) {
      return false;
    }
    const stale = isThreadStale(thread, now);
    if (filters.recency === "active" && stale) {
      return false;
    }
    if (filters.recency === "stale" && !stale) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [
      thread.threadId,
      thread.channelId,
      thread.agentId,
      thread.targetSessionKey,
      thread.targetKind,
      thread.accountId,
      thread.boundBy,
      thread.label ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function calculateThreadMetrics(threads: DeckGoThreadEntry[], visibleCount: number) {
  return {
    active24h: threads.filter((thread) => !isThreadStale(thread)).length,
    autoBound: threads.filter((thread) => thread.boundBy === "auto-binding").length,
    channelKinds: listThreadChannelKinds(threads).length,
    distinctAgents: new Set(threads.map((thread) => thread.agentId).filter(Boolean)).size,
    total: threads.length,
    visible: visibleCount,
  };
}

export function formatThreadTimestamp(value: number, fallback = "n/a") {
  return Number.isFinite(value) ? new Date(value).toLocaleString() : fallback;
}

export function formatRelativeThreadTime(
  value: number,
  t?: (key: string, values?: Record<string, number>) => string,
) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) {
    return t ? t("secondsAgo", { n: seconds }) : `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return t ? t("minutesAgo", { n: minutes }) : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t ? t("hoursAgo", { n: hours }) : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return t ? t("daysAgo", { n: days }) : `${days}d ago`;
}
