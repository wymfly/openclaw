import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OpenClawConfig } from "../../../config/types.js";

// --- Mocks must be hoisted above imports ---

const defaultMockConfig = {
  agents: {
    defaults: {
      reasoningDefault: "on",
      fastModeDefault: true,
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
        reasoningDefault: "stream",
        fastModeDefault: false,
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
        channels: {
          eventStreams: ["lifecycle"],
        },
      },
    ],
  },
  bindings: [
    { agentId: "main", match: { channel: "discord" } },
    { agentId: "main", match: { channel: "telegram" } },
    { agentId: "coder", match: { channel: "slack" } },
  ],
} satisfies OpenClawConfig;

let mockConfig: OpenClawConfig = structuredClone(defaultMockConfig);

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
      req: { type: "req" as const, id: "1", method, params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
  });
}

beforeEach(() => {
  mockConfig = structuredClone(defaultMockConfig);
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
    expect(p.reasoningDefault).toBe("stream");
    expect(p.fastModeDefault).toBe(false);
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
    expect(p.reasoningDefault).toBe("on");
    expect(p.fastModeDefault).toBe(true);
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

  it("returns default-backed detail when agents.list is empty", async () => {
    mockConfig = {
      agents: {
        defaults: {
          workspace: "/tmp/default-agent",
          model: "openai/gpt-5.4",
          reasoningDefault: "stream",
          fastModeDefault: false,
          skills: ["python"],
          subagents: {
            allowAgents: ["*"],
            maxSpawnDepth: 2,
            maxChildrenPerAgent: 6,
          },
          channels: {
            eventStreams: ["assistant"],
          },
        },
        list: [],
      },
      bindings: [],
    } satisfies OpenClawConfig;

    const result = await callHandler("deck.agents.detail", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.id).toBe("main");
    expect(p.name).toBe("main");
    expect(p.workspace).toBe("/tmp/default-agent");
    expect(p.model).toBe("openai/gpt-5.4");
    expect(p.isDefault).toBe(true);
    expect(p.skillMode).toBe("whitelist");
    expect(p.effectiveSkills).toEqual(["python"]);
    expect(p.subagents).toMatchObject({
      allowAgents: ["*"],
      effectiveMaxSpawnDepth: 2,
      effectiveMaxChildrenPerAgent: 6,
    });

    const skills = await callHandler("deck.agents.skills.get", { agentId: "main" });
    expect(skills.ok).toBe(true);
    expect((skills.payload as Record<string, unknown>).mode).toBe("whitelist");

    const eventStreams = await callHandler("deck.agents.eventStreams.get", { agentId: "main" });
    expect(eventStreams.ok).toBe(true);
    expect((eventStreams.payload as Record<string, unknown>).eventStreams).toEqual(["assistant"]);
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
    const written = writtenConfig as typeof defaultMockConfig;
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

    const written = writtenConfig as typeof defaultMockConfig;
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

    const written = writtenConfig as typeof defaultMockConfig;
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

    const written = writtenConfig as typeof defaultMockConfig;
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

// === Scenario 8: Get eventStreams ===
describe("deck.agents.eventStreams.get", () => {
  it("returns agent-level eventStreams when configured", async () => {
    const result = await callHandler("deck.agents.eventStreams.get", { agentId: "researcher" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("researcher");
    expect(p.eventStreams).toEqual(["lifecycle"]);
    expect(p.isDefault).toBe(false);
    expect(p.configHash).toBeTruthy();
  });

  it("returns DEFAULT_EVENT_STREAMS when not configured", async () => {
    const result = await callHandler("deck.agents.eventStreams.get", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("main");
    // No agent-level or defaults-level eventStreams → falls back to DEFAULT_EVENT_STREAMS
    expect(p.eventStreams).toEqual(["lifecycle", "assistant"]);
    expect(p.isDefault).toBe(true);
    expect(p.configHash).toBeTruthy();
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.eventStreams.get", { agentId: "nonexistent" });
    expect(result.ok).toBe(false);
  });
});

describe("deck.agents.modelPolicy.get", () => {
  it("returns normalized global and per-agent model policy", async () => {
    mockConfig = {
      models: {
        providers: {
          openai: {
            models: [
              { id: "gpt-5.4", name: "GPT 5.4" },
              { id: "gpt-image-1", name: "GPT Image" },
            ],
          },
          anthropic: {
            models: [{ id: "claude-sonnet-4-6", name: "Claude Sonnet" }],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5.4",
            fallbacks: ["anthropic/claude-sonnet-4-6"],
          },
          imageModel: "openai/gpt-image-1",
          compaction: { model: "anthropic/claude-sonnet-4-6" },
          memorySearch: { model: "missing/embedding-model" },
          subagents: { model: { primary: "anthropic/claude-sonnet-4-6" } },
        },
        list: [
          {
            id: "main",
            name: "Main Agent",
            workspace: "/tmp/main",
            model: {
              primary: "openai/gpt-5.4",
              fallbacks: ["missing/provider-model"],
            },
          },
        ],
      },
    } satisfies OpenClawConfig;

    const result = await callHandler("deck.agents.modelPolicy.get", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      configuredModels: Array<{ ref: string }>;
      policies: Array<{
        key: string;
        kind: string;
        supportedShape: string;
        source: string;
        selection?: { primary?: string; fallbacks?: string[] };
        effective?: { primary?: string; fallbacks?: string[] };
        unavailableRefs: string[];
      }>;
      unsupported: Array<{ key: string }>;
    };
    expect(p.configuredModels.map((entry) => entry.ref)).toEqual(
      expect.arrayContaining(["openai/gpt-5.4", "openai/gpt-image-1"]),
    );
    const textDefault = p.policies.find(
      (policy) => policy.kind === "global-default" && policy.key === "text",
    );
    expect(textDefault?.selection).toEqual({
      primary: "openai/gpt-5.4",
      fallbacks: ["anthropic/claude-sonnet-4-6"],
    });
    const compaction = p.policies.find((policy) => policy.key === "compaction");
    expect(compaction?.supportedShape).toBe("string");
    expect(compaction?.selection).toEqual({ primary: "anthropic/claude-sonnet-4-6" });
    const mainPolicy = p.policies.find((policy) => policy.kind === "agent-model");
    expect(mainPolicy?.source).toBe("agent");
    expect(mainPolicy?.selection?.fallbacks).toEqual(["missing/provider-model"]);
    expect(mainPolicy?.unavailableRefs).toEqual(["missing/provider-model"]);
    const memorySearch = p.policies.find((policy) => policy.key === "memorySearch");
    expect(memorySearch?.unavailableRefs).toEqual(["missing/embedding-model"]);
  });

  it("reports unsupported legacy summary policy if it exists", async () => {
    mockConfig = {
      agents: {
        defaults: {
          summaryModel: "openai/gpt-5.4",
        },
        list: [],
      },
    } as OpenClawConfig;

    const result = await callHandler("deck.agents.modelPolicy.get", {});
    expect(result.ok).toBe(true);
    const p = result.payload as { unsupported: Array<{ key: string; configPath: string }> };
    expect(p.unsupported).toContainEqual({
      key: "summary",
      configPath: "agents.defaults.summaryModel",
      reason: "Current OpenClaw schema truth does not define agents.defaults.summaryModel.",
    });
  });
});

describe("deck.agents.modelPolicy.set", () => {
  it("writes per-agent primary and fallback policy", async () => {
    const result = await callHandler("deck.agents.modelPolicy.set", {
      target: { kind: "agent-model", key: "agent", agentId: "main" },
      selection: {
        primary: "openai/gpt-5.4",
        fallbacks: ["anthropic/claude-sonnet-4-6"],
      },
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const written = writtenConfig as typeof defaultMockConfig;
    const mainAgent = written.agents.list.find((agent) => agent.id === "main");
    expect(mainAgent?.model).toEqual({
      primary: "openai/gpt-5.4",
      fallbacks: ["anthropic/claude-sonnet-4-6"],
    });
  });

  it("clears per-agent model policy to inherit default", async () => {
    const result = await callHandler("deck.agents.modelPolicy.set", {
      target: { kind: "agent-model", key: "agent", agentId: "main" },
      clear: true,
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    expect((result.payload as Record<string, unknown>).cleared).toBe(true);
    const written = writtenConfig as typeof defaultMockConfig;
    const mainAgent = written.agents.list.find((agent) => agent.id === "main");
    expect(mainAgent?.model).toBeUndefined();
  });

  it("writes global text default model policy", async () => {
    const result = await callHandler("deck.agents.modelPolicy.set", {
      target: { kind: "global-default", key: "text" },
      selection: {
        primary: "openai/gpt-5.4",
        fallbacks: ["anthropic/claude-sonnet-4-6"],
      },
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const written = writtenConfig as typeof defaultMockConfig;
    expect(written.agents.defaults.model).toEqual({
      primary: "openai/gpt-5.4",
      fallbacks: ["anthropic/claude-sonnet-4-6"],
    });
  });

  it("rejects fallbacks for string-only global fields", async () => {
    const result = await callHandler("deck.agents.modelPolicy.set", {
      target: { kind: "global-default", key: "compaction" },
      selection: {
        primary: "openai/gpt-5.4",
        fallbacks: ["anthropic/claude-sonnet-4-6"],
      },
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(false);
    expect(writtenConfig).toBeNull();
  });

  it("rejects on baseHash mismatch", async () => {
    const result = await callHandler("deck.agents.modelPolicy.set", {
      target: { kind: "agent-model", key: "agent", agentId: "main" },
      selection: { primary: "openai/gpt-5.4" },
      baseHash: "wrong-hash",
    });
    expect(result.ok).toBe(false);
    expect(writtenConfig).toBeNull();
  });

  it("rejects missing selection without explicit clear", async () => {
    const result = await callHandler("deck.agents.modelPolicy.set", {
      target: { kind: "agent-model", key: "agent", agentId: "main" },
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(false);
    expect(writtenConfig).toBeNull();
  });
});

// === Scenario 9: Set eventStreams ===
describe("deck.agents.eventStreams.set", () => {
  it("writes eventStreams to agent config", async () => {
    const result = await callHandler("deck.agents.eventStreams.set", {
      agentId: "main",
      eventStreams: ["lifecycle", "tool"],
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as Record<string, unknown>;
    expect(p.agentId).toBe("main");
    expect(p.eventStreams).toEqual(["lifecycle", "tool"]);
    expect(p.configHash).toBeTruthy();

    // Verify written config
    expect(writtenConfig).toBeTruthy();
    const written = writtenConfig as typeof defaultMockConfig;
    const mainAgent = written.agents.list.find((a) => a.id === "main");
    expect((mainAgent as Record<string, unknown>)?.channels).toBeTruthy();
    expect(
      ((mainAgent as Record<string, unknown>)?.channels as Record<string, unknown>)?.eventStreams,
    ).toEqual(["lifecycle", "tool"]);
  });

  it("rejects on baseHash mismatch", async () => {
    const result = await callHandler("deck.agents.eventStreams.set", {
      agentId: "main",
      eventStreams: ["lifecycle"],
      baseHash: "wrong-hash",
    });
    expect(result.ok).toBe(false);
    expect(writtenConfig).toBeNull();
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.eventStreams.set", {
      agentId: "nonexistent",
      eventStreams: ["lifecycle"],
      baseHash: "hash-abc123",
    });
    expect(result.ok).toBe(false);
  });
});
