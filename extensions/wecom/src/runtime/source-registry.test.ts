import { afterEach, describe, expect, it } from "vitest";
import {
  clearWecomSourceAccount,
  isWecomAgentSource,
  isWecomBotWsSource,
  registerWecomSourceSnapshot,
  resolveWecomSourceSnapshot,
} from "./source-registry.js";

const touchedAccounts = new Set<string>();

function trackAccount(accountId: string): string {
  const normalized = accountId.trim();
  if (normalized) {
    touchedAccounts.add(normalized);
  }
  return normalized;
}

function register(params: Parameters<typeof registerWecomSourceSnapshot>[0]): void {
  trackAccount(params.accountId);
  registerWecomSourceSnapshot(params);
}

afterEach(() => {
  for (const accountId of touchedAccounts) {
    clearWecomSourceAccount(accountId);
  }
  touchedAccounts.clear();
});

describe("source-registry", () => {
  it("registers and resolves a snapshot by account-scoped sessionKey", () => {
    register({
      accountId: "acct-session-key",
      source: "bot-ws",
      sessionKey: "session-key-1",
    });

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-session-key",
        sessionKey: "session-key-1",
      }),
    ).toMatchObject({
      accountId: "acct-session-key",
      source: "bot-ws",
      sessionKey: "session-key-1",
    });
  });

  it("resolves a snapshot by account-scoped sessionId", () => {
    register({
      accountId: "acct-session-id",
      source: "agent-callback",
      sessionId: "session-id-1",
    });

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-session-id",
        sessionId: "session-id-1",
      }),
    ).toMatchObject({
      accountId: "acct-session-id",
      source: "agent-callback",
      sessionId: "session-id-1",
    });
  });

  it("resolves a conversation snapshot by account-scoped peer lookup", () => {
    register({
      accountId: "acct-conversation",
      source: "bot-ws",
      peerKind: "group",
      peerId: "WR-123",
    });

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-conversation",
        peerKind: "group",
        peerId: "wr-123",
      }),
    ).toMatchObject({
      accountId: "acct-conversation",
      source: "bot-ws",
      peerKind: "group",
      peerId: "wr-123",
    });
  });

  it("falls back to loose conversation lookup when accountId is omitted", () => {
    register({
      accountId: "acct-loose-peer",
      source: "agent-callback",
      peerKind: "direct",
      peerId: "User-42",
    });

    expect(
      resolveWecomSourceSnapshot({
        peerKind: "direct",
        peerId: "user-42",
      }),
    ).toMatchObject({
      accountId: "acct-loose-peer",
      source: "agent-callback",
      peerKind: "direct",
      peerId: "user-42",
    });
  });

  it("prefers account-scoped snapshots over loose session fallback", () => {
    register({
      accountId: "acct-priority-a",
      source: "agent-callback",
      sessionKey: "shared-session",
    });
    register({
      accountId: "acct-priority-b",
      source: "bot-ws",
      sessionKey: "shared-session",
    });

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-priority-a",
        sessionKey: "shared-session",
      })?.source,
    ).toBe("agent-callback");
    expect(resolveWecomSourceSnapshot({ sessionKey: "shared-session" })?.source).toBe("bot-ws");
  });

  it("normalizes whitespace and case for account/session/peer fields", () => {
    register({
      accountId: "  acct-normalized  ",
      source: "bot-ws",
      sessionKey: "  sess-normalized  ",
      peerKind: "GROUP" as "group",
      peerId: "  WR-ABC  ",
    });

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-normalized",
        sessionKey: "sess-normalized",
      }),
    ).toMatchObject({
      accountId: "acct-normalized",
      sessionKey: "sess-normalized",
    });
    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-normalized",
        peerKind: "group",
        peerId: "wr-abc",
      }),
    ).toMatchObject({
      peerKind: "group",
      peerId: "wr-abc",
    });
  });

  it("ignores registrations with an empty accountId", () => {
    register({
      accountId: "   ",
      source: "bot-ws",
      sessionKey: "ignored-session",
    });

    expect(resolveWecomSourceSnapshot({ sessionKey: "ignored-session" })).toBeUndefined();
  });

  it("clears all indexed snapshots for one account without affecting another", () => {
    register({
      accountId: "acct-clear-a",
      source: "bot-ws",
      sessionKey: "clear-session-a",
      peerKind: "group",
      peerId: "group-a",
    });
    register({
      accountId: "acct-clear-b",
      source: "agent-callback",
      sessionKey: "clear-session-b",
      peerKind: "group",
      peerId: "group-b",
    });

    clearWecomSourceAccount("acct-clear-a");
    touchedAccounts.delete("acct-clear-a");

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-clear-a",
        sessionKey: "clear-session-a",
      }),
    ).toBeUndefined();
    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-clear-a",
        peerKind: "group",
        peerId: "group-a",
      }),
    ).toBeUndefined();
    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-clear-b",
        sessionKey: "clear-session-b",
      })?.source,
    ).toBe("agent-callback");
  });

  it("exposes helper predicates for bot-ws and agent-callback sources", () => {
    register({
      accountId: "acct-helper",
      source: "agent-callback",
      sessionId: "helper-session",
    });

    expect(isWecomAgentSource({ accountId: "acct-helper", sessionId: "helper-session" })).toBe(
      true,
    );
    expect(isWecomBotWsSource({ accountId: "acct-helper", sessionId: "helper-session" })).toBe(
      false,
    );
  });

  it("keeps account-scoped lookups isolated across accounts that share peer ids", () => {
    register({
      accountId: "acct-isolated-a",
      source: "bot-ws",
      peerKind: "direct",
      peerId: "shared-user",
    });
    register({
      accountId: "acct-isolated-b",
      source: "agent-callback",
      peerKind: "direct",
      peerId: "shared-user",
    });

    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-isolated-a",
        peerKind: "direct",
        peerId: "shared-user",
      })?.source,
    ).toBe("bot-ws");
    expect(
      resolveWecomSourceSnapshot({
        accountId: "acct-isolated-b",
        peerKind: "direct",
        peerId: "shared-user",
      })?.source,
    ).toBe("agent-callback");
  });

  it("prunes the oldest session snapshots when the session index exceeds its cap", () => {
    const accountId = trackAccount("acct-session-lru");

    for (let i = 0; i < 2050; i += 1) {
      registerWecomSourceSnapshot({
        accountId,
        source: "bot-ws",
        sessionKey: `session-${i}`,
      });
    }

    expect(
      resolveWecomSourceSnapshot({
        accountId,
        sessionKey: "session-0",
      }),
    ).toBeUndefined();
    expect(
      resolveWecomSourceSnapshot({
        accountId,
        sessionKey: "session-1",
      }),
    ).toBeUndefined();
    expect(
      resolveWecomSourceSnapshot({
        accountId,
        sessionKey: "session-2049",
      }),
    ).toMatchObject({
      accountId,
      sessionKey: "session-2049",
    });
  });
});
