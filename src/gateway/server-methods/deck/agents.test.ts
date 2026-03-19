import { describe, expect, it, vi, beforeEach } from "vitest";

// --- Mocks must be hoisted above imports ---

const mockConfig = {
  agents: {
    defaults: {
      subagents: {
        maxSpawnDepth: 3,
        maxChildrenPerAgent: 5,
        thinking: "low",
        model: "openai/gpt-4o",
      },
    },
    list: [
      {
        id: "main",
        name: "Main Agent",
        default: true,
        workspace: "/tmp/main",
        model: "anthropic/claude-sonnet",
        // no skills field → mode "all"
        subagents: {
          allowAgents: ["coder", "researcher"],
          model: "anthropic/claude-haiku",
        },
      },
      {
        id: "coder",
        name: "Coder",
        workspace: "/tmp/coder",
        skills: ["python", "node"],
        // no subagents → empty
      },
      {
        id: "researcher",
        name: "Researcher",
        workspace: "/tmp/researcher",
        skills: [],
        subagents: {
          allowAgents: ["*"],
        },
      },
    ],
  },
  bindings: [
    { agentId: "main", match: { channel: "discord" } },
    { agentId: "main", match: { channel: "telegram" } },
    { agentId: "coder", match: { channel: "slack" } },
  ],
};

// Track what was written for write-operation tests
let writtenConfig: unknown = null;
let snapshotHash = "hash-abc123";

vi.mock("../../../config/config.js", () => ({
  loadConfig: () => structuredClone(mockConfig),
  readConfigFileSnapshotForWrite: async () => ({
    snapshot: {
      path: "/tmp/config.yaml",
      exists: true,
      raw: "raw",
      parsed: {},
      resolved: structuredClone(mockConfig),
      valid: true,
      config: structuredClone(mockConfig),
      hash: snapshotHash,
      issues: [],
      warnings: [],
      legacyIssues: [],
    },
    writeOptions: {},
  }),
  writeConfigFile: async (cfg: unknown) => {
    writtenConfig = cfg;
  },
  resolveConfigSnapshotHash: (snapshot: { hash?: string }) => snapshot.hash ?? null,
}));

// Mock skills-status to return a predictable skill list
vi.mock("../../../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: (_workspaceDir: string, _opts?: unknown) => ({
    workspaceDir: "/tmp/main",
    managedSkillsDir: "/tmp/skills",
    skills: [
      {
        name: "python",
        description: "Python support",
        skillKey: "python",
        eligible: true,
        bundled: true,
        disabled: false,
        blockedByAllowlist: false,
      },
      {
        name: "node",
        description: "Node.js support",
        skillKey: "node",
        eligible: true,
        bundled: true,
        disabled: false,
        blockedByAllowlist: false,
      },
      {
        name: "git",
        description: "Git operations",
        skillKey: "git",
        eligible: true,
        bundled: true,
        disabled: false,
        blockedByAllowlist: false,
      },
      {
        name: "docker",
        description: "Docker support",
        skillKey: "docker",
        eligible: false,
        bundled: true,
        disabled: false,
        blockedByAllowlist: false,
      },
    ],
  }),
}));

import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";
// Import after mocks
import { deckAgentsHandlers } from "./agents.js";

