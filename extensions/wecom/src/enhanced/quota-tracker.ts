/**
 * WeCom quota tracking — TypeScript port of @sunnoy/wecom runtime-telemetry.js.
 *
 * Tracks per-account, per-chat quotas for:
 * - Passive reply: 30 replies within 24h of last inbound message
 * - Active send: 10 proactive messages per UTC calendar day
 *
 * All state is in-memory. No external dependencies.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACTIVE_SEND_LIMIT = 10;
export const ACTIVE_SEND_WARN_THRESHOLD = 8;
export const REPLY_LIMIT = 30;
export const REPLY_WARN_THRESHOLD = 24;
const MAX_TRACKED_CHATS_PER_ACCOUNT = 500;

// ── Types ──

export interface QuotaSnapshot {
  bucket: "reply24h" | "activeDaily";
  limit: number;
  windowActive: boolean;
  used: number;
  remaining: number;
  exhausted: boolean;
  nearLimit: boolean;
}

interface ChatState {
  chatId: string;
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  lastTouchedAt: number;
  replyCount24h: number;
  activeSendDay: string;
  activeSendCountToday: number;
}

interface AccountState {
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  displaced: boolean;
  lastDisplacedAt: number | null;
  lastDisplacedReason: string | null;
  chats: Map<string, ChatState>;
}

export interface AccountTelemetry {
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  connection: {
    displaced: boolean;
    lastDisplacedAt: number | null;
    lastDisplacedReason: string | null;
  };
  quotas: {
    trackedChats: number;
    replyWindowChats: number;
    totalReplyCount24h: number;
    nearLimitReplyChats: number;
    exhaustedReplyChats: number;
    activeDailyChats: number;
    totalActiveSendCountToday: number;
    nearLimitActiveChats: number;
    exhaustedActiveChats: number;
  };
}

export interface QuotaTracker {
  forecastReplyQuota(params: { accountId: string; chatId: string; at?: number }): QuotaSnapshot;
  forecastActiveSendQuota(params: {
    accountId: string;
    chatId: string;
    at?: number;
  }): QuotaSnapshot;
  recordInboundMessage(params: { accountId: string; chatId: string; at?: number }): void;
  recordPassiveReply(params: {
    accountId: string;
    chatId: string;
    at?: number;
    countQuota?: boolean;
  }): QuotaSnapshot;
  recordActiveSend(params: { accountId: string; chatId: string; at?: number }): QuotaSnapshot;
  recordOutboundActivity(params: { accountId: string; at?: number }): void;
  markAccountDisplaced(params: { accountId: string; reason?: string | null; at?: number }): void;
  clearAccountDisplaced(accountId: string): void;
  getAccountTelemetry(accountId: string, options?: { now?: number }): AccountTelemetry;
  reset(): void;
}

// ── Helpers ──

function currentDayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function pruneChatState(chatState: ChatState, at: number): void {
  const dayKey = currentDayKey(at);
  if (chatState.activeSendDay !== dayKey) {
    chatState.activeSendDay = dayKey;
    chatState.activeSendCountToday = 0;
  }
  if (!chatState.lastInboundAt || at - chatState.lastInboundAt >= DAY_MS) {
    chatState.replyCount24h = 0;
  }
}

function touchChatState(chatState: ChatState, at: number): void {
  chatState.lastTouchedAt = Math.max(chatState.lastTouchedAt ?? 0, at);
}

function describeReplyQuota(chatState: ChatState, at: number): QuotaSnapshot {
  pruneChatState(chatState, at);
  const windowActive = Boolean(chatState.lastInboundAt && at - chatState.lastInboundAt < DAY_MS);
  const used = windowActive ? chatState.replyCount24h : 0;
  const remaining = windowActive ? Math.max(0, REPLY_LIMIT - used) : REPLY_LIMIT;
  return {
    bucket: "reply24h",
    limit: REPLY_LIMIT,
    windowActive,
    used,
    remaining,
    exhausted: windowActive && used >= REPLY_LIMIT,
    nearLimit: windowActive && used >= REPLY_WARN_THRESHOLD,
  };
}

function describeActiveQuota(chatState: ChatState, at: number): QuotaSnapshot {
  pruneChatState(chatState, at);
  const used = chatState.activeSendCountToday;
  return {
    bucket: "activeDaily",
    limit: ACTIVE_SEND_LIMIT,
    windowActive: false,
    used,
    remaining: Math.max(0, ACTIVE_SEND_LIMIT - used),
    exhausted: used >= ACTIVE_SEND_LIMIT,
    nearLimit: used >= ACTIVE_SEND_WARN_THRESHOLD,
  };
}

// ── Factory ──

export function createQuotaTracker(): QuotaTracker {
  const accountStates = new Map<string, AccountState>();

  function ensureAccountState(accountId: string): AccountState {
    let state = accountStates.get(accountId);
    if (!state) {
      state = {
        lastInboundAt: null,
        lastOutboundAt: null,
        displaced: false,
        lastDisplacedAt: null,
        lastDisplacedReason: null,
        chats: new Map(),
      };
      accountStates.set(accountId, state);
    }
    return state;
  }

  function ensureChatState(accountState: AccountState, chatId: string): ChatState | null {
    const normalizedChatId = String(chatId ?? "").trim();
    if (!normalizedChatId) return null;

    let chatState = accountState.chats.get(normalizedChatId);
    if (!chatState) {
      chatState = {
        chatId: normalizedChatId,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastTouchedAt: 0,
        replyCount24h: 0,
        activeSendDay: currentDayKey(Date.now()),
        activeSendCountToday: 0,
      };
      accountState.chats.set(normalizedChatId, chatState);
    }
    return chatState;
  }

  function pruneAccountState(accountState: AccountState, at: number): void {
    for (const [chatId, chatState] of accountState.chats.entries()) {
      pruneChatState(chatState, at);

      const lastRelevantAt = Math.max(
        chatState.lastTouchedAt ?? 0,
        chatState.lastInboundAt ?? 0,
        chatState.lastOutboundAt ?? 0,
      );
      const hasReplyWindow =
        chatState.lastInboundAt !== null && at - chatState.lastInboundAt < DAY_MS;
      const hasDailyQuotaState = chatState.activeSendCountToday > 0;
      if (
        !hasReplyWindow &&
        !hasDailyQuotaState &&
        lastRelevantAt > 0 &&
        at - lastRelevantAt >= DAY_MS
      ) {
        accountState.chats.delete(chatId);
      }
    }

    if (accountState.chats.size <= MAX_TRACKED_CHATS_PER_ACCOUNT) return;

    const oldestFirst = [...accountState.chats.entries()].sort(
      (a, b) => (a[1].lastTouchedAt ?? 0) - (b[1].lastTouchedAt ?? 0),
    );
    const excess = accountState.chats.size - MAX_TRACKED_CHATS_PER_ACCOUNT;
    for (const [chatId] of oldestFirst.slice(0, excess)) {
      accountState.chats.delete(chatId);
    }
  }

  const EMPTY_REPLY_QUOTA: QuotaSnapshot = {
    bucket: "reply24h",
    limit: REPLY_LIMIT,
    windowActive: false,
    used: 0,
    remaining: REPLY_LIMIT,
    exhausted: false,
    nearLimit: false,
  };

  const EMPTY_ACTIVE_QUOTA: QuotaSnapshot = {
    bucket: "activeDaily",
    limit: ACTIVE_SEND_LIMIT,
    windowActive: false,
    used: 0,
    remaining: ACTIVE_SEND_LIMIT,
    exhausted: false,
    nearLimit: false,
  };

  return {
    forecastReplyQuota({ accountId, chatId, at = Date.now() }) {
      const accountState = ensureAccountState(accountId);
      const chatState = ensureChatState(accountState, chatId);
      if (!chatState) return { ...EMPTY_REPLY_QUOTA };
      return describeReplyQuota(chatState, at);
    },

    forecastActiveSendQuota({ accountId, chatId, at = Date.now() }) {
      const accountState = ensureAccountState(accountId);
      const chatState = ensureChatState(accountState, chatId);
      if (!chatState) return { ...EMPTY_ACTIVE_QUOTA };

      const replyQuota = describeReplyQuota(chatState, at);
      if (replyQuota.windowActive && !replyQuota.exhausted) {
        return replyQuota;
      }
      return describeActiveQuota(chatState, at);
    },

    recordInboundMessage({ accountId, chatId, at = Date.now() }) {
      const accountState = ensureAccountState(accountId);
      accountState.lastInboundAt = at;

      const chatState = ensureChatState(accountState, chatId);
      if (!chatState) return;

      chatState.lastInboundAt = at;
      chatState.replyCount24h = 0;
      touchChatState(chatState, at);
      pruneAccountState(accountState, at);
    },

    recordPassiveReply({ accountId, chatId, at = Date.now(), countQuota = true }) {
      const accountState = ensureAccountState(accountId);
      accountState.lastOutboundAt = at;

      const chatState = ensureChatState(accountState, chatId);
      if (!chatState) return { ...EMPTY_REPLY_QUOTA };

      chatState.lastOutboundAt = at;
      touchChatState(chatState, at);
      const quota = describeReplyQuota(chatState, at);
      if (countQuota && quota.windowActive) {
        chatState.replyCount24h += 1;
      }
      pruneAccountState(accountState, at);
      return describeReplyQuota(chatState, at);
    },

    recordActiveSend({ accountId, chatId, at = Date.now() }) {
      const accountState = ensureAccountState(accountId);
      accountState.lastOutboundAt = at;

      const chatState = ensureChatState(accountState, chatId);
      if (!chatState) return { ...EMPTY_ACTIVE_QUOTA };

      chatState.lastOutboundAt = at;
      touchChatState(chatState, at);

      const quota = this.forecastActiveSendQuota({ accountId, chatId, at });
      if (quota.bucket === "reply24h" && quota.windowActive) {
        chatState.replyCount24h += 1;
      } else {
        pruneChatState(chatState, at);
        chatState.activeSendCountToday += 1;
      }
      pruneAccountState(accountState, at);
      return this.forecastActiveSendQuota({ accountId, chatId, at });
    },

    recordOutboundActivity({ accountId, at = Date.now() }) {
      const accountState = ensureAccountState(accountId);
      accountState.lastOutboundAt = at;
    },

    markAccountDisplaced({ accountId, reason = null, at = Date.now() }) {
      const accountState = ensureAccountState(accountId);
      accountState.displaced = true;
      accountState.lastDisplacedAt = at;
      accountState.lastDisplacedReason = reason ? String(reason) : null;
    },

    clearAccountDisplaced(accountId) {
      const accountState = ensureAccountState(accountId);
      accountState.displaced = false;
    },

    getAccountTelemetry(accountId, { now = Date.now() } = {}) {
      const accountState = accountStates.get(accountId);
      if (!accountState) {
        return {
          lastInboundAt: null,
          lastOutboundAt: null,
          connection: { displaced: false, lastDisplacedAt: null, lastDisplacedReason: null },
          quotas: {
            trackedChats: 0,
            replyWindowChats: 0,
            totalReplyCount24h: 0,
            nearLimitReplyChats: 0,
            exhaustedReplyChats: 0,
            activeDailyChats: 0,
            totalActiveSendCountToday: 0,
            nearLimitActiveChats: 0,
            exhaustedActiveChats: 0,
          },
        };
      }

      pruneAccountState(accountState, now);

      const summary = {
        trackedChats: 0,
        replyWindowChats: 0,
        totalReplyCount24h: 0,
        nearLimitReplyChats: 0,
        exhaustedReplyChats: 0,
        activeDailyChats: 0,
        totalActiveSendCountToday: 0,
        nearLimitActiveChats: 0,
        exhaustedActiveChats: 0,
      };

      for (const chatState of accountState.chats.values()) {
        summary.trackedChats += 1;

        const replyQuota = describeReplyQuota(chatState, now);
        if (replyQuota.windowActive) {
          summary.replyWindowChats += 1;
          summary.totalReplyCount24h += replyQuota.used;
          if (replyQuota.exhausted) {
            summary.exhaustedReplyChats += 1;
          } else if (replyQuota.nearLimit) {
            summary.nearLimitReplyChats += 1;
          }
        }

        const activeQuota = describeActiveQuota(chatState, now);
        if (activeQuota.used > 0) {
          summary.activeDailyChats += 1;
          summary.totalActiveSendCountToday += activeQuota.used;
          if (activeQuota.exhausted) {
            summary.exhaustedActiveChats += 1;
          } else if (activeQuota.nearLimit) {
            summary.nearLimitActiveChats += 1;
          }
        }
      }

      return {
        lastInboundAt: accountState.lastInboundAt,
        lastOutboundAt: accountState.lastOutboundAt,
        connection: {
          displaced: accountState.displaced,
          lastDisplacedAt: accountState.lastDisplacedAt,
          lastDisplacedReason: accountState.lastDisplacedReason,
        },
        quotas: summary,
      };
    },

    reset() {
      accountStates.clear();
    },
  };
}
