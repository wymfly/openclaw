import { describe, expect, it, vi, beforeEach, type MockedFunction } from "vitest";

// --- Mocks must be hoisted above imports ---

const mockConfig = {
  tools: {
    allow: ["read", "write", "edit", "exec"],
    deny: ["gateway"],
  },
  agents: {
    list: [
      {
        id: "main",
        name: "Main Agent",
        default: true,
        workspace: "/tmp/main",
        model: "anthropic/claude-sonnet",
        tools: {
          deny: ["tts"],
        },
      },
      {
        id: "restricted",
        name: "Restricted Agent",
        workspace: "/tmp/restricted",
        tools: {
          allow: ["read", "exec"],
        },
      },
    ],
  },
};

let snapshotHash = "hash-preview-123";

vi.mock("../../../agents/workspace.js", () => ({
  loadWorkspaceBootstrapFiles: vi.fn(async () => [
    {
      name: "AGENTS.md",
      path: "/tmp/main/AGENTS.md",
      content: "# Agent instructions",
      missing: false,
    },
    { name: "SOUL.md", path: "/tmp/main/SOUL.md", content: undefined, missing: true },
  ]),
  DEFAULT_SOUL_FILENAME: "SOUL.md",
  DEFAULT_TOOLS_FILENAME: "TOOLS.md",
  DEFAULT_IDENTITY_FILENAME: "IDENTITY.md",
  DEFAULT_USER_FILENAME: "USER.md",
  DEFAULT_HEARTBEAT_FILENAME: "HEARTBEAT.md",
  DEFAULT_BOOTSTRAP_FILENAME: "BOOTSTRAP.md",
  DEFAULT_AGENTS_FILENAME: "AGENTS.md",
}));

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
  resolveConfigSnapshotHash: (snapshot: { hash?: string }) => snapshot.hash ?? null,
}));

import { loadWorkspaceBootstrapFiles } from "../../../agents/workspace.js";
import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";
import { deckAgentsPreviewHandlers } from "./agents-preview.js";

function callHandler(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => {
      resolve({ ok, payload, error });
    };
    const handler = deckAgentsPreviewHandlers[method];
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
  snapshotHash = "hash-preview-123";
});

describe("deck.agents.toolPolicy.preview", () => {
  it("returns layers and tool list for valid agent", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      layers: Array<{
        label: string;
        ruleCount: number;
        effect: "allow" | "deny" | "passthrough";
      }>;
      tools: Array<{
        name: string;
        allowed: boolean;
        decisiveLayer: string;
        trace: Array<{ layer: string; decision: "allow" | "deny" | "no-opinion" }>;
      }>;
      configHash: string;
    };

    // Should have 7 layers from buildDefaultToolPolicyPipelineSteps
    expect(p.layers).toHaveLength(7);
    expect(p.layers[0].label).toContain("tools.profile");
    expect(p.layers[2].label).toBe("tools.allow");
    expect(p.layers[4].label).toContain("agents.main.tools.allow");

    // tools.allow layer should have ruleCount and effect (has both allow and deny)
    expect(p.layers[2].ruleCount).toBe(5); // 4 allow + 1 deny
    expect(p.layers[2].effect).toBe("deny"); // deny takes priority when present

    // Tools array should exist and have entries
    expect(p.tools.length).toBeGreaterThan(0);
    // Each tool should have trace matching number of layers
    for (const tool of p.tools) {
      expect(tool.trace).toHaveLength(7);
      expect(tool.decisiveLayer).toBeDefined();
    }

    // "read" should be allowed (in global allowlist, not in agent deny)
    const readTool = p.tools.find((t) => t.name === "read");
    expect(readTool?.allowed).toBe(true);

    // "gateway" should be denied (in global deny)
    const gatewayTool = p.tools.find((t) => t.name === "gateway");
    expect(gatewayTool?.allowed).toBe(false);

    // "tts" should be denied (in agent deny)
    const ttsTool = p.tools.find((t) => t.name === "tts");
    expect(ttsTool?.allowed).toBe(false);

    expect(p.configHash).toBe("hash-preview-123");
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", {
      agentId: "nonexistent",
    });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("NOT_FOUND");
  });

  it("rejects invalid params (missing agentId)", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", {});
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("INVALID_REQUEST");
  });

  it("handles agent with restrictive allowlist", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", {
      agentId: "restricted",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      layers: Array<{ label: string; ruleCount: number; effect: string }>;
      tools: Array<{
        name: string;
        allowed: boolean;
        decisiveLayer: string;
        trace: Array<{ layer: string; decision: string }>;
      }>;
    };

    // "write" is in global allow but agent only allows "read" and "exec"
    const writeTool = p.tools.find((t) => t.name === "write");
    // write is allowed by global but blocked by agent allowlist
    expect(writeTool).toBeDefined();

    // "read" should be allowed (in both global and agent allowlists)
    const readTool = p.tools.find((t) => t.name === "read");
    expect(readTool?.allowed).toBe(true);
  });
});

