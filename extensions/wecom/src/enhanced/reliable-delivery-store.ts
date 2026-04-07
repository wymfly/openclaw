import type { PendingReplyEntry, ReliableDeliveryStore } from "./pending-reply.js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BACKOFF_MS = 30_000;
const DEFAULT_EXPIRE_MS = 86_400_000; // 24h

let nextId = 1;

export function createInMemoryReliableDeliveryStore(): ReliableDeliveryStore {
  const entries = new Map<string, PendingReplyEntry>();

  return {
    countPendingReplies(): number {
      let count = 0;
      for (const e of entries.values()) {
        if (e.status === "pending") count++;
      }
      return count;
    },

    enqueuePendingReply(payload: Record<string, unknown>): PendingReplyEntry | null {
      const now = Date.now();
      const id = `pr-${nextId++}-${now}`;
      const entry: PendingReplyEntry = {
        id,
        text: typeof payload.text === "string" ? payload.text : undefined,
        to: typeof payload.to === "string" ? payload.to : undefined,
        maxRetries: DEFAULT_MAX_RETRIES,
        retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
        expireMs: DEFAULT_EXPIRE_MS,
        retries: 0,
        nextRetryAt: now,
        createdAt: now,
        status: "pending",
        ...payload,
      };
      entries.set(id, entry);
      return entry;
    },

    listDuePendingReplies(opts: { at: number; limit: number }): PendingReplyEntry[] {
      const result: PendingReplyEntry[] = [];
      for (const e of entries.values()) {
        if (e.status === "pending" && e.nextRetryAt <= opts.at) {
          result.push(e);
          if (result.length >= opts.limit) break;
        }
      }
      return result;
    },

    markPendingDelivered(opts: { id: string; at: number }): void {
      entries.delete(opts.id);
    },

    reschedulePendingReply(opts: { id: string; reason: string; at: number }): boolean {
      const entry = entries.get(opts.id);
      if (!entry || entry.status !== "pending") return false;
      entry.retries++;
      if (entry.retries >= (entry.maxRetries ?? DEFAULT_MAX_RETRIES)) {
        entry.status = "exhausted";
        entries.delete(opts.id);
        return false;
      }
      const backoff = entry.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
      entry.nextRetryAt = opts.at + backoff * Math.pow(2, entry.retries - 1);
      return true;
    },

    dropExpiredPendingReplies(opts: { at: number }): void {
      for (const [id, entry] of entries) {
        if (opts.at - entry.createdAt > (entry.expireMs ?? DEFAULT_EXPIRE_MS)) {
          entries.delete(id);
        }
      }
    },

    listPendingRepliesForSession(opts: {
      mode?: string;
      accountId?: string;
      sessionId?: string;
    }): PendingReplyEntry[] {
      const result: PendingReplyEntry[] = [];
      for (const e of entries.values()) {
        if (e.status !== "pending") continue;
        if (opts.accountId && (e as Record<string, unknown>).accountId !== opts.accountId) continue;
        result.push(e);
      }
      return result;
    },
  };
}
