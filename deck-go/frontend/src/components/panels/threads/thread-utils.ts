import type { DeckGoThreadEntry } from "../../../api";

export type ThreadFilters = {
  agentId: string;
  channel: string;
  status: "active" | "all";
};

export const THREAD_FILTER_DEBOUNCE_MS = 300;

export const DEFAULT_THREAD_FILTERS: ThreadFilters = {
  agentId: "",
  channel: "",
  status: "active",
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

export function formatThreadTimestamp(value: number) {
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "n/a";
}

export function formatRelativeThreadTime(value: number) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function explainThreadRelation(thread: DeckGoThreadEntry) {
  return `Thread ${thread.threadId} on ${thread.channelId} routes ${thread.targetKind} ${thread.targetSessionKey} to agent ${thread.agentId}; bound by ${thread.boundBy} for account ${thread.accountId}.`;
}
