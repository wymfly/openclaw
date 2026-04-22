/**
 * RunAggregator — in-memory per-run statistics from EventBus events.
 *
 * Replaces SQLite run_events + run-event-pipeline with a lightweight
 * in-memory aggregation layer. Subscribes to EventBus chat/agent events
 * and maintains per-run statistics.
 *
 * Design:
 *   - globalThis singleton (HMR-safe)
 *   - Capacity: keeps last MAX_RUNS runs, LRU eviction
 *   - Status derivation: success→completed, error→error, 5min stale→error
 */

import type { EventBus, ServerEvent } from "./event-bus";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RUNS = 200;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const GLOBAL_KEY = "__oclRunAggregator__";

const FILE_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "multiedit",
  "glob",
  "read_file",
  "write_file",
  "edit_file",
  "create_file",
  "delete_file",
]);

const SUBAGENT_TOOLS = new Set(["agent", "taskcreate"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunStatus = "completed" | "error" | "running";

export interface RunRecord {
  runId: string;
  agentId: string | null;
  sessionKey: string | null;
  status: RunStatus;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  toolCalls: number;
  modelCalls: number;
  fileOps: number;
  subagentSpawns: number;
  totalTokens: number;
  compacted: boolean;
}

export interface RunListFilters {
  agentId?: string;
  sessionKey?: string;
  since?: string;
  until?: string;
  status?: RunStatus;
  limit?: number;
  cursor?: string;
}

export interface RunListResult {
  runs: RunRecord[];
  nextCursor: string | null;
}

export interface RunSummary {
  toolCalls: number;
  modelCalls: number;
  fileOps: number;
  subagentSpawns: number;
  compacted: boolean;
  totalTokens: number;
  durationMs: number;
  eventCount: number;
}

export interface OverviewStats {
  totalRuns: number;
  todayRuns: number;
  avgDurationMs: number;
  topAgents: Array<{ agentId: string; runCount: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractAgentId(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) {
    return undefined;
  }
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match?.[1];
}

function deriveRunStatus(record: RunRecord, now: number): RunStatus {
  if (record.status === "completed" || record.status === "error") {
    return record.status;
  }
  // Stale running → error
  const lastAt = new Date(record.lastEventAt).getTime();
  if (now - lastAt > STALE_THRESHOLD_MS) {
    return "error";
  }
  return "running";
}

// ---------------------------------------------------------------------------
// RunAggregator
// ---------------------------------------------------------------------------

export class RunAggregator {
  private runs = new Map<string, RunRecord>();
  private insertionOrder: string[] = [];

  /** Process a chat or agent event and update run statistics. */
  handleEvent = (event: ServerEvent): void => {
    if (event.type !== "chat" && event.type !== "agent") {
      return;
    }

    const p = event.data as Record<string, unknown>;
    const runId = p.runId as string | undefined;
    if (!runId) {
      return;
    }

    const now = new Date().toISOString();
    const sessionKey = p.sessionKey as string | undefined;
    const agentId = extractAgentId(sessionKey) ?? null;

    let record = this.runs.get(runId);
    if (!record) {
      record = {
        runId,
        agentId,
        sessionKey: sessionKey ?? null,
        status: "running",
        firstEventAt: now,
        lastEventAt: now,
        eventCount: 0,
        toolCalls: 0,
        modelCalls: 0,
        fileOps: 0,
        subagentSpawns: 0,
        totalTokens: 0,
        compacted: false,
      };
      this.runs.set(runId, record);
      this.insertionOrder.push(runId);
      this.evictIfNeeded();
    }

    record.lastEventAt = now;
    record.eventCount++;

    if (event.type === "chat") {
      const state = p.state as string | undefined;
      if (state === "final") {
        record.status = "completed";
        record.modelCalls++;
      } else if (state === "error") {
        record.status = "error";
        record.modelCalls++;
      }
      // Extract token usage
      const usage = p.usage as Record<string, unknown> | undefined;
      if (usage) {
        record.totalTokens += Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0);
      }
    }

    if (event.type === "agent") {
      const stream = p.stream as string | undefined;
      const data = (p.data ?? {}) as Record<string, unknown>;

      if (stream === "compaction") {
        record.compacted = true;
      } else if (stream === "tool") {
        const toolName = (data.name as string | undefined)?.toLowerCase();
        if (toolName && FILE_TOOLS.has(toolName)) {
          record.fileOps++;
        } else if (toolName && SUBAGENT_TOOLS.has(toolName)) {
          record.subagentSpawns++;
        } else {
          record.toolCalls++;
        }
      } else if (stream === "lifecycle") {
        if (data.childRunId || data.childSessionKey) {
          record.subagentSpawns++;
        }
      }
    }
  };

  /** List runs with optional filters and pagination. */
  listRuns(filters: RunListFilters = {}): RunListResult {
    const now = Date.now();
    let runs = Array.from(this.runs.values()).map((r) => ({
      ...r,
      status: deriveRunStatus(r, now),
    }));

    if (filters.agentId) {
      runs = runs.filter((r) => r.agentId === filters.agentId);
    }
    if (filters.sessionKey) {
      runs = runs.filter((r) => r.sessionKey === filters.sessionKey);
    }
    if (filters.status) {
      runs = runs.filter((r) => r.status === filters.status);
    }
    if (filters.since) {
      const sinceMs = new Date(filters.since).getTime();
      runs = runs.filter((r) => new Date(r.firstEventAt).getTime() >= sinceMs);
    }
    if (filters.until) {
      const untilMs = new Date(filters.until).getTime();
      runs = runs.filter((r) => new Date(r.firstEventAt).getTime() <= untilMs);
    }

    // Sort by lastEventAt descending
    runs.sort((a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime());

    // Cursor-based pagination
    const limit = filters.limit ?? 20;
    let startIdx = 0;
    if (filters.cursor) {
      const cursorIdx = runs.findIndex((r) => r.runId === filters.cursor);
      if (cursorIdx >= 0) {
        startIdx = cursorIdx + 1;
      }
    }

    const page = runs.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < runs.length ? (page[page.length - 1]?.runId ?? null) : null;

    return { runs: page, nextCursor };
  }

  /** Get summary for a single run. */
  getRunSummary(runId: string): RunSummary | null {
    const record = this.runs.get(runId);
    if (!record) {
      return null;
    }

    const firstMs = new Date(record.firstEventAt).getTime();
    const lastMs = new Date(record.lastEventAt).getTime();

    return {
      toolCalls: record.toolCalls,
      modelCalls: record.modelCalls,
      fileOps: record.fileOps,
      subagentSpawns: record.subagentSpawns,
      compacted: record.compacted,
      totalTokens: record.totalTokens,
      durationMs: lastMs - firstMs,
      eventCount: record.eventCount,
    };
  }

  /** Aggregate overview statistics. */
  getStats(): OverviewStats {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const runs = Array.from(this.runs.values());
    let totalDurationMs = 0;
    let todayRuns = 0;
    const agentCounts = new Map<string, number>();

    for (const r of runs) {
      const firstMs = new Date(r.firstEventAt).getTime();
      const lastMs = new Date(r.lastEventAt).getTime();
      totalDurationMs += lastMs - firstMs;

      if (firstMs >= todayMs) {
        todayRuns++;
      }

      const status = deriveRunStatus(r, now);
      // Only count non-stale runs for agent stats
      if (status !== "error" || r.status === "error") {
        const agentKey = r.agentId ?? "unknown";
        agentCounts.set(agentKey, (agentCounts.get(agentKey) ?? 0) + 1);
      }
    }

    const topAgents = Array.from(agentCounts.entries())
      .map(([agentId, runCount]) => ({ agentId, runCount }))
      .toSorted((a, b) => b.runCount - a.runCount)
      .slice(0, 5);

    return {
      totalRuns: runs.length,
      todayRuns,
      avgDurationMs: runs.length > 0 ? Math.round(totalDurationMs / runs.length) : 0,
      topAgents,
    };
  }

  /** Evict oldest runs when capacity exceeded. */
  private evictIfNeeded(): void {
    while (this.runs.size > MAX_RUNS && this.insertionOrder.length > 0) {
      const oldest = this.insertionOrder.shift()!;
      this.runs.delete(oldest);
    }
  }
}

// ---------------------------------------------------------------------------
// globalThis singleton (HMR-safe)
// ---------------------------------------------------------------------------

export function getRunAggregator(): RunAggregator {
  const g = globalThis as unknown as Record<string, RunAggregator | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new RunAggregator();
  }
  return g[GLOBAL_KEY];
}

/**
 * Initialize the RunAggregator: subscribe to EventBus.
 * Returns a cleanup function for HMR safety.
 */
export function initRunAggregator(eventBus: EventBus): () => void {
  const aggregator = getRunAggregator();
  eventBus.subscribe(aggregator.handleEvent);
  return () => {
    eventBus.unsubscribe(aggregator.handleEvent);
  };
}