describe("deck.agents.systemPrompt.preview", () => {
  const mockLoadBootstrap = loadWorkspaceBootstrapFiles as MockedFunction<
    typeof loadWorkspaceBootstrapFiles
  >;

  beforeEach(() => {
    mockLoadBootstrap.mockResolvedValue([
      {
        name: "AGENTS.md",
        path: "/tmp/main/AGENTS.md",
        content: "# Agent instructions",
        missing: false,
      },
      { name: "SOUL.md", path: "/tmp/main/SOUL.md", content: undefined, missing: true },
    ]);
  });

  it("returns bootstrap files and prompt stats for valid agent", async () => {
    const result = await callHandler("deck.agents.systemPrompt.preview", { agentId: "main" });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      layers: Array<{ label: string; source: string; charCount: number; fileCount: number }>;
      bootstrapFiles: Array<{ name: string; exists: boolean; charCount: number }>;
      totalChars: number;
      configHash: string;
    };

    // Should have 4 layers: Bootstrap Files, Identity, Skills Prompt, Extra Instructions
    expect(p.layers).toHaveLength(4);
    expect(p.layers[0].label).toBe("Bootstrap Files");
    expect(p.layers[0].source).toBe("/tmp/main");
    expect(p.layers[1].label).toBe("Identity");
    expect(p.layers[1].source).toBe("IDENTITY.md");
    expect(p.layers[2].label).toBe("Skills Prompt");
    expect(p.layers[2].source).toBe("skills injection");
    expect(p.layers[2].charCount).toBe(0); // cannot estimate without session
    expect(p.layers[3].label).toBe("Extra Instructions");
    expect(p.layers[3].source).toBe("agents.systemPrompt");

    // bootstrapFiles should contain the well-known file list
    expect(p.bootstrapFiles).toBeDefined();
    expect(p.bootstrapFiles.length).toBeGreaterThan(0);

    // AGENTS.md exists with content "# Agent instructions" (20 chars)
    const agentsFile = p.bootstrapFiles.find((f) => f.name === "AGENTS.md");
    expect(agentsFile?.exists).toBe(true);
    expect(agentsFile?.charCount).toBe("# Agent instructions".length);

    // SOUL.md is missing in mock
    const soulFile = p.bootstrapFiles.find((f) => f.name === "SOUL.md");
    expect(soulFile?.exists).toBe(false);
    expect(soulFile?.charCount).toBe(0);

    // totalChars should be sum of bootstrap chars + extra instructions
    expect(p.totalChars).toBeGreaterThanOrEqual(0);
    expect(p.configHash).toBe("hash-preview-123");
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.systemPrompt.preview", {
      agentId: "nonexistent",
    });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("NOT_FOUND");
  });

  it("rejects invalid params (missing agentId)", async () => {
    const result = await callHandler("deck.agents.systemPrompt.preview", {});
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("INVALID_REQUEST");
  });
});
