import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLoadConfig = vi.fn();
const mockReadConfigFileSnapshotForWrite = vi.fn();
const mockWriteConfigFile = vi.fn();
const mockResolveConfigSnapshotHash = vi.fn();

vi.mock("../../../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  readConfigFileSnapshotForWrite: (...args: unknown[]) =>
    mockReadConfigFileSnapshotForWrite(...args),
  writeConfigFile: (...args: unknown[]) => mockWriteConfigFile(...args),
  resolveConfigSnapshotHash: (...args: unknown[]) => mockResolveConfigSnapshotHash(...args),
}));

const mockLoadJsonFile = vi.fn();

vi.mock("../../../infra/json-file.js", () => ({
  loadJsonFile: (...args: unknown[]) => mockLoadJsonFile(...args),
}));

vi.mock("../../../config/paths.js", () => ({
  resolveStateDir: vi.fn(() => "/tmp/test-state"),
}));

import { deckIdentityHandlers } from "./identity.js";
import { deckThreadsHandlers } from "./threads.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

type RespondCall = [boolean, unknown?, { code: string; message: string }?];

function createInvoke(
  handlers: Record<string, (...args: unknown[]) => unknown>,
  method: string,
  params: Record<string, unknown>,
) {
  const respond = vi.fn();
  const handler = handlers[method];
  if (!handler) {
    throw new Error(`handler "${method}" not found`);
  }
  return {
    respond,
    invoke: async () =>
      await handler({
        params,
        respond: respond as never,
        context: {} as never,
        client: null,
        req: { type: "req" as const, id: "req-1", method },
        isWebchatConnect: () => false,
      }),
  };
}

