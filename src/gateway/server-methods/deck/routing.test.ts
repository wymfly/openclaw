import { createHash } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeBindingId } from "./utils.js";

// Helper to compute expected configHash the same way the handler does
function expectedConfigHash(bindings: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(bindings)).digest("hex").slice(0, 16);
}

// Mock the config and routing modules
const mockConfig = {
  bindings: [] as Array<{
    agentId: string;
    match: Record<string, unknown>;
    comment?: string;
  }>,
  agents: { list: [{ id: "main", name: "Main Agent", default: true }] },
  session: { dmScope: "per-peer", identityLinks: {} },
};

vi.mock("../../../config/config.js", () => ({
  loadConfig: () => mockConfig,
  writeConfigFile: vi.fn(async () => {}),
}));

vi.mock("../../../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: () => "main",
  resolveAgentConfig: (_cfg: unknown, agentId: string) => {
    if (agentId === "main") {
      return { name: "Main Agent" };
    }
    if (agentId === "support") {
      return { name: "Support Agent" };
    }
    return undefined;
  },
}));

vi.mock("../../../routing/resolve-route.js", () => ({
  resolveAgentRoute: (input: Record<string, unknown>) => ({
    agentId: "main",
    channel: input.channel,
    accountId: input.accountId ?? "default",
    sessionKey: `agent:main:${String(input.channel)}:direct:user1`,
    mainSessionKey: "agent:main:main",
    matchedBy: "default",
  }),
}));

// Import after mocks
const { deckRoutingHandlers } = await import("./routing.js");

function makeRespond() {
  const calls: Array<{ ok: boolean; payload?: unknown; error?: unknown }> = [];
  const fn = (ok: boolean, payload?: unknown, error?: unknown) => {
    calls.push({ ok, payload, error });
  };
  return { fn, calls };
}

function callHandler(method: string, params: Record<string, unknown>) {
  const handler = deckRoutingHandlers[method];
  if (!handler) {
    throw new Error(`Handler ${method} not found`);
  }
  const { fn, calls } = makeRespond();
  void handler({
    req: { type: "req" as const, id: "1", method, params },
    params,
    client: null as never,
    isWebchatConnect: () => false,
    respond: fn,
    context: {} as never,
  });
  return calls;
}

async function callHandlerAsync(method: string, params: Record<string, unknown>) {
  const handler = deckRoutingHandlers[method];
  if (!handler) {
    throw new Error(`Handler ${method} not found`);
  }
  const { fn, calls } = makeRespond();
  await handler({
    req: { type: "req" as const, id: "1", method, params },
    params,
    client: null,
    isWebchatConnect: () => false,
    respond: fn,
    context: {} as never,
  });
  return calls;
}

describe("deck.routing.list", () => {
  beforeEach(() => {
    mockConfig.bindings = [];
  });

  it("returns empty bindings when none configured", () => {
    const calls = callHandler("deck.routing.list", {});
    expect(calls).toHaveLength(1);
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as Record<string, unknown>;
    expect(payload.bindings).toEqual([]);
    expect(payload.defaultAgentId).toBe("main");
    expect(payload.configHash).toBe(expectedConfigHash([]));
  });

  it("returns bindings with computed tier and ID", () => {
    mockConfig.bindings = [
      { agentId: "support", match: { channel: "discord", peer: { kind: "direct", id: "user1" } } },
    ];
    const calls = callHandler("deck.routing.list", {});
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as {
      bindings: Array<{ id: string; tier: string; agentId: string }>;
    };
    expect(payload.bindings).toHaveLength(1);
    expect(payload.bindings[0].id).toHaveLength(12);
    expect(payload.bindings[0].tier).toBe("peer");
    expect(payload.bindings[0].agentId).toBe("support");
  });

  it("filters by agentId", () => {
    mockConfig.bindings = [
      { agentId: "main", match: { channel: "discord" } },
      { agentId: "support", match: { channel: "telegram" } },
    ];
    const calls = callHandler("deck.routing.list", { agentId: "support" });
    const payload = calls[0].payload as { bindings: Array<{ agentId: string }> };
    expect(payload.bindings).toHaveLength(1);
    expect(payload.bindings[0].agentId).toBe("support");
  });

  it("filters by channel", () => {
    mockConfig.bindings = [
      { agentId: "main", match: { channel: "discord" } },
      { agentId: "support", match: { channel: "telegram" } },
    ];
    const calls = callHandler("deck.routing.list", { channel: "telegram" });
    const payload = calls[0].payload as { bindings: Array<{ agentId: string }> };
    expect(payload.bindings).toHaveLength(1);
    expect(payload.bindings[0].agentId).toBe("support");
  });
});

