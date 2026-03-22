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
      ],
    },
  }),
  STATE_DIR: "/tmp/test-state",
}));

vi.mock("../../../config/sessions.js", () => ({
  loadSessionStore: () => ({}),
  resolveStorePath: () => "/tmp/test-sessions",
}));

vi.mock("../../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn(() => false),
}));

vi.mock("../../../auto-reply/reply/queue.js", () => ({
  clearSessionQueues: vi.fn(() => ({ followupCleared: 0, laneCleared: 0, keys: [] })),
}));

vi.mock("../../../utils/message-channel.js", () => ({
  INTERNAL_MESSAGE_CHANNEL: "internal",
}));

vi.mock("../../../agents/lanes.js", () => ({
  AGENT_LANE_SUBAGENT: "subagent",
}));

vi.mock("../../../routing/session-key.js", () => ({
  parseAgentSessionKey: (key: string) => {
    const parts = key.split(":");
    return parts.length >= 2 ? { agentId: parts[1] } : null;
  },
}));

// --- Imports (after mocks) ---

import {
  addSubagentRunForTests,
  resetSubagentRegistryForTests,
} from "../../../agents/subagent-registry.js";
import type { SubagentRunRecord } from "../../../agents/subagent-registry.types.js";
import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";
import { deckSubagentsSteerHandlers, resetSteerDedupForTests } from "./subagents-steer.js";

// --- Helpers ---

function callHandler(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => {
      resolve({ ok, payload, error });
    };
    const handler = deckSubagentsSteerHandlers[method];
    if (!handler) {
      throw new Error(`Handler "${method}" not found`);
    }
    const result = handler({
      params,
      respond,
      req: { type: "req" as const, id: "test-1", method, params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
    // Await async handlers
    if (result && typeof result === "object" && "then" in result) {
      void result.catch(() => {});
    }
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
  resetSteerDedupForTests();
});

// =====================
// deck.subagents.steer
// =====================

describe("deck.subagents.steer", () => {
  it("steers an active run successfully", async () => {
    addSubagentRunForTests(
      makeRun({
        runId: "run-steer-1",
        childSessionKey: "agent:coder:subagent:uuid1",
        requesterSessionKey: "agent:main:main",
        task: "write code",
        createdAt: Date.now() - 5000,
        startedAt: Date.now() - 5000,
      }),
    );

    const result = await callHandler("deck.subagents.steer", {
      runId: "run-steer-1",
      instruction: "focus on error handling",
    });

    expect(result.ok).toBe(true);
    const p = result.payload as { success: boolean; dedupKey: string; deduped?: boolean };
    expect(p.success).toBe(true);
    expect(p.dedupKey).toBeDefined();
    expect(typeof p.dedupKey).toBe("string");
    expect(p.deduped).toBeUndefined();
  });

  it("returns RUN_NOT_FOUND for non-existent run", async () => {
    const result = await callHandler("deck.subagents.steer", {
      runId: "nonexistent-run",
      instruction: "do something",
    });

    expect(result.ok).toBe(false);
    const err = result.error as { code: string; message: string };
    expect(err.code).toBe("RUN_NOT_FOUND");
    expect(err.message).toContain("nonexistent-run");
  });

  it("returns RUN_NOT_ACTIVE for completed run", async () => {
    addSubagentRunForTests(
      makeRun({
        runId: "run-done",
        childSessionKey: "agent:coder:subagent:uuid2",
        requesterSessionKey: "agent:main:main",
        task: "finished task",
        createdAt: Date.now() - 10000,
        endedAt: Date.now() - 3000,
        outcome: { status: "ok" },
      }),
    );

    const result = await callHandler("deck.subagents.steer", {
      runId: "run-done",
      instruction: "change direction",
    });

    expect(result.ok).toBe(false);
    const err = result.error as { code: string; message: string };
    expect(err.code).toBe("RUN_NOT_ACTIVE");
  });

  it("deduplicates same instruction within 60s window", async () => {
    addSubagentRunForTests(
      makeRun({
        runId: "run-dedup",
        childSessionKey: "agent:coder:subagent:uuid3",
        requesterSessionKey: "agent:main:main",
        task: "some task",
        createdAt: Date.now() - 5000,
        startedAt: Date.now() - 5000,
      }),
    );

    // First call — should succeed (full steer-restart flow executes)
    const result1 = await callHandler("deck.subagents.steer", {
      runId: "run-dedup",
      instruction: "same instruction",
    });
    expect(result1.ok).toBe(true);
    const p1 = result1.payload as { success: boolean; dedupKey: string; deduped?: boolean };
    expect(p1.success).toBe(true);
    expect(p1.deduped).toBeUndefined();

    // After first steer, the run is replaced (new runId). Re-add original run
    // to simulate a second request with the same runId (dedup should catch it
    // before the run lookup matters).
    addSubagentRunForTests(
      makeRun({
        runId: "run-dedup",
        childSessionKey: "agent:coder:subagent:uuid3",
        requesterSessionKey: "agent:main:main",
        task: "some task",
        createdAt: Date.now() - 5000,
        startedAt: Date.now() - 5000,
      }),
    );

    // Second call with same params — should be deduped (returns before steer flow)
    const result2 = await callHandler("deck.subagents.steer", {
      runId: "run-dedup",
      instruction: "same instruction",
    });
    expect(result2.ok).toBe(true);
    const p2 = result2.payload as { success: boolean; dedupKey: string; deduped: boolean };
    expect(p2.success).toBe(true);
    expect(p2.deduped).toBe(true);
    expect(p2.dedupKey).toBe(p1.dedupKey);
  });

  it("does NOT deduplicate different instructions", async () => {
    addSubagentRunForTests(
      makeRun({
        runId: "run-diff",
        childSessionKey: "agent:coder:subagent:uuid4",
        requesterSessionKey: "agent:main:main",
        task: "some task",
        createdAt: Date.now() - 5000,
        startedAt: Date.now() - 5000,
      }),
    );

    const result1 = await callHandler("deck.subagents.steer", {
      runId: "run-diff",
      instruction: "instruction A",
    });
    expect(result1.ok).toBe(true);
    const p1 = result1.payload as { success: boolean; dedupKey: string; deduped?: boolean };
    expect(p1.deduped).toBeUndefined();

    // After first steer, run is replaced. Re-add for second call.
    addSubagentRunForTests(
      makeRun({
        runId: "run-diff",
        childSessionKey: "agent:coder:subagent:uuid4",
        requesterSessionKey: "agent:main:main",
        task: "some task",
        createdAt: Date.now() - 5000,
        startedAt: Date.now() - 5000,
      }),
    );

    const result2 = await callHandler("deck.subagents.steer", {
      runId: "run-diff",
      instruction: "instruction B",
    });
    expect(result2.ok).toBe(true);
    const p2 = result2.payload as { success: boolean; dedupKey: string; deduped?: boolean };
    expect(p2.deduped).toBeUndefined();
    expect(p2.dedupKey).not.toBe(p1.dedupKey);
  });

  it("rejects invalid params (missing instruction)", async () => {
    const result = await callHandler("deck.subagents.steer", {
      runId: "some-run",
    });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("INVALID_REQUEST");
  });

  it("rejects invalid params (missing runId)", async () => {
    const result = await callHandler("deck.subagents.steer", {
      instruction: "do something",
    });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("INVALID_REQUEST");
  });
});
