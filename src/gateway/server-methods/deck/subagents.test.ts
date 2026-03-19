import { afterEach, describe, expect, it, vi } from "vitest";

// --- Mocks (hoisted by vitest before all imports) ---

vi.mock("../../../gateway/call.js", () => ({
  callGateway: vi.fn(async () => ({ status: "ok" })),
}));

vi.mock("../../../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn(() => () => {}),
}));

vi.mock("../../../agents/subagent-announce.js", () => ({
  runSubagentAnnounceFlow: vi.fn(async () => true),
}));

vi.mock("../../../config/config.js", () => ({
  loadConfig: () => ({
    agents: {
      list: [
        { id: "main", name: "Main Agent" },
        { id: "coder", name: "Coder" },
        { id: "tester", name: "Tester" },
      ],
    },
  }),
}));

// --- Imports (after mocks) ---

import {
  addSubagentRunForTests,
  resetSubagentRegistryForTests,
} from "../../../agents/subagent-registry.js";
import type { SubagentRunRecord } from "../../../agents/subagent-registry.types.js";
import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";
import { deckSubagentsHandlers } from "./subagents.js";

// --- Helpers ---

function callHandler(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => {
      resolve({ ok, payload, error });
    };
    const handler = deckSubagentsHandlers[method];
    if (!handler) {
      throw new Error(`Handler "${method}" not found`);
    }
    void handler({
      params,
      respond,
      req: { id: "test-1", method, params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
  });
}

function makeRun(
  overrides: Partial<SubagentRunRecord> & {
    runId: string;
    childSessionKey: string;
    requesterSessionKey: string;
  },
): SubagentRunRecord {
  return {
    requesterDisplayKey: "test",
    task: "test task",
    cleanup: "keep",
    createdAt: Date.now(),
    ...overrides,
  };
}

afterEach(() => {
  resetSubagentRegistryForTests({ persist: false });
});

// =====================
// Scenario 1-3: deck.subagents.list
// =====================

describe("deck.subagents.list", () => {
  it("returns only active runs when status=active", async () => {
    const now = Date.now();
    addSubagentRunForTests(
      makeRun({
        runId: "run-active",
        childSessionKey: "agent:coder:subagent:uuid1",
        requesterSessionKey: "agent:main:main",
        task: "write code",
        createdAt: now - 5000,
        startedAt: now - 5000,
      }),
    );
    addSubagentRunForTests(
      makeRun({
        runId: "run-done",
        childSessionKey: "agent:tester:subagent:uuid2",
        requesterSessionKey: "agent:main:main",
        task: "run tests",
        createdAt: now - 10000,
        endedAt: now - 3000,
        outcome: { status: "ok" },
      }),
    );

    const result = await callHandler("deck.subagents.list", { status: "active" });
    expect(result.ok).toBe(true);
    const p = result.payload as { runs: Array<Record<string, unknown>>; total: number };
    expect(p.runs).toHaveLength(1);
    expect(p.runs[0].runId).toBe("run-active");
    expect(p.runs[0].status).toBe("active");
    expect(p.runs[0].childAgentId).toBe("coder");
    expect(p.runs[0].requesterAgentId).toBe("main");
    expect(p.total).toBe(1);
  });

  it("returns paginated results sorted by createdAt descending", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      addSubagentRunForTests(
        makeRun({
          runId: `run-${i}`,
          childSessionKey: `agent:coder:subagent:uuid${i}`,
          requesterSessionKey: "agent:main:main",
          task: `task ${i}`,
          createdAt: now - (5 - i) * 1000,
          endedAt: now,
          outcome: { status: "ok" },
        }),
      );
    }

    const result = await callHandler("deck.subagents.list", {
      status: "all",
      limit: 2,
      offset: 1,
    });
    expect(result.ok).toBe(true);
    const p = result.payload as { runs: Array<Record<string, unknown>>; total: number };
    expect(p.runs).toHaveLength(2);
    expect(p.total).toBe(5);
  });

  it("returns empty when no runs in memory", async () => {
    const result = await callHandler("deck.subagents.list", { status: "all" });
    expect(result.ok).toBe(true);
    const p = result.payload as { runs: unknown[]; total: number };
    expect(p.runs).toEqual([]);
    expect(p.total).toBe(0);
  });
});

