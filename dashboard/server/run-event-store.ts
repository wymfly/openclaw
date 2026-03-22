/**
 * RunEventStore — SQLite persistence layer for run-scoped execution events.
 *
 * Follows the same patterns as ProjectionStore: lazy prepared statements,
 * getDb() connection sharing, and globalThis singleton.
 */
import type BetterSqlite3 from "better-sqlite3";
import { getDb } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Database = BetterSqlite3.Database;
type Statement<B extends unknown[], R> = BetterSqlite3.Statement<B, R>;

export type RunStatus = "completed" | "error" | "running";

export type RunEventInput = {
  runId: string;
  seq: number;
  stream: string;
  data: string;
  agentId?: string;
  sessionKey?: string;
};

export type RunEventRow = {
  id: number;
  run_id: string;
  seq: number;
  stream: string;
  data: string;
  agent_id: string | null;
  session_key: string | null;
  created_at: string;
};

export type RunListItem = {
  runId: string;
  agentId: string | null;
  sessionKey: string | null;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  status: RunStatus;
  toolCalls: number;
  modelCalls: number;
  totalTokens: number;
};

export type RunListFilters = {
  agentId?: string;
  sessionKey?: string;
  since?: string;
  until?: string;
  status?: RunStatus;
  limit?: number;
  cursor?: string;
};

export type RunListResult = {
  runs: RunListItem[];
  nextCursor: string | null;
};

export type RunSummary = {
  toolCalls: number;
  modelCalls: number;
  fileOps: number;
  subagentSpawns: number;
  compacted: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  durationMs: number;
  eventCount: number;
};

