/**
 * WeCom pending-reply manager (reliable delivery retry queue).
 *
 * Ported from vendor/OpenClaw-Wechat/src/wecom/pending-reply-manager.js
 * to TypeScript with full dependency injection and zero external dependencies.
 */

export interface PendingReplyEntry {
  id: string;
  text?: string;
  to?: string;
  maxRetries?: number;
  retryBackoffMs?: number;
  expireMs?: number;
  retries: number;
  nextRetryAt: number;
  createdAt: number;
  status: "pending" | "delivered" | "exhausted";
  [key: string]: unknown;
}

export interface PendingReplyPolicy {
  enabled: boolean;
  maxRetries?: number;
  retryBackoffMs?: number;
  expireMs?: number;
}

export interface ReliableDeliveryStore {
  countPendingReplies(): number;
  enqueuePendingReply(payload: Record<string, unknown>): PendingReplyEntry | null;
  listDuePendingReplies(opts: { at: number; limit: number }): PendingReplyEntry[];
  markPendingDelivered(opts: { id: string; at: number }): void;
  reschedulePendingReply(opts: { id: string; reason: string; at: number }): boolean;
  dropExpiredPendingReplies(opts: { at: number }): void;
  listPendingRepliesForSession(opts: {
    mode?: string;
    accountId?: string;
    sessionId?: string;
  }): PendingReplyEntry[];
}

export interface PendingReplyManagerDeps {
  reliableDeliveryStore: ReliableDeliveryStore;
  resolveWecomPendingReplyPolicy: (api: unknown) => PendingReplyPolicy | null;
  deliverPendingReply: (
    entry: PendingReplyEntry,
    trigger: string,
  ) => Promise<{ ok: boolean; deliveryStatus?: string; finalStatus?: string; error?: string }>;
  ensurePersistenceLoaded?: (api?: unknown) => Promise<boolean>;
  schedulePersistenceFlush?: (reason: string, api?: unknown) => void;
  logger?: { warn?: (msg: string) => void; info?: (msg: string) => void };
  now?: () => number;
  sweepIntervalMs?: number;
}

export interface PendingReplyManager {
  initialize(api?: unknown): Promise<boolean>;
  enqueuePendingReply(api: unknown, payload?: Record<string, unknown>): PendingReplyEntry | null;
  flushDuePendingReplies(trigger?: string): Promise<void>;
  flushSessionPendingReplies(opts?: {
    mode?: string;
    accountId?: string;
    sessionId?: string;
  }): Promise<void>;
  ensureSweepTimer(): void;
}

function assertFunction(name: string, value: unknown): asserts value is Function {
  if (typeof value !== "function") {
    throw new Error(`createWecomPendingReplyManager: ${name} is required`);
  }
}