// =====================
// Scenario 4-5: deck.subagents.kill
// =====================

describe("deck.subagents.kill", () => {
  it("terminates an active run and returns ok", async () => {
    addSubagentRunForTests(
      makeRun({
        runId: "run-to-kill",
        childSessionKey: "agent:coder:subagent:kill-uuid",
        requesterSessionKey: "agent:main:main",
        task: "task to kill",
        createdAt: Date.now() - 5000,
      }),
    );

    const result = await callHandler("deck.subagents.kill", { runId: "run-to-kill" });
    expect(result.ok).toBe(true);
    const p = result.payload as { ok: boolean; runId: string; childSessionKey: string };
    expect(p.ok).toBe(true);
    expect(p.runId).toBe("run-to-kill");
    expect(p.childSessionKey).toBe("agent:coder:subagent:kill-uuid");
  });

  it("returns NOT_FOUND for non-existent run", async () => {
    const result = await callHandler("deck.subagents.kill", { runId: "nonexistent" });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("NOT_FOUND");
  });
});

// =====================
// Scenario 6-8: deck.subagents.lineage
// =====================

describe("deck.subagents.lineage", () => {
  it("returns root + 1 node for depth-1 run", async () => {
    addSubagentRunForTests(
      makeRun({
        runId: "run-depth1",
        childSessionKey: "agent:coder:subagent:d1-uuid",
        requesterSessionKey: "agent:main:main",
        task: "depth-1 task",
        createdAt: Date.now() - 5000,
      }),
    );

    const result = await callHandler("deck.subagents.lineage", { runId: "run-depth1" });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      root: { sessionKey: string; agentId: string; agentName?: string };
      nodes: Array<{
        runId: string;
        depth: number;
        parentRunId: string | null;
        agentId: string;
      }>;
    };
    expect(p.root.sessionKey).toBe("agent:main:main");
    expect(p.root.agentId).toBe("main");
    expect(p.root.agentName).toBe("Main Agent");
    expect(p.nodes).toHaveLength(1);
    expect(p.nodes[0].runId).toBe("run-depth1");
    expect(p.nodes[0].depth).toBe(1);
    expect(p.nodes[0].parentRunId).toBeNull();
    expect(p.nodes[0].agentId).toBe("coder");
  });

  it("returns correct parentRunId for nested tree", async () => {
    const now = Date.now();
    // main → coder (depth 1)
    addSubagentRunForTests(
      makeRun({
        runId: "run-coder",
        childSessionKey: "agent:coder:subagent:coder-uuid",
        requesterSessionKey: "agent:main:main",
        task: "coder task",
        createdAt: now - 10000,
      }),
    );
    // coder → tester (depth 2)
    addSubagentRunForTests(
      makeRun({
        runId: "run-tester",
        childSessionKey: "agent:tester:subagent:tester-uuid",
        requesterSessionKey: "agent:coder:subagent:coder-uuid",
        task: "tester task",
        createdAt: now - 5000,
      }),
    );

    const result = await callHandler("deck.subagents.lineage", {
      sessionKey: "agent:tester:subagent:tester-uuid",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      root: { sessionKey: string; agentId: string };
      nodes: Array<{
        runId: string;
        depth: number;
        parentRunId: string | null;
      }>;
    };
    expect(p.root.sessionKey).toBe("agent:main:main");
    expect(p.root.agentId).toBe("main");
    expect(p.nodes).toHaveLength(2);

    const coderNode = p.nodes.find((n) => n.runId === "run-coder");
    const testerNode = p.nodes.find((n) => n.runId === "run-tester");
    expect(coderNode?.depth).toBe(1);
    expect(coderNode?.parentRunId).toBeNull();
    expect(testerNode?.depth).toBe(2);
    expect(testerNode?.parentRunId).toBe("run-coder");
  });

  it("returns root + empty nodes for non-subagent session", async () => {
    const result = await callHandler("deck.subagents.lineage", {
      sessionKey: "agent:main:main",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      root: { sessionKey: string; agentId: string };
      nodes: unknown[];
    };
    expect(p.root.sessionKey).toBe("agent:main:main");
    expect(p.root.agentId).toBe("main");
    expect(p.nodes).toEqual([]);
  });
});