export type OverviewStats = {
  totalRuns: number;
  todayRuns: number;
  avgDurationMs: number;
  topAgents: Array<{ agentId: string; runCount: number }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum interval between prune checks (1 hour in ms). */
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

/** Events older than this are pruned (7 days in seconds). */
const RETENTION_SECONDS = 7 * 24 * 60 * 60;

/** Runs with no events for this long are considered stale (5 minutes). */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Tool names that count as file operations. */
const FILE_OP_TOOLS = new Set(["Read", "Write", "Edit", "MultiEdit", "Glob"]);

/** Tool names that count as subagent spawns. */
const SUBAGENT_TOOLS = new Set(["Agent", "TaskCreate"]);

// ---------------------------------------------------------------------------
// RunEventStore
// ---------------------------------------------------------------------------

export class RunEventStore {
  private readonly db: Database;
  private lastPruneAt = 0;

  // Prepared statements (lazy — created on first use).
  private _insertEvent: Statement<
    [string, number, string, string, string | null, string | null],
    unknown
  > | null = null;
  private _selectRunEvents: Statement<[string], RunEventRow> | null = null;
  private _pruneOld: Statement<[number], unknown> | null = null;
  private _lastEvent: Statement<[string], RunEventRow> | null = null;

  constructor(db?: Database) {
    this.db = db ?? getDb();
  }

  // -- Lazy statement getters ------------------------------------------------

  private get insertEventStmt() {
    return (this._insertEvent ??= this.db.prepare(
      `INSERT OR IGNORE INTO run_events (run_id, seq, stream, data, agent_id, session_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ));
  }

  private get selectRunEventsStmt() {
    return (this._selectRunEvents ??= this.db.prepare(
      "SELECT id, run_id, seq, stream, data, agent_id, session_key, created_at FROM run_events WHERE run_id = ? ORDER BY seq ASC",
    ));
  }

  private get pruneOldStmt() {
    return (this._pruneOld ??= this.db.prepare(
      "DELETE FROM run_events WHERE created_at < datetime('now', ? || ' seconds')",
    ));
  }

  private get lastEventStmt() {
    return (this._lastEvent ??= this.db.prepare(
      "SELECT id, run_id, seq, stream, data, agent_id, session_key, created_at FROM run_events WHERE run_id = ? ORDER BY seq DESC LIMIT 1",
    ));
  }

  // -- Core API --------------------------------------------------------------

  /**
   * Batch insert events using INSERT OR IGNORE (dedup on run_id+seq).
   * Triggers a lazy prune check (at most once per hour).
   */
  appendEvents(events: RunEventInput[]): void {
    if (events.length === 0) {
      return;
    }

    const insertMany = this.db.transaction((evts: RunEventInput[]) => {
      for (const e of evts) {
        this.insertEventStmt.run(
          e.runId,
          e.seq,
          e.stream,
          e.data,
          e.agentId ?? null,
          e.sessionKey ?? null,
        );
      }
    });

    insertMany(events);
    this.maybePrune();
  }

  /** Return all events for a run, ordered by seq ASC. */
  getRunEvents(runId: string): RunEventRow[] {
    return this.selectRunEventsStmt.all(runId);
  }

  /**
   * Cursor-based paginated run list with optional filters.
   * Summary metrics (toolCalls, modelCalls, totalTokens) are computed via SQL
   * aggregation using json_extract. Status is derived post-query.
   *
   * Ordering: most recently started run first (MIN(id) DESC as tie-breaker
   * when timestamps are identical — common in batch inserts).
   * Cursor: opaque string encoding the min rowid for stable pagination.
   */
  listRuns(filters: RunListFilters): RunListResult {
    const limit = filters.limit ?? 50;
    const whereFragments: string[] = [];
    const havingFragments: string[] = [];
    const params: unknown[] = [];

    if (filters.agentId) {
      whereFragments.push("agent_id = ?");
      params.push(filters.agentId);
    }
    if (filters.sessionKey) {
      whereFragments.push("session_key = ?");
      params.push(filters.sessionKey);
    }
    if (filters.since) {
      havingFragments.push("MAX(created_at) >= ?");
      params.push(filters.since);
    }
    if (filters.until) {
      havingFragments.push("MIN(created_at) <= ?");
      params.push(filters.until);
    }
    if (filters.cursor) {
      // Cursor is the min rowid of the last item on the previous page.
      // We want items with a smaller min rowid (i.e. older runs).
      havingFragments.push("MIN(id) < ?");
      params.push(Number(filters.cursor));
    }

    const whereClause = whereFragments.length > 0 ? `WHERE ${whereFragments.join(" AND ")}` : "";
    const havingClause =
      havingFragments.length > 0 ? `HAVING ${havingFragments.join(" AND ")}` : "";

    // Fetch limit+1 to detect if there is a next page.
    params.push(limit + 1);

    const sql = `
      SELECT
        run_id,
        MIN(agent_id) AS agent_id,
        MIN(session_key) AS session_key,
        MIN(created_at) AS first_event_at,
        MAX(created_at) AS last_event_at,
        COUNT(*) AS event_count,
        MIN(id) AS min_id,
        SUM(CASE WHEN json_extract(data, '$.type') = 'tool_use' THEN 1 ELSE 0 END) AS tool_calls,
        SUM(CASE WHEN json_extract(data, '$.type') = 'result' THEN 1 ELSE 0 END) AS model_calls,
        SUM(
          COALESCE(json_extract(data, '$.usage.input_tokens'), 0) +
          COALESCE(json_extract(data, '$.usage.output_tokens'), 0)
        ) AS total_tokens
      FROM run_events
      ${whereClause}
      GROUP BY run_id
      ${havingClause}
      ORDER BY min_id DESC
      LIMIT ?
    `;

    type RawRunRow = {
      run_id: string;
      agent_id: string | null;
      session_key: string | null;
      first_event_at: string;
      last_event_at: string;
      event_count: number;
      min_id: number;
      tool_calls: number;
      model_calls: number;
      total_tokens: number;
    };

    const rawRows = this.db.prepare(sql).all(...params) as RawRunRow[];
    const hasMore = rawRows.length > limit;
    const rows = hasMore ? rawRows.slice(0, limit) : rawRows;

    const runs: RunListItem[] = rows.map((r) => ({
      runId: r.run_id,
      agentId: r.agent_id,
      sessionKey: r.session_key,
      firstEventAt: r.first_event_at,
      lastEventAt: r.last_event_at,
      eventCount: r.event_count,
      status: this.deriveRunStatus(r.run_id, r.last_event_at),
      toolCalls: r.tool_calls,
      modelCalls: r.model_calls,
      totalTokens: r.total_tokens,
    }));

    // Apply post-query status filter if requested.
    const filtered = filters.status ? runs.filter((r) => r.status === filters.status) : runs;

    const nextCursor = hasMore && rows.length > 0 ? String(rows[rows.length - 1].min_id) : null;

    return { runs: filtered, nextCursor };
  }

  /**
   * Aggregate summary for a single run: tool count, model count, tokens,
   * duration, file ops, subagent spawns, compaction flag.
   * Returns null for unknown runId.
   */
  getRunSummary(runId: string): RunSummary | null {
    const events = this.getRunEvents(runId);
    if (events.length === 0) {
      return null;
    }

    let toolCalls = 0;
    let modelCalls = 0;
    let fileOps = 0;
    let subagentSpawns = 0;
    let compacted = false;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheTokens = 0;

    for (const event of events) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        continue;
      }

      const type = parsed.type as string | undefined;

      if (type === "tool_use") {
        toolCalls++;
        const name = parsed.name as string | undefined;
        if (name && FILE_OP_TOOLS.has(name)) {
          fileOps++;
        }
        if (name && SUBAGENT_TOOLS.has(name)) {
          subagentSpawns++;
        }
      }

      if (type === "result") {
        modelCalls++;
        const usage = parsed.usage as Record<string, number> | undefined;
        if (usage) {
          totalInputTokens += usage.input_tokens ?? 0;
          totalOutputTokens += usage.output_tokens ?? 0;
          totalCacheTokens += usage.cache_read_input_tokens ?? 0;
        }
      }

      if (type === "compaction") {
        compacted = true;
      }
    }

    // Duration: difference between first and last event timestamps.
    const firstAt = new Date(events[0].created_at + "Z").getTime();
    const lastAt = new Date(events[events.length - 1].created_at + "Z").getTime();
    const durationMs = Math.max(0, lastAt - firstAt);

    return {
      toolCalls,
      modelCalls,
      fileOps,
      subagentSpawns,
      compacted,
      totalInputTokens,
      totalOutputTokens,
      totalCacheTokens,
      durationMs,
      eventCount: events.length,
    };
  }

  /** Aggregate stats: total runs, today's runs, average duration, top 5 agents. */
  getStats(): OverviewStats {
    // Use a subquery to get per-run aggregates, then aggregate those.
    type StatsRow = { total: number; today: number; avg_dur_ms: number | null };
    const statsSql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN DATE(first_at) = DATE('now') THEN 1 ELSE 0 END) AS today,
        AVG(CASE WHEN cnt > 1
          THEN (julianday(last_at) - julianday(first_at)) * 86400000
          ELSE NULL
        END) AS avg_dur_ms
      FROM (
        SELECT
          run_id,
          MIN(created_at) AS first_at,
          MAX(created_at) AS last_at,
          COUNT(*) AS cnt
        FROM run_events
        GROUP BY run_id
      )
    `;
    const statsRow = this.db.prepare(statsSql).get() as StatsRow | undefined;
    const totalRuns = statsRow?.total ?? 0;
    const todayRuns = statsRow?.today ?? 0;
    const avgDurationMs = Math.round(statsRow?.avg_dur_ms ?? 0);

    // Top 5 agents by run count.
    type AgentRow = { agent_id: string; run_count: number };
    const agentSql = `
      SELECT agent_id, COUNT(DISTINCT run_id) AS run_count
      FROM run_events
      WHERE agent_id IS NOT NULL
      GROUP BY agent_id
      ORDER BY run_count DESC
      LIMIT 5
    `;
    const agentRows = this.db.prepare(agentSql).all() as AgentRow[];
    const topAgents = agentRows.map((r) => ({
      agentId: r.agent_id,
      runCount: r.run_count,
    }));

    return { totalRuns, todayRuns, avgDurationMs, topAgents };
  }

  // -- Maintenance -----------------------------------------------------------

  /** Delete events older than 7 days. Returns number of deleted rows. */
  pruneOldEvents(): number {
    const offsetSeconds = -RETENTION_SECONDS;
    const info = this.pruneOldStmt.run(offsetSeconds);
    return info.changes ?? 0;
  }

  // -- Status derivation -----------------------------------------------------

  /**
   * Derive run status from the last event:
   * - If last event is a "result" with subtype "success" → "completed"
   * - If last event is a "result" with error subtype → "error"
   * - If last event is recent (< 5 min) → "running"
   * - Otherwise → "error" (stale / abandoned)
   */
  deriveRunStatus(runId: string, lastEventAt: string): RunStatus {
    const lastEvent = this.lastEventStmt.get(runId);
    if (!lastEvent) {
      return "error";
    }

    // Try to parse the last event's data for terminal status.
    try {
      const parsed = JSON.parse(lastEvent.data) as Record<string, unknown>;
      if (parsed.type === "result") {
        const subtype = parsed.subtype as string | undefined;
        if (subtype === "success") {
          return "completed";
        }
        // Any other result subtype (error_tool_use, error_max_turns, etc.) → error.
        return "error";
      }
    } catch {
      // Non-parseable data — fall through to time-based heuristic.
    }

    // Time-based heuristic: if the last event is within 5 minutes, consider running.
    const lastMs = new Date(lastEventAt + "Z").getTime();
    const nowMs = Date.now();
    if (nowMs - lastMs < STALE_THRESHOLD_MS) {
      return "running";
    }

    return "error";
  }

  /** Close the underlying database (for tests / graceful shutdown). */
  close(): void {
    this.db.close();
  }

  // -- Internal --------------------------------------------------------------

  /** Trigger prune at most once per PRUNE_INTERVAL_MS. */
  private maybePrune(): void {
    const now = Date.now();
    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) {
      return;
    }
    this.lastPruneAt = now;
    this.pruneOldEvents();
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor (mirrors getDb / getProjectionStore pattern)
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckRunEventStore__";

export function getRunEventStore(): RunEventStore {
  const g = globalThis as unknown as Record<string, RunEventStore | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new RunEventStore();
  }
  return g[GLOBAL_KEY];
}
