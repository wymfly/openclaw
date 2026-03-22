import { describe, expect, it, vi, beforeEach } from "vitest";

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
        active: boolean;
        allow: string[] | null;
        deny: string[] | null;
      }>;
      tools: Array<{ id: string; allowed: boolean; perLayer: boolean[] }>;
      configHash: string;
    };

    // Should have 7 layers from buildDefaultToolPolicyPipelineSteps
    expect(p.layers).toHaveLength(7);
    expect(p.layers[0].label).toContain("tools.profile");
    expect(p.layers[2].label).toBe("tools.allow");
    expect(p.layers[4].label).toContain("agents.main.tools.allow");

    // tools.allow layer should be active (has config)
    expect(p.layers[2].active).toBe(true);
    expect(p.layers[2].allow).toEqual(["read", "write", "edit", "exec"]);
    expect(p.layers[2].deny).toEqual(["gateway"]);

    // Tools array should exist and have entries
    expect(p.tools.length).toBeGreaterThan(0);
    // Each tool should have perLayer matching number of layers
    for (const tool of p.tools) {
      expect(tool.perLayer).toHaveLength(7);
    }

    // "read" should be allowed (in global allowlist, not in agent deny)
    const readTool = p.tools.find((t) => t.id === "read");
    expect(readTool?.allowed).toBe(true);

    // "gateway" should be denied (in global deny)
    const gatewayTool = p.tools.find((t) => t.id === "gateway");
    expect(gatewayTool?.allowed).toBe(false);

    // "tts" should be denied (in agent deny)
    const ttsTool = p.tools.find((t) => t.id === "tts");
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
      layers: Array<{ label: string; active: boolean }>;
      tools: Array<{ id: string; allowed: boolean; perLayer: boolean[] }>;
    };

    // "write" is in global allow but agent only allows "read" and "exec"
    const writeTool = p.tools.find((t) => t.id === "write");
    // write is allowed by global but blocked by agent allowlist
    expect(writeTool).toBeDefined();

    // "read" should be allowed (in both global and agent allowlists)
    const readTool = p.tools.find((t) => t.id === "read");
    expect(readTool?.allowed).toBe(true);
  });
});