function makeSnapshot(config: unknown, hash: string) {
  return {
    snapshot: { path: "/tmp/config.json", exists: true, raw: "{}", config, hash, valid: true },
    writeOptions: {},
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── deck.identity.list ───────────────────────────────────────────────────────

describe("deck.identity.list", () => {
  it("returns structured identity links from config", async () => {
    const config = {
      session: {
        identityLinks: {
          alice: ["telegram:123", "discord:456"],
        },
      },
    };
    mockLoadConfig.mockReturnValue(config);
    mockResolveConfigSnapshotHash.mockReturnValue("hash-abc");
    mockReadConfigFileSnapshotForWrite.mockResolvedValue(makeSnapshot(config, "hash-abc"));

    const { respond, invoke } = createInvoke(deckIdentityHandlers, "deck.identity.list", {});
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as {
      links: Array<{
        canonical: string;
        peers: Array<{ channel: string; peerId: string }>;
      }>;
      configHash: string;
    };
    expect(payload.links).toHaveLength(1);
    expect(payload.links[0]?.canonical).toBe("alice");
    expect(payload.links[0]?.peers).toEqual([
      { channel: "telegram", peerId: "123" },
      { channel: "discord", peerId: "456" },
    ]);
    expect(payload.configHash).toBe("hash-abc");
  });

  it("returns empty links when no identityLinks configured", async () => {
    mockLoadConfig.mockReturnValue({ session: {} });
    mockResolveConfigSnapshotHash.mockReturnValue("hash-empty");
    mockReadConfigFileSnapshotForWrite.mockResolvedValue(
      makeSnapshot({ session: {} }, "hash-empty"),
    );

    const { respond, invoke } = createInvoke(deckIdentityHandlers, "deck.identity.list", {});
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as { links: unknown[]; configHash: string };
    expect(payload.links).toEqual([]);
    expect(payload.configHash).toBe("hash-empty");
  });
});

// ── deck.identity.link ──────────────────────────────────────────────────────

describe("deck.identity.link", () => {
  it("adds a new peer to a canonical identity", async () => {
    const config = {
      session: {
        identityLinks: {
          alice: ["telegram:123"],
        },
      },
    };
    const snap = makeSnapshot(config, "hash-1");
    mockReadConfigFileSnapshotForWrite.mockResolvedValue(snap);
    mockResolveConfigSnapshotHash.mockReturnValue("hash-1");
    mockWriteConfigFile.mockResolvedValue(undefined);
    // After write, new hash returned by re-reading
    mockReadConfigFileSnapshotForWrite.mockResolvedValueOnce(snap);
    // Second call after write returns new hash
    const snap2 = makeSnapshot(
      { session: { identityLinks: { alice: ["telegram:123", "slack:U789"] } } },
      "hash-2",
    );
    mockReadConfigFileSnapshotForWrite.mockResolvedValueOnce(snap).mockResolvedValueOnce(snap2);
    mockResolveConfigSnapshotHash.mockReturnValueOnce("hash-1").mockReturnValueOnce("hash-2");

    const { respond, invoke } = createInvoke(deckIdentityHandlers, "deck.identity.link", {
      canonical: "alice",
      channel: "slack",
      peerId: "U789",
      baseHash: "hash-1",
    });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as { ok: boolean; configHash: string };
    expect(payload.ok).toBe(true);
    expect(typeof payload.configHash).toBe("string");

    // Verify writeConfigFile was called with updated links
    expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
    const writtenConfig = mockWriteConfigFile.mock.calls[0]?.[0] as {
      session: { identityLinks: Record<string, string[]> };
    };
    expect(writtenConfig.session.identityLinks.alice).toContain("slack:U789");
  });

  it("deduplicates when peer already exists", async () => {
    const config = {
      session: {
        identityLinks: {
          alice: ["telegram:123", "slack:U789"],
        },
      },
    };
    const snap = makeSnapshot(config, "hash-1");
    mockReadConfigFileSnapshotForWrite.mockResolvedValue(snap);
    mockResolveConfigSnapshotHash.mockReturnValue("hash-1");

    const { respond, invoke } = createInvoke(deckIdentityHandlers, "deck.identity.link", {
      canonical: "alice",
      channel: "slack",
      peerId: "U789",
      baseHash: "hash-1",
    });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as { ok: boolean };
    expect(payload.ok).toBe(true);

    // Should NOT call writeConfigFile since no change needed
    expect(mockWriteConfigFile).not.toHaveBeenCalled();
  });
});

// ── deck.identity.unlink ────────────────────────────────────────────────────

describe("deck.identity.unlink", () => {
  it("removes an existing peer from a canonical identity", async () => {
    const config = {
      session: {
        identityLinks: {
          alice: ["telegram:123", "discord:456"],
        },
      },
    };
    const snap = makeSnapshot(config, "hash-1");
    mockReadConfigFileSnapshotForWrite.mockResolvedValue(snap);
    mockResolveConfigSnapshotHash.mockReturnValue("hash-1");
    mockWriteConfigFile.mockResolvedValue(undefined);
    // After write
    mockResolveConfigSnapshotHash.mockReturnValueOnce("hash-1").mockReturnValueOnce("hash-3");
    const snap2 = makeSnapshot(
      { session: { identityLinks: { alice: ["discord:456"] } } },
      "hash-3",
    );
    mockReadConfigFileSnapshotForWrite.mockResolvedValueOnce(snap).mockResolvedValueOnce(snap2);

    const { respond, invoke } = createInvoke(deckIdentityHandlers, "deck.identity.unlink", {
      canonical: "alice",
      channel: "telegram",
      peerId: "123",
      baseHash: "hash-1",
    });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as { ok: boolean; configHash: string };
    expect(payload.ok).toBe(true);

    // Verify the written config had the entry removed
    expect(mockWriteConfigFile).toHaveBeenCalledTimes(1);
    const writtenConfig = mockWriteConfigFile.mock.calls[0]?.[0] as {
      session: { identityLinks: Record<string, string[]> };
    };
    expect(writtenConfig.session.identityLinks.alice).not.toContain("telegram:123");
    expect(writtenConfig.session.identityLinks.alice).toContain("discord:456");
  });
});

// ── deck.threads.list ────────────────────────────────────────────────────────

describe("deck.threads.list", () => {
  it("returns active Discord thread bindings from persistence file", async () => {
    mockLoadJsonFile.mockReturnValue({
      version: 1,
      bindings: {
        "srv:thread-001": {
          accountId: "srv",
          channelId: "ch-general",
          threadId: "thread-001",
          targetKind: "acp",
          targetSessionKey: "agent:main:discord:direct:user1",
          agentId: "main",
          boundBy: "user1",
          boundAt: 1710000000000,
          lastActivityAt: 1710000060000,
        },
        "srv:thread-002": {
          accountId: "srv",
          channelId: "ch-dev",
          threadId: "thread-002",
          targetKind: "subagent",
          targetSessionKey: "agent:coder:discord:channel:dev-help",
          agentId: "coder",
          boundBy: "system",
          boundAt: 1710000100000,
          lastActivityAt: 1710000200000,
        },
      },
    });

    const { respond, invoke } = createInvoke(deckThreadsHandlers, "deck.threads.list", {
      channel: "discord",
    });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as {
      threads: Array<{
        threadId: string;
        channelId: string;
        agentId: string;
        targetSessionKey: string;
        targetKind: string;
        boundAt: number;
        lastActivityAt: number;
      }>;
    };
    expect(payload.threads).toHaveLength(2);
    expect(payload.threads[0]?.threadId).toBe("thread-001");
    expect(payload.threads[0]?.agentId).toBe("main");
    expect(payload.threads[1]?.threadId).toBe("thread-002");
    expect(payload.threads[1]?.targetKind).toBe("subagent");
  });

  it("returns empty array for unsupported channel", async () => {
    const { respond, invoke } = createInvoke(deckThreadsHandlers, "deck.threads.list", {
      channel: "telegram",
    });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall;
    expect(call[0]).toBe(true);

    const payload = call[1] as { threads: unknown[] };
    expect(payload.threads).toEqual([]);
  });
});
