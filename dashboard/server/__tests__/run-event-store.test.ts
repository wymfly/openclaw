import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { openDb, preloadSqlJs } from "../db.js";
import type { Database } from "../db.js";
import { RunEventStore } from "../run-event-store.js";
import type { RunEventInput } from "../run-event-store.js";

beforeAll(async () => {
  await preloadSqlJs();
});

// ---------------------------------------------------------------------------
// Setup — each test gets a fresh in-memory database
// ---------------------------------------------------------------------------

let db: Database;
let store: RunEventStore;

beforeEach(() => {
  db = openDb(":memory:");
  store = new RunEventStore(db);
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // already closed
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<RunEventInput> = {}): RunEventInput {
  return {
    runId: "run-1",
    seq: 0,
    stream: "assistant",
    data: JSON.stringify({ type: "text", text: "hello" }),
    ...overrides,
  };
}

function makeToolCallEvent(runId: string, seq: number): RunEventInput {
  return {
    runId,
    seq,
    stream: "tool_call",
    data: JSON.stringify({ type: "tool_use", name: "Read" }),
  };
}

function makeModelEvent(
  runId: string,
  seq: number,
  tokens: { input?: number; output?: number; cache?: number } = {},
): RunEventInput {
  return {
    runId,
    seq,
    stream: "model",
    data: JSON.stringify({
      type: "result",
      subtype: "success",
      usage: {
        input_tokens: tokens.input ?? 100,
        output_tokens: tokens.output ?? 50,
        cache_read_input_tokens: tokens.cache ?? 0,
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// appendEvents
// ---------------------------------------------------------------------------

describe("appendEvents", () => {
  it("inserts multiple events in a batch", () => {
    const events = [makeEvent({ seq: 0 }), makeEvent({ seq: 1 }), makeEvent({ seq: 2 })];

    store.appendEvents(events);

    const rows = store.getRunEvents("run-1");
    expect(rows).toHaveLength(3);
  });

  it("ignores duplicate (run_id, seq) pairs without error", () => {
    store.appendEvents([makeEvent({ seq: 0 })]);
    // Insert same seq again — should be silently ignored.
    store.appendEvents([makeEvent({ seq: 0, data: '"different"' })]);

    const rows = store.getRunEvents("run-1");
    expect(rows).toHaveLength(1);
    // Original data preserved (INSERT OR IGNORE keeps the first).
    expect(rows[0].data).toContain("hello");
  });

  it("stores agent_id and session_key when provided", () => {
    store.appendEvents([makeEvent({ agentId: "agent-a", sessionKey: "sess-1" })]);

    const rows = store.getRunEvents("run-1");
    expect(rows[0].agent_id).toBe("agent-a");
    expect(rows[0].session_key).toBe("sess-1");
  });

  it("stores null for optional fields when omitted", () => {
    store.appendEvents([makeEvent()]);

    const rows = store.getRunEvents("run-1");
    expect(rows[0].agent_id).toBeNull();
    expect(rows[0].session_key).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRunEvents
// ---------------------------------------------------------------------------

describe("getRunEvents", () => {
  it("returns events ordered by seq ASC", () => {
    // Insert out of order.
    store.appendEvents([makeEvent({ seq: 2 }), makeEvent({ seq: 0 }), makeEvent({ seq: 1 })]);

    const rows = store.getRunEvents("run-1");
    expect(rows.map((r) => r.seq)).toEqual([0, 1, 2]);
  });

  it("returns empty array for unknown run_id", () => {
    expect(store.getRunEvents("nonexistent")).toEqual([]);
  });

  it("scopes to the requested run_id only", () => {
    store.appendEvents([
      makeEvent({ runId: "run-1", seq: 0 }),
      makeEvent({ runId: "run-2", seq: 0 }),
    ]);

    expect(store.getRunEvents("run-1")).toHaveLength(1);
    expect(store.getRunEvents("run-2")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// listRuns
// ---------------------------------------------------------------------------

describe("listRuns", () => {
  beforeEach(() => {
    // Seed two runs.
    store.appendEvents([
      makeEvent({ runId: "run-a", seq: 0, agentId: "agent-1", sessionKey: "s1" }),
      makeEvent({ runId: "run-a", seq: 1, agentId: "agent-1", sessionKey: "s1" }),
      makeToolCallEvent("run-a", 2),
      makeModelEvent("run-a", 3, { input: 100, output: 50 }),
      makeEvent({ runId: "run-b", seq: 0, agentId: "agent-2", sessionKey: "s2" }),
      makeToolCallEvent("run-b", 1),
      makeModelEvent("run-b", 2, { input: 200, output: 100 }),
    ]);
  });

  it("returns all runs ordered by first event descending", () => {
    const result = store.listRuns({});
    expect(result.runs).toHaveLength(2);
    // Most recent first.
    expect(result.runs[0].runId).toBe("run-b");
    expect(result.runs[1].runId).toBe("run-a");
  });

  it("includes summary metrics", () => {
    const result = store.listRuns({});
    const runA = result.runs.find((r) => r.runId === "run-a")!;
    expect(runA.eventCount).toBe(4);
    expect(runA.toolCalls).toBe(1);
    expect(runA.modelCalls).toBe(1);
    expect(runA.totalTokens).toBe(150); // 100 input + 50 output
  });

  it("filters by agentId", () => {
    const result = store.listRuns({ agentId: "agent-1" });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].runId).toBe("run-a");
  });

  it("filters by sessionKey", () => {
    const result = store.listRuns({ sessionKey: "s2" });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].runId).toBe("run-b");
  });

  it("supports cursor-based pagination", () => {
    const page1 = store.listRuns({ limit: 1 });
    expect(page1.runs).toHaveLength(1);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = store.listRuns({ limit: 1, cursor: page1.nextCursor! });
    expect(page2.runs).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    // Pages should contain different runs.
    expect(page1.runs[0].runId).not.toBe(page2.runs[0].runId);
  });

  it("returns empty result for unknown filter", () => {
    const result = store.listRuns({ agentId: "nonexistent" });
    expect(result.runs).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRunSummary
// ---------------------------------------------------------------------------

describe("getRunSummary", () => {
  it("returns null for unknown runId", () => {
    expect(store.getRunSummary("nonexistent")).toBeNull();
  });

  it("aggregates tool calls, model calls, and tokens", () => {
    store.appendEvents([
      makeEvent({ runId: "run-x", seq: 0 }),
      makeToolCallEvent("run-x", 1),
      makeToolCallEvent("run-x", 2),
      makeModelEvent("run-x", 3, { input: 100, output: 50, cache: 25 }),
      makeModelEvent("run-x", 4, { input: 200, output: 100, cache: 75 }),
    ]);

    const summary = store.getRunSummary("run-x")!;
    expect(summary.toolCalls).toBe(2);
    expect(summary.modelCalls).toBe(2);
    expect(summary.totalInputTokens).toBe(300);
    expect(summary.totalOutputTokens).toBe(150);
    expect(summary.totalCacheTokens).toBe(100);
    expect(summary.eventCount).toBe(5);
  });

  it("counts file operations", () => {
    store.appendEvents([
      {
        runId: "run-f",
        seq: 0,
        stream: "file_op",
        data: JSON.stringify({ type: "tool_use", name: "Write" }),
      },
      {
        runId: "run-f",
        seq: 1,
        stream: "file_op",
        data: JSON.stringify({ type: "tool_use", name: "Edit" }),
      },
      {
        runId: "run-f",
        seq: 2,
        stream: "file_op",
        data: JSON.stringify({ type: "tool_use", name: "Read" }),
      },
    ]);

    const summary = store.getRunSummary("run-f")!;
    expect(summary.fileOps).toBe(3);
  });

  it("counts subagent spawns", () => {
    store.appendEvents([
      {
        runId: "run-s",
        seq: 0,
        stream: "subagent",
        data: JSON.stringify({ type: "tool_use", name: "Agent" }),
      },
      {
        runId: "run-s",
        seq: 1,
        stream: "subagent",
        data: JSON.stringify({ type: "tool_use", name: "TaskCreate" }),
      },
    ]);

    const summary = store.getRunSummary("run-s")!;
    expect(summary.subagentSpawns).toBe(2);
  });

  it("computes duration from first to last event", () => {
    // Insert events with backdated created_at for duration calculation.
    db.prepare(
      "INSERT INTO run_events (run_id, seq, stream, data, created_at) VALUES (?, ?, ?, ?, datetime('now', '-60 seconds'))",
    ).run("run-d", 0, "assistant", '{"type":"text"}');
    db.prepare(
      "INSERT INTO run_events (run_id, seq, stream, data, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
    ).run("run-d", 1, "result", '{"type":"result","subtype":"success"}');

    const summary = store.getRunSummary("run-d")!;
    // Duration should be roughly 60 seconds (60000 ms), allow some tolerance.
    expect(summary.durationMs).toBeGreaterThanOrEqual(59000);
    expect(summary.durationMs).toBeLessThanOrEqual(61000);
  });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe("getStats", () => {
  it("returns zeroed stats for empty store", () => {
    const stats = store.getStats();
    expect(stats.totalRuns).toBe(0);
    expect(stats.todayRuns).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
    expect(stats.topAgents).toEqual([]);
  });

  it("counts total and today runs", () => {
    store.appendEvents([
      makeEvent({ runId: "run-1", seq: 0, agentId: "a" }),
      makeEvent({ runId: "run-2", seq: 0, agentId: "a" }),
      makeEvent({ runId: "run-3", seq: 0, agentId: "b" }),
    ]);

    const stats = store.getStats();
    expect(stats.totalRuns).toBe(3);
    // All events created "now" → should count as today.
    expect(stats.todayRuns).toBe(3);
  });

  it("returns top agents by run count", () => {
    store.appendEvents([
      makeEvent({ runId: "r1", seq: 0, agentId: "agent-x" }),
      makeEvent({ runId: "r2", seq: 0, agentId: "agent-x" }),
      makeEvent({ runId: "r3", seq: 0, agentId: "agent-x" }),
      makeEvent({ runId: "r4", seq: 0, agentId: "agent-y" }),
      makeEvent({ runId: "r5", seq: 0, agentId: "agent-y" }),
      makeEvent({ runId: "r6", seq: 0, agentId: "agent-z" }),
    ]);

    const stats = store.getStats();
    expect(stats.topAgents).toHaveLength(3);
    expect(stats.topAgents[0]).toEqual({ agentId: "agent-x", runCount: 3 });
    expect(stats.topAgents[1]).toEqual({ agentId: "agent-y", runCount: 2 });
    expect(stats.topAgents[2]).toEqual({ agentId: "agent-z", runCount: 1 });
  });
});

// ---------------------------------------------------------------------------
// pruneOldEvents
// ---------------------------------------------------------------------------

describe("pruneOldEvents", () => {
  it("deletes events older than 7 days", () => {
    // Insert an event backdated to 8 days ago.
    db.prepare(
      "INSERT INTO run_events (run_id, seq, stream, data, created_at) VALUES (?, ?, ?, ?, datetime('now', '-8 days'))",
    ).run("old-run", 0, "assistant", '"old"');

    // Insert a recent event directly via SQL to avoid maybePrune() side effects.
    db.prepare(
      "INSERT INTO run_events (run_id, seq, stream, data, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
    ).run("new-run", 0, "assistant", '"recent"');

    const pruned = store.pruneOldEvents();
    expect(pruned).toBeGreaterThanOrEqual(1);

    // Old run's events should be gone.
    expect(store.getRunEvents("old-run")).toHaveLength(0);
    // New run's events should remain.
    expect(store.getRunEvents("new-run")).toHaveLength(1);
  });

  it("returns 0 when nothing to prune", () => {
    store.appendEvents([makeEvent({ runId: "r1", seq: 0 })]);
    expect(store.pruneOldEvents()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deriveRunStatus
// ---------------------------------------------------------------------------

describe("deriveRunStatus", () => {
  it("returns 'completed' when last event is a terminal success", () => {
    store.appendEvents([
      makeEvent({ runId: "run-ok", seq: 0 }),
      {
        runId: "run-ok",
        seq: 1,
        stream: "result",
        data: JSON.stringify({ type: "result", subtype: "success" }),
      },
    ]);

    const rows = store.getRunEvents("run-ok");
    const lastRow = rows[rows.length - 1];
    expect(store.deriveRunStatus("run-ok", lastRow.created_at)).toBe("completed");
  });

  it("returns 'error' when last event is a terminal error", () => {
    store.appendEvents([
      makeEvent({ runId: "run-err", seq: 0 }),
      {
        runId: "run-err",
        seq: 1,
        stream: "result",
        data: JSON.stringify({ type: "result", subtype: "error_tool_use" }),
      },
    ]);

    const rows = store.getRunEvents("run-err");
    const lastRow = rows[rows.length - 1];
    expect(store.deriveRunStatus("run-err", lastRow.created_at)).toBe("error");
  });

  it("returns 'running' when last event is recent and non-terminal", () => {
    store.appendEvents([makeEvent({ runId: "run-active", seq: 0 })]);

    const rows = store.getRunEvents("run-active");
    const lastRow = rows[rows.length - 1];
    expect(store.deriveRunStatus("run-active", lastRow.created_at)).toBe("running");
  });

  it("returns 'error' when last event is old and non-terminal (stale)", () => {
    // Insert event backdated to 10 minutes ago.
    db.prepare(
      "INSERT INTO run_events (run_id, seq, stream, data, created_at) VALUES (?, ?, ?, ?, datetime('now', '-600 seconds'))",
    ).run("run-stale", 0, "assistant", '{"type":"text"}');

    const rows = store.getRunEvents("run-stale");
    const lastRow = rows[rows.length - 1];
    expect(store.deriveRunStatus("run-stale", lastRow.created_at)).toBe("error");
  });
});