describe("deck.routing.add", () => {
  beforeEach(() => {
    mockConfig.bindings = [];
  });

  it("adds a binding with valid baseHash", async () => {
    const emptyHash = expectedConfigHash([]);
    const calls = await callHandlerAsync("deck.routing.add", {
      agentId: "support",
      match: { channel: "discord", peer: { kind: "direct", id: "user1" } },
      baseHash: emptyHash,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as {
      ok: boolean;
      configHash: string;
      binding: { id: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.configHash).toBeTruthy();
    expect(payload.binding.id).toHaveLength(12);
  });

  it("rejects with stale baseHash", async () => {
    const calls = await callHandlerAsync("deck.routing.add", {
      agentId: "support",
      match: { channel: "discord" },
      baseHash: "stale-hash",
    });
    expect(calls[0].ok).toBe(false);
  });
});

describe("deck.routing.remove", () => {
  beforeEach(() => {
    mockConfig.bindings = [];
  });

  it("removes an existing binding by ID", async () => {
    const match = { channel: "discord", peer: { kind: "direct", id: "user1" } };
    const binding = { agentId: "support", match };
    mockConfig.bindings = [binding];
    const id = computeBindingId(match);
    const currentHash = expectedConfigHash([binding]);

    const calls = await callHandlerAsync("deck.routing.remove", {
      id,
      baseHash: currentHash,
    });
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as { removed: { id: string } };
    expect(payload.removed.id).toBe(id);
  });

  it("returns error for non-existent binding", async () => {
    const emptyHash = expectedConfigHash([]);
    const calls = await callHandlerAsync("deck.routing.remove", {
      id: "nonexistent1",
      baseHash: emptyHash,
    });
    expect(calls[0].ok).toBe(false);
  });
});

describe("deck.routing.validate", () => {
  beforeEach(() => {
    mockConfig.bindings = [];
  });

  it("validates clean binding with no conflicts", () => {
    const calls = callHandler("deck.routing.validate", {
      agentId: "support",
      match: { channel: "discord", peer: { kind: "direct", id: "user1" } },
    });
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as {
      ok: boolean;
      tier: string;
      conflicts: unknown[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.tier).toBe("peer");
    expect(payload.conflicts).toEqual([]);
  });

  it("detects overlap conflict for same match with different agent", () => {
    const match = { channel: "discord", peer: { kind: "direct", id: "user1" } };
    mockConfig.bindings = [{ agentId: "main", match }];

    const calls = callHandler("deck.routing.validate", {
      agentId: "support",
      match,
    });
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as {
      ok: boolean;
      conflicts: Array<{ type: string }>;
    };
    expect(payload.conflicts).toHaveLength(1);
    expect(payload.conflicts[0].type).toBe("overlap");
  });

  it("detects duplicate conflict for same match with same agent", () => {
    const match = { channel: "discord", peer: { kind: "direct", id: "user1" } };
    mockConfig.bindings = [{ agentId: "support", match }];

    const calls = callHandler("deck.routing.validate", {
      agentId: "support",
      match,
    });
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as {
      ok: boolean;
      conflicts: Array<{ type: string }>;
    };
    expect(payload.conflicts).toHaveLength(1);
    expect(payload.conflicts[0].type).toBe("duplicate");
  });
});

describe("deck.routing.simulate", () => {
  it("returns simulation result with tiers", () => {
    const calls = callHandler("deck.routing.simulate", {
      channel: "discord",
      peer: { kind: "direct", id: "user1" },
    });
    expect(calls[0].ok).toBe(true);
    const payload = calls[0].payload as {
      agentId: string;
      matchedBy: string;
      tiers: Array<{ tier: string; checked: boolean; matched: boolean }>;
    };
    expect(payload.agentId).toBe("main");
    expect(payload.matchedBy).toBe("default");
    expect(payload.tiers).toHaveLength(8);
    expect(payload.tiers.map((t) => t.tier)).toEqual([
      "peer",
      "peer.parent",
      "guild+roles",
      "guild",
      "team",
      "account",
      "channel",
      "default",
    ]);
    // Default tier is the match — all tiers checked, only default matched
    const defaultTier = payload.tiers.find((t) => t.tier === "default");
    expect(defaultTier?.matched).toBe(true);
    expect(defaultTier?.checked).toBe(true);
  });
});