// Helper to call a handler and capture the response
function callHandler(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => {
      resolve({ ok, payload, error });
    };
    const handler = deckAgentsHandlers[method];
    if (!handler) {
      throw new Error(`Handler "${method}" not found`);
    }
    void handler({
      params,
      respond,
      req: { id: "1", method, params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
  });
}

beforeEach(() => {
  writtenConfig = null;
  snapshotHash = "hash-abc123";
});

// === Scenario 1: Get detail for agent with whitelist skills ===
describe("deck.agents.detail", () => {
  it("returns aggregated info for agent with whitelist skills", async () => {
    const result = await callHandler("deck.agents.detail", { agentId: "coder" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.id).toBe("coder");
    expect(p.name).toBe("Coder");
    expect(p.isDefault).toBe(false);
    expect(p.skillMode).toBe("whitelist");
    expect(p.effectiveSkills).toEqual(["python", "node"]);
    expect(p.totalAvailableSkills).toBe(4);
    // Coder has 1 binding (slack)
    expect(p.bindingCount).toBe(1);
    // Subagents: no per-agent config → effective from global defaults
    const sub = p.subagents as Record<string, unknown>;
    expect(sub.effectiveMaxSpawnDepth).toBe(3);
    expect(sub.effectiveMaxChildrenPerAgent).toBe(5);
    expect(sub.allowAgents).toEqual([]);
  });

  // === Scenario 2: Get detail for agent with no skill restriction ===
  it("returns all skills for agent with no skill restriction", async () => {
    const result = await callHandler("deck.agents.detail", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.id).toBe("main");
    expect(p.isDefault).toBe(true);
    expect(p.skillMode).toBe("all");
    // All 4 skill keys
    expect(p.effectiveSkills).toEqual(expect.arrayContaining(["python", "node", "git", "docker"]));
    expect((p.effectiveSkills as string[]).length).toBe(4);
    // Main has 2 bindings
    expect(p.bindingCount).toBe(2);
    // Subagents from per-agent config
    const sub = p.subagents as Record<string, unknown>;
    expect(sub.allowAgents).toEqual(["coder", "researcher"]);
    expect(sub.effectiveMaxSpawnDepth).toBe(3);
    expect(sub.effectiveMaxChildrenPerAgent).toBe(5);
  });

  it("returns error for unknown agent", async () => {
    const result = await callHandler("deck.agents.detail", { agentId: "nonexistent" });
    expect(result.ok).toBe(false);
  });
});

// === Scenario 3: Get skills for whitelist agent ===
describe("deck.agents.skills.get", () => {
  it("returns whitelist mode with assigned and available skills", async () => {
    const result = await callHandler("deck.agents.skills.get", { agentId: "coder" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("coder");
    expect(p.mode).toBe("whitelist");
    expect(p.skills).toEqual(["python", "node"]);
    expect(p.configHash).toBeTruthy();

    const available = p.available as Array<{
      key: string;
      name: string;
      eligible: boolean;
      assigned: boolean;
    }>;
    expect(available.length).toBe(4);
    const pythonEntry = available.find((a) => a.key === "python");
    expect(pythonEntry?.assigned).toBe(true);
    expect(pythonEntry?.eligible).toBe(true);
    const dockerEntry = available.find((a) => a.key === "docker");
    expect(dockerEntry?.assigned).toBe(false);
    expect(dockerEntry?.eligible).toBe(false);
  });

  it("returns all mode for agent without skills field", async () => {
    const result = await callHandler("deck.agents.skills.get", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.mode).toBe("all");
    // skills array is empty when mode is "all"
    expect(p.skills).toEqual([]);
  });
});

// === Scenario 4: Switch agent to whitelist mode ===
// === Scenario 5: Switch agent to all-skills mode ===
describe("deck.agents.skills.set", () => {
  it("writes whitelist skills to agent config", async () => {
    const result = await callHandler("deck.agents.skills.set", {
      agentId: "main",
      mode: "whitelist",
      skills: ["python", "git"],
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("main");
    expect(p.mode).toBe("whitelist");
    expect(p.skills).toEqual(["python", "git"]);
    expect(p.configHash).toBeTruthy();

    // Verify written config
    expect(writtenConfig).toBeTruthy();
    const written = writtenConfig as typeof mockConfig;
    const mainAgent = written.agents.list.find((a) => a.id === "main");
    expect(mainAgent?.skills).toEqual(["python", "git"]);
  });

  it("removes skills field when mode is all", async () => {
    const result = await callHandler("deck.agents.skills.set", {
      agentId: "coder",
      mode: "all",
      skills: [],
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.mode).toBe("all");
    expect(p.skills).toEqual([]);

    const written = writtenConfig as typeof mockConfig;
    const coderAgent = written.agents.list.find((a) => a.id === "coder");
    expect(coderAgent?.skills).toBeUndefined();
  });

  it("rejects on baseHash mismatch", async () => {
    const result = await callHandler("deck.agents.skills.set", {
      agentId: "main",
      mode: "whitelist",
      skills: ["python"],
      baseHash: "wrong-hash",
    });
    expect(result.ok).toBe(false);
    expect(writtenConfig).toBeNull();
  });
});

// === Scenario 6: Get subagent config ===
describe("deck.agents.subagents.get", () => {
  it("returns subagent config with effective defaults", async () => {
    const result = await callHandler("deck.agents.subagents.get", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("main");
    expect(p.allowAgents).toEqual(["coder", "researcher"]);
    expect(p.allowAny).toBe(false);
    expect(p.model).toBe("anthropic/claude-haiku");
    expect(p.effectiveMaxSpawnDepth).toBe(3);
    expect(p.effectiveMaxChildrenPerAgent).toBe(5);
    expect(p.effectiveThinking).toBe("low");
    expect(p.configHash).toBeTruthy();

    const allowed = p.allowedAgents as Array<{ id: string; name?: string }>;
    expect(allowed).toEqual([
      { id: "coder", name: "Coder" },
      { id: "researcher", name: "Researcher" },
    ]);

    const all = p.allAgents as Array<{ id: string; name?: string }>;
    expect(all.length).toBe(3);
  });

  it("returns allowAny=true for wildcard agent", async () => {
    const result = await callHandler("deck.agents.subagents.get", { agentId: "researcher" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.allowAgents).toEqual(["*"]);
    expect(p.allowAny).toBe(true);
  });
});

// === Scenario 7: Set allowed agents + ignore global limits ===
describe("deck.agents.subagents.set", () => {
  it("writes allowAgents and model to per-agent config", async () => {
    const result = await callHandler("deck.agents.subagents.set", {
      agentId: "main",
      allowAgents: ["coder"],
      model: "openai/gpt-4o-mini",
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("main");
    expect(p.allowAgents).toEqual(["coder"]);
    expect(p.model).toBe("openai/gpt-4o-mini");
    expect(p.configHash).toBeTruthy();

    const written = writtenConfig as typeof mockConfig;
    const mainAgent = written.agents.list.find((a) => a.id === "main");
    expect(mainAgent?.subagents?.allowAgents).toEqual(["coder"]);
    expect(mainAgent?.subagents?.model).toBe("openai/gpt-4o-mini");
    // Global defaults must NOT be written to per-agent config
    expect((mainAgent?.subagents as Record<string, unknown>)?.maxSpawnDepth).toBeUndefined();
    expect((mainAgent?.subagents as Record<string, unknown>)?.maxChildrenPerAgent).toBeUndefined();
    expect((mainAgent?.subagents as Record<string, unknown>)?.thinking).toBeUndefined();
  });

  it("clears model when null is passed", async () => {
    const result = await callHandler("deck.agents.subagents.set", {
      agentId: "main",
      allowAgents: ["coder"],
      model: null,
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.model).toBeUndefined();

    const written = writtenConfig as typeof mockConfig;
    const mainAgent = written.agents.list.find((a) => a.id === "main");
    expect(mainAgent?.subagents?.model).toBeUndefined();
  });

  it("rejects on baseHash mismatch", async () => {
    const result = await callHandler("deck.agents.subagents.set", {
      agentId: "main",
      allowAgents: ["coder"],
      baseHash: "wrong-hash",
    });
    expect(result.ok).toBe(false);
    expect(writtenConfig).toBeNull();
  });
});