export function createWecomPendingReplyManager(deps: PendingReplyManagerDeps): PendingReplyManager {
  const {
    reliableDeliveryStore,
    resolveWecomPendingReplyPolicy,
    deliverPendingReply,
    ensurePersistenceLoaded = async () => true,
    schedulePersistenceFlush = () => {},
    logger,
    now = () => Date.now(),
    sweepIntervalMs = 15000,
  } = deps ?? {};

  if (!reliableDeliveryStore || typeof reliableDeliveryStore !== "object") {
    throw new Error("createWecomPendingReplyManager: reliableDeliveryStore is required");
  }
  assertFunction("resolveWecomPendingReplyPolicy", resolveWecomPendingReplyPolicy);
  assertFunction("deliverPendingReply", deliverPendingReply);
  assertFunction("ensurePersistenceLoaded", ensurePersistenceLoaded);
  assertFunction("schedulePersistenceFlush", schedulePersistenceFlush);
  assertFunction("now", now);

  let sweepTimer: ReturnType<typeof setInterval> | null = null;
  let sweepPromise: Promise<void> = Promise.resolve();

  function ensureSweepTimer() {
    if (sweepTimer) return;
    sweepTimer = setInterval(
      () => {
        void flushDuePendingReplies("timer");
      },
      Math.max(5000, Number(sweepIntervalMs) || 15000),
    );
    sweepTimer.unref?.();
  }

  async function initialize(api?: unknown): Promise<boolean> {
    await ensurePersistenceLoaded(api);
    if (reliableDeliveryStore.countPendingReplies() > 0) {
      ensureSweepTimer();
    }
    return true;
  }

  function enqueuePendingReply(
    api: unknown,
    payload: Record<string, unknown> = {},
  ): PendingReplyEntry | null {
    const policy = resolveWecomPendingReplyPolicy(api);
    if (policy?.enabled !== true) return null;
    const entry = reliableDeliveryStore.enqueuePendingReply({
      ...payload,
      maxRetries: policy.maxRetries,
      retryBackoffMs: policy.retryBackoffMs,
      expireMs: policy.expireMs,
    });
    if (entry) {
      ensureSweepTimer();
      schedulePersistenceFlush("pending-enqueue", api);
    }
    return entry;
  }

  async function attemptPendingEntry(
    entry: PendingReplyEntry,
    trigger: string,
  ): Promise<{ delivered: boolean; rescheduled?: boolean; error?: string }> {
    try {
      const result = await deliverPendingReply(entry, trigger);
      if (result?.ok === true) {
        reliableDeliveryStore.markPendingDelivered({ id: entry.id, at: now() });
        schedulePersistenceFlush("pending-delivered");
        return { delivered: true };
      }
      const reason = String(
        result?.deliveryStatus || result?.finalStatus || result?.error || "pending-retry-failed",
      );
      return {
        delivered: false,
        rescheduled: reliableDeliveryStore.reschedulePendingReply({
          id: entry.id,
          reason,
          at: now(),
        }),
      };
    } catch (err: unknown) {
      const reason = String((err as Error)?.message || err || "pending-retry-failed");
      logger?.warn?.(
        `wecom: pending reply retry failed id=${entry.id} trigger=${trigger} reason=${reason}`,
      );
      return {
        delivered: false,
        error: reason,
        rescheduled: reliableDeliveryStore.reschedulePendingReply({
          id: entry.id,
          reason,
          at: now(),
        }),
      };
    }
  }

  async function flushEntries(entries: PendingReplyEntry[], trigger: string): Promise<void> {
    for (const entry of entries) {
      await attemptPendingEntry(entry, trigger);
    }
  }

  function flushDuePendingReplies(trigger = "timer"): Promise<void> {
    sweepPromise = sweepPromise
      .then(async () => {
        await initialize();
        reliableDeliveryStore.dropExpiredPendingReplies({ at: now() });
        const entries = reliableDeliveryStore.listDuePendingReplies({
          at: now(),
          limit: 20,
        });
        await flushEntries(entries, trigger);
        schedulePersistenceFlush(`pending-flush:${trigger}`);
      })
      .catch((err: unknown) => {
        logger?.warn?.(
          `wecom: pending reply sweep failed: ${String((err as Error)?.message || err)}`,
        );
      });
    return sweepPromise;
  }

  function flushSessionPendingReplies(
    opts: { mode?: string; accountId?: string; sessionId?: string } = {},
  ): Promise<void> {
    return ensurePersistenceLoaded()
      .then(() =>
        reliableDeliveryStore.listPendingRepliesForSession({
          mode: opts.mode ?? "agent",
          accountId: opts.accountId ?? "default",
          sessionId: opts.sessionId ?? "",
        }),
      )
      .then((entries) => {
        if (entries.length === 0) return;
        return flushEntries(entries, "session-inbound");
      })
      .then(() => {
        schedulePersistenceFlush("pending-session-flush");
      });
  }

  return {
    initialize,
    enqueuePendingReply,
    flushDuePendingReplies,
    flushSessionPendingReplies,
    ensureSweepTimer,
  };
}
