import { existsSync } from "node:fs";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPeerContexts,
  getAccountIdByContextToken,
  getAccountIdByPeer,
  getPeerContextByToken,
  getPeerContextToken,
  getRecentPeerForAccount,
  hasActiveSession,
  restorePeerContexts,
  setPeerContext,
} from "./context-store.js";

const touchedAccounts = new Set<string>();

let tempStateDir = "";
let originalStateDir: string | undefined;
let originalHome: string | undefined;

function trackAccount(accountId: string): string {
  touchedAccounts.add(accountId);
  return accountId;
}

function contextFilePath(accountId: string): string {
  return path.join(tempStateDir, "wecom", "context", `${accountId}.json`);
}

beforeEach(async () => {
  tempStateDir = await mkdtemp(path.join(os.tmpdir(), "wecom-context-store-"));
  originalStateDir = process.env.OPENCLAW_STATE_DIR;
  originalHome = process.env.HOME;
  process.env.OPENCLAW_STATE_DIR = tempStateDir;
  process.env.HOME = tempStateDir;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-03T10:00:00Z"));
});

afterEach(async () => {
  for (const accountId of touchedAccounts) {
    clearPeerContexts(accountId);
  }
  touchedAccounts.clear();
  if (originalStateDir === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = originalStateDir;
  }
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  vi.useRealTimers();
  await rm(tempStateDir, { recursive: true, force: true });
});

describe("context-store", () => {
  it("stores peer context and resolves token/account reverse lookups", () => {
    const accountId = trackAccount("acct-context-basic");
    const token = setPeerContext(accountId, "peer-1", {
      contextToken: "ctx-1",
      peerKind: "direct",
    });

    expect(token).toBe("ctx-1");
    expect(getPeerContextToken(accountId, "peer-1")).toBe("ctx-1");
    expect(getPeerContextByToken("ctx-1")).toMatchObject({
      accountId,
      peerId: "peer-1",
      peerKind: "direct",
    });
    expect(getAccountIdByContextToken("ctx-1")).toBe(accountId);
    expect(getAccountIdByPeer("peer-1")).toBe(accountId);
  });

  it("updates reverse indexes when a peer receives a new token", () => {
    const accountId = trackAccount("acct-context-update");
    setPeerContext(accountId, "peer-update", {
      contextToken: "ctx-old",
      peerKind: "direct",
    });
    setPeerContext(accountId, "peer-update", {
      contextToken: "ctx-new",
      peerKind: "direct",
    });

    expect(getPeerContextByToken("ctx-old")).toBeUndefined();
    expect(getPeerContextByToken("ctx-new")).toMatchObject({
      accountId,
      peerId: "peer-update",
    });
  });

  it("returns the most recent peer within the active TTL window", () => {
    const accountId = trackAccount("acct-context-recent");
    setPeerContext(accountId, "peer-older", {
      contextToken: "ctx-older",
      lastSeen: Date.now() - 5_000,
    });
    setPeerContext(accountId, "peer-newer", {
      contextToken: "ctx-newer",
      lastSeen: Date.now() - 500,
    });

    expect(getRecentPeerForAccount(accountId, 10_000)).toBe("peer-newer");
  });

  it("filters expired peers out of recent-peer lookups", () => {
    const accountId = trackAccount("acct-context-expired");
    setPeerContext(accountId, "peer-expired", {
      contextToken: "ctx-expired",
      lastSeen: Date.now() - 60_000,
    });

    expect(getRecentPeerForAccount(accountId, 5_000)).toBeUndefined();
  });

  it("distinguishes active and expired sessions", () => {
    const accountId = trackAccount("acct-context-active");
    setPeerContext(accountId, "peer-active", {
      contextToken: "ctx-active",
      lastSeen: Date.now() - 1_000,
    });
    setPeerContext(accountId, "peer-stale", {
      contextToken: "ctx-stale",
      lastSeen: Date.now() - 60_000,
    });

    expect(hasActiveSession(accountId, "peer-active", 5_000)).toBe(true);
    expect(hasActiveSession(accountId, "peer-stale", 5_000)).toBe(false);
  });

  it("persists context data to disk and clears both memory and file state", async () => {
    const accountId = trackAccount("acct-context-persist");
    setPeerContext(accountId, "peer-persist", {
      contextToken: "ctx-persist",
      peerKind: "group",
    });

    const filePath = contextFilePath(accountId);
    expect(existsSync(filePath)).toBe(true);

    clearPeerContexts(accountId);
    touchedAccounts.delete(accountId);

    expect(getPeerContextToken(accountId, "peer-persist")).toBeUndefined();
    expect(getPeerContextByToken("ctx-persist")).toBeUndefined();
    expect(getAccountIdByPeer("peer-persist")).toBeUndefined();
    await expect(access(filePath)).rejects.toThrow();
  });

  it("restores persisted peer contexts from disk", async () => {
    const accountId = trackAccount("acct-context-restore");
    const filePath = contextFilePath(accountId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      JSON.stringify({
        "peer-restored": {
          contextToken: "ctx-restored",
          peerKind: "group",
          lastSeen: Date.now() - 1_000,
        },
      }),
      "utf8",
    );

    restorePeerContexts(accountId);

    expect(getPeerContextToken(accountId, "peer-restored")).toBe("ctx-restored");
    expect(getPeerContextByToken("ctx-restored")).toMatchObject({
      accountId,
      peerId: "peer-restored",
      peerKind: "group",
    });
    expect(getRecentPeerForAccount(accountId, 10_000)).toBe("peer-restored");
  });

  it("generates a token automatically when one is not provided", () => {
    const accountId = trackAccount("acct-context-generated");
    const token = setPeerContext(accountId, "peer-generated", {
      peerKind: "direct",
    });

    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(getPeerContextByToken(token)).toMatchObject({
      accountId,
      peerId: "peer-generated",
    });
  });
});
