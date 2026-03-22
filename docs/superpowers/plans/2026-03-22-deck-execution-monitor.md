# Deck Execution Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Activity + Gateway panels with a unified Monitor panel that persists run events to SQLite, provides timeline/waterfall/history views, and migrates gateway diagnostics cards.

**Architecture:** EventBus subscriber captures `chat` and `agent` SSE events, classifies them into 6 stream types, batch-writes to a `run_events` SQLite table. Three Next.js API routes serve run list, run detail, and overview stats. Frontend: new `stores/monitor.ts` Zustand store, `panels/monitor/` with 3 tabs (Overview, Timeline, History). `activity` and `gateway` panels are fully removed.

**Tech Stack:** Next.js 16+ / React 19 / Zustand 5 / better-sqlite3 (WAL) / next-intl / shadcn/ui / CSS Grid (Gantt) / LineageTree (shared component)

**Skill 依赖：**

| 域         | Skills                                               | 加载方式         |
| ---------- | ---------------------------------------------------- | ---------------- |
| [backend]  | superpowers:test-driven-development                  | session 首次加载 |
| [frontend] | frontend-design, superpowers:test-driven-development | session 首次加载 |

**OpenSpec Change:** `deck-execution-monitor`

---

## File Structure

### New Files

| File                                                                     | Responsibility                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `dashboard/migrations/007_run_events.sql`                                | DDL for `run_events` table + indexes                    |
| `dashboard/server/run-event-store.ts`                                    | RunEventStore class — CRUD + aggregation + pruning      |
| `dashboard/server/run-event-store.test.ts`                               | Unit tests for RunEventStore                            |
| `dashboard/server/run-event-pipeline.ts`                                 | EventBus → RunEventStore batch write pipeline           |
| `dashboard/server/run-event-pipeline.test.ts`                            | Unit tests for event classification + batch flush       |
| `dashboard/src/app/api/monitor/runs/route.ts`                            | GET /api/monitor/runs — paginated run list              |
| `dashboard/src/app/api/monitor/runs/[runId]/route.ts`                    | GET /api/monitor/runs/[runId] — events + summary        |
| `dashboard/src/app/api/monitor/stats/route.ts`                           | GET /api/monitor/stats — overview statistics            |
| `dashboard/src/stores/monitor.ts`                                        | Zustand store: tabs, runs, events, filters, live feed   |
| `dashboard/src/components/panels/monitor/MonitorPanel.tsx`               | Container: 3-tab layout (Overview / Timeline / History) |
| `dashboard/src/components/panels/monitor/overview/OverviewTab.tsx`       | Diagnostics cards + live event feed                     |
| `dashboard/src/components/panels/monitor/overview/LiveFeed.tsx`          | Real-time event timeline (adapted from EventTimeline)   |
| `dashboard/src/components/panels/monitor/timeline/TimelineTab.tsx`       | Run selector + Gantt + waterfall + details              |
| `dashboard/src/components/panels/monitor/timeline/RunTimeline.tsx`       | CSS Grid Gantt-style bars with stream colors            |
| `dashboard/src/components/panels/monitor/timeline/ToolWaterfall.tsx`     | Hierarchical tool call tree with expandable details     |
| `dashboard/src/components/panels/monitor/timeline/FileChangeSummary.tsx` | Grouped file operations by type                         |
| `dashboard/src/components/panels/monitor/timeline/ModelStats.tsx`        | Per-model call/token/fallback stats                     |
| `dashboard/src/components/panels/monitor/timeline/SubagentTree.tsx`      | LineageTree wrapper for run_events data                 |
| `dashboard/src/components/panels/monitor/history/HistoryTab.tsx`         | Run list + filters + infinite scroll                    |

### Modified Files

| File                                                       | Change                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `dashboard/server/event-bus.ts`                            | Add `"run.event"` to `DeckEventType` union                                           |
| `dashboard/server/runtime.ts`                              | Wire RunEventPipeline startup in `initRuntime()` + cleanup in `shutdownRuntime()`    |
| `dashboard/src/stores/ui.ts`                               | `Panel` union: remove `"activity"` + `"gateway"`, add `"monitor"`                    |
| `dashboard/src/app/page.tsx`                               | Replace lazy imports for ActivityPanel/GatewayPanel with MonitorPanel                |
| `dashboard/src/components/layout/NavRail.tsx`              | Replace `activity` + `gateway` entries with `monitor`                                |
| `dashboard/src/components/layout/HeaderBar.tsx`            | Status pill click → navigate to `monitor` panel                                      |
| `dashboard/src/components/panels/routing/ActivityFeed.tsx` | Update import from `activity` store → `monitor` store (`liveEvents`, `addLiveEvent`) |
| `dashboard/src/hooks/useKeyboardShortcuts.ts`              | Update `NAV_PANELS` array: replace `"gateway"` and `"activity"` with `"monitor"`     |
| `dashboard/src/i18n/zh.json`                               | Add `monitor` namespace, remove `activity` namespace                                 |
| `dashboard/src/i18n/en.json`                               | Add `monitor` namespace, remove `activity` namespace                                 |

### Deleted Files

| File                                                         | Reason                                  |
| ------------------------------------------------------------ | --------------------------------------- |
| `dashboard/src/components/panels/activity/ActivityPanel.tsx` | Replaced by MonitorPanel                |
| `dashboard/src/components/panels/activity/EventTimeline.tsx` | Adapted as LiveFeed in monitor/overview |
| `dashboard/src/components/panels/activity/useActivitySSE.ts` | Merged into monitor store               |
| `dashboard/src/components/panels/gateway/GatewayPanel.tsx`   | Cards migrated to monitor/overview      |
| `dashboard/src/stores/activity.ts`                           | Replaced by stores/monitor.ts           |

### Files NOT Deleted (Moved)

| File                                | Destination                                  | Note                 |
| ----------------------------------- | -------------------------------------------- | -------------------- |
| `panels/gateway/ConnectionCard.tsx` | `panels/monitor/overview/ConnectionCard.tsx` | Move, keep unchanged |
| `panels/gateway/HealthCard.tsx`     | `panels/monitor/overview/HealthCard.tsx`     | Move, keep unchanged |
| `panels/gateway/HeartbeatCard.tsx`  | `panels/monitor/overview/HeartbeatCard.tsx`  | Move, keep unchanged |

---

## Cross-File Matrix (Parallel Feasibility)

| File                  | T1  | T2  | T3  | T4  | T5  | T6  | T7  | T8  | T9  |
| --------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| run-event-store.ts    | ✏️  |     |     |     |     |     |     |     |     |
| run-event-pipeline.ts |     | ✏️  |     |     |     |     |     |     |     |
| event-bus.ts          |     | ✏️  |     |     |     |     |     |     |     |
| runtime.ts            |     | ✏️  |     |     |     |     |     |     |     |
| API routes (monitor/) |     |     | ✏️  |     |     |     |     |     |     |
| stores/ui.ts          |     |     |     | ✏️  |     |     |     |     |     |
| stores/monitor.ts     |     |     |     | ✏️  |     |     |     |     |     |
| NavRail.tsx           |     |     |     | ✏️  |     |     |     |     |     |
| HeaderBar.tsx         |     |     |     | ✏️  |     |     |     |     |     |
| page.tsx              |     |     |     | ✏️  |     |     |     |     |     |
| MonitorPanel.tsx      |     |     |     |     | ✏️  |     |     |     |     |
| overview/\*           |     |     |     |     | ✏️  |     |     |     |     |
| timeline/\*           |     |     |     |     |     | ✏️  |     |     |     |
| history/\*            |     |     |     |     |     |     | ✏️  |     |     |
| zh.json / en.json     |     |     |     |     |     |     |     | ✏️  |     |

**Dependency chain:** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9

Tasks 5, 6, 7 are logically independent tabs but T5 creates MonitorPanel + placeholder files that T6/T7 replace, so they must be serial when using subagent-driven execution.

---

### Task 1: RunEventStore — SQLite Persistence Layer [backend]

**covers:** `run-event-persistence > Run events persisted to SQLite`, `Database migration for run_events table`, `Query events by runId`, `Query run list with filters`, `Run summary aggregation`, `7-day retention with lazy pruning`

**Files:**

- Create: `dashboard/migrations/007_run_events.sql`
- Create: `dashboard/server/run-event-store.ts`
- Create: `dashboard/server/run-event-store.test.ts`

- [ ] **Step 1: Create SQL migration file**

Create `dashboard/migrations/007_run_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  stream TEXT NOT NULL,
  data TEXT NOT NULL,
  agent_id TEXT,
  session_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_run_events_agent_ts ON run_events(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_run_events_session ON run_events(session_key, created_at);
```

- [ ] **Step 2: Write tests for RunEventStore**

Create `dashboard/server/run-event-store.test.ts` with these test cases:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { openDb, type Database } from "./db";
import { RunEventStore, type RunEventRow } from "./run-event-store";

describe("RunEventStore", () => {
  let db: Database;
  let store: RunEventStore;

  beforeEach(() => {
    db = openDb(":memory:");
    store = new RunEventStore(db);
  });

  afterEach(() => {
    db.close();
  });

  // -- appendEvents --
  test("appendEvents inserts events in a transaction", () => {
    store.appendEvents([
      {
        runId: "run-1",
        seq: 1,
        stream: "tool_call",
        data: '{"tool":"read"}',
        agentId: "a1",
        sessionKey: "s1",
      },
      {
        runId: "run-1",
        seq: 2,
        stream: "model",
        data: '{"model":"claude"}',
        agentId: "a1",
        sessionKey: "s1",
      },
    ]);
    const events = store.getRunEvents("run-1");
    expect(events).toHaveLength(2);
    expect(events[0].seq).toBe(1);
    expect(events[1].seq).toBe(2);
  });

  test("appendEvents ignores duplicates (INSERT OR IGNORE)", () => {
    const event = {
      runId: "run-1",
      seq: 1,
      stream: "tool_call",
      data: "{}",
      agentId: "a1",
      sessionKey: "s1",
    };
    store.appendEvents([event]);
    store.appendEvents([event]); // duplicate
    expect(store.getRunEvents("run-1")).toHaveLength(1);
  });

  // -- getRunEvents --
  test("getRunEvents returns events ordered by seq ascending", () => {
    store.appendEvents([
      { runId: "r1", seq: 3, stream: "system", data: "{}", agentId: "a", sessionKey: "s" },
      { runId: "r1", seq: 1, stream: "model", data: "{}", agentId: "a", sessionKey: "s" },
      { runId: "r1", seq: 2, stream: "tool_call", data: "{}", agentId: "a", sessionKey: "s" },
    ]);
    const events = store.getRunEvents("r1");
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  test("getRunEvents returns empty array for unknown runId", () => {
    expect(store.getRunEvents("nonexistent")).toEqual([]);
  });

  // -- listRuns --
  test("listRuns returns distinct runs with pagination", () => {
    for (let i = 1; i <= 30; i++) {
      store.appendEvents([
        { runId: `run-${i}`, seq: 1, stream: "system", data: "{}", agentId: "a", sessionKey: "s" },
      ]);
    }
    const page1 = store.listRuns({ limit: 20 });
    expect(page1.runs).toHaveLength(20);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = store.listRuns({ limit: 20, cursor: page1.nextCursor! });
    expect(page2.runs).toHaveLength(10);
    expect(page2.nextCursor).toBeNull();
  });

  test("listRuns filters by agentId", () => {
    store.appendEvents([
      { runId: "r1", seq: 1, stream: "system", data: "{}", agentId: "agent-a", sessionKey: "s" },
      { runId: "r2", seq: 1, stream: "system", data: "{}", agentId: "agent-b", sessionKey: "s" },
    ]);
    const result = store.listRuns({ agentId: "agent-a" });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].runId).toBe("r1");
  });

  // -- getRunSummary --
  test("getRunSummary aggregates event counts", () => {
    store.appendEvents([
      {
        runId: "r1",
        seq: 1,
        stream: "tool_call",
        data: '{"tool":"read"}',
        agentId: "a",
        sessionKey: "s",
      },
      {
        runId: "r1",
        seq: 2,
        stream: "tool_call",
        data: '{"tool":"write"}',
        agentId: "a",
        sessionKey: "s",
      },
      {
        runId: "r1",
        seq: 3,
        stream: "model",
        data: '{"inputTokens":100,"outputTokens":50}',
        agentId: "a",
        sessionKey: "s",
      },
      { runId: "r1", seq: 4, stream: "compaction", data: "{}", agentId: "a", sessionKey: "s" },
    ]);
    const summary = store.getRunSummary("r1");
    expect(summary).not.toBeNull();
    expect(summary!.toolCalls).toBe(2);
    expect(summary!.modelCalls).toBe(1);
    expect(summary!.compacted).toBe(true);
  });

  test("getRunSummary returns null for unknown run", () => {
    expect(store.getRunSummary("nonexistent")).toBeNull();
  });

  // -- getStats --
  test("getStats returns aggregate statistics", () => {
    store.appendEvents([
      { runId: "r1", seq: 1, stream: "system", data: "{}", agentId: "agent-1", sessionKey: "s" },
      { runId: "r2", seq: 1, stream: "system", data: "{}", agentId: "agent-1", sessionKey: "s" },
      { runId: "r3", seq: 1, stream: "system", data: "{}", agentId: "agent-2", sessionKey: "s" },
    ]);
    const stats = store.getStats();
    expect(stats.totalRuns).toBe(3);
    expect(stats.topAgents[0].agentId).toBe("agent-1");
    expect(stats.topAgents[0].runCount).toBe(2);
  });

  // -- pruning --
  test("pruneOldEvents deletes events older than retention", () => {
    // Insert an event with an old timestamp
    db.prepare(
      "INSERT INTO run_events (run_id, seq, stream, data, agent_id, session_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-8 days'))",
    ).run("old-run", 1, "system", "{}", "a", "s");
    store.appendEvents([
      { runId: "new-run", seq: 1, stream: "system", data: "{}", agentId: "a", sessionKey: "s" },
    ]);

    const deleted = store.pruneOldEvents();
    expect(deleted).toBe(1);
    expect(store.getRunEvents("old-run")).toEqual([]);
    expect(store.getRunEvents("new-run")).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `cd dashboard && pnpm vitest run server/run-event-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement RunEventStore**

Create `dashboard/server/run-event-store.ts`:

```typescript
/**
 * RunEventStore — SQLite persistence for run-scoped execution events.
 *
 * Independent from ProjectionStore (different table, retention policy, queries).
 * Shares the same getDb() connection for zero overhead.
 */
import type BetterSqlite3 from "better-sqlite3";
import { getDb } from "./db";

type Database = BetterSqlite3.Database;
type Statement<B extends unknown[], R> = BetterSqlite3.Statement<B, R>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunEventInput = {
  runId: string;
  seq: number;
  stream: string; // 'tool_call' | 'model' | 'file_op' | 'subagent' | 'compaction' | 'system'
  data: string; // JSON payload
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

export type RunStatus = "completed" | "error" | "running";

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
  cursor?: string; // JSON: { createdAt, runId }
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
// Store
// ---------------------------------------------------------------------------

const RETENTION_DAYS = 7;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class RunEventStore {
  private readonly db: Database;
  private lastPruneAt = 0;

  // Lazy prepared statements
  private _insertEvent: Statement<
    [string, number, string, string, string | null, string | null],
    unknown
  > | null = null;
  private _selectByRunId: Statement<[string], RunEventRow> | null = null;

  constructor(db?: Database) {
    this.db = db ?? getDb();
  }

  private get insertEventStmt() {
    return (this._insertEvent ??= this.db.prepare(
      "INSERT OR IGNORE INTO run_events (run_id, seq, stream, data, agent_id, session_key) VALUES (?, ?, ?, ?, ?, ?)",
    ));
  }

  private get selectByRunIdStmt() {
    return (this._selectByRunId ??= this.db.prepare(
      "SELECT id, run_id, seq, stream, data, agent_id, session_key, created_at FROM run_events WHERE run_id = ? ORDER BY seq ASC",
    ));
  }

  // -- Write --

  /** Batch insert events in a single transaction. Duplicates are silently ignored. */
  appendEvents(events: RunEventInput[]): void {
    if (events.length === 0) return;

    // Lazy prune check
    const now = Date.now();
    if (now - this.lastPruneAt > PRUNE_INTERVAL_MS) {
      this.pruneOldEvents();
      this.lastPruneAt = now;
    }

    const insertMany = this.db.transaction((items: RunEventInput[]) => {
      for (const e of items) {
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
  }

  // -- Read --

  /** Return all events for a run, ordered by seq ascending. */
  getRunEvents(runId: string): RunEventRow[] {
    return this.selectByRunIdStmt.all(runId);
  }

  /** Return paginated list of distinct runs, most recent first. */
  listRuns(filters: RunListFilters = {}): RunListResult {
    const limit = Math.min(filters.limit ?? 20, 100);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.agentId) {
      conditions.push("agent_id = ?");
      params.push(filters.agentId);
    }
    if (filters.sessionKey) {
      conditions.push("session_key = ?");
      params.push(filters.sessionKey);
    }
    if (filters.since) {
      conditions.push("created_at >= ?");
      params.push(filters.since);
    }
    if (filters.until) {
      conditions.push("created_at <= ?");
      params.push(filters.until);
    }
    if (filters.cursor) {
      try {
        const c = JSON.parse(filters.cursor) as { createdAt: string; runId: string };
        conditions.push("(created_at < ? OR (created_at = ? AND run_id < ?))");
        params.push(c.createdAt, c.createdAt, c.runId);
      } catch {
        /* invalid cursor — ignore */
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        run_id AS runId,
        agent_id AS agentId,
        session_key AS sessionKey,
        MIN(created_at) AS firstEventAt,
        MAX(created_at) AS lastEventAt,
        COUNT(*) AS eventCount,
        SUM(CASE WHEN stream = 'tool_call' THEN 1 ELSE 0 END) AS toolCalls,
        SUM(CASE WHEN stream = 'model' THEN 1 ELSE 0 END) AS modelCalls,
        COALESCE(SUM(CASE WHEN stream = 'model' THEN
          COALESCE(json_extract(data, '$.usage.inputTokens'), json_extract(data, '$.inputTokens'), 0) +
          COALESCE(json_extract(data, '$.usage.outputTokens'), json_extract(data, '$.outputTokens'), 0)
        ELSE 0 END), 0) AS totalTokens
      FROM run_events
      ${where}
      GROUP BY run_id
      ORDER BY MAX(created_at) DESC, run_id DESC
      LIMIT ?
    `;
    params.push(limit + 1); // fetch one extra to detect next page

    const rawRows = this.db.prepare(sql).all(...params) as Array<
      Omit<RunListItem, "status"> & { toolCalls: number; modelCalls: number; totalTokens: number }
    >;

    // Derive status: check if last event is a terminal system event
    let rows: RunListItem[] = rawRows.map((row) => ({
      ...row,
      status: this.deriveRunStatus(row.runId, row.lastEventAt),
    }));

    // Post-filter by status (derived field, can't filter in SQL)
    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.pop();
      const last = rows[rows.length - 1];
      nextCursor = JSON.stringify({ createdAt: last.lastEventAt, runId: last.runId });
    }

    return { runs: rows, nextCursor };
  }

  /** Derive run status from last event. */
  private deriveRunStatus(runId: string, lastEventAt: string): RunStatus {
    const lastEvent = this.db
      .prepare("SELECT stream, data FROM run_events WHERE run_id = ? ORDER BY seq DESC LIMIT 1")
      .get(runId) as { stream: string; data: string } | undefined;

    if (!lastEvent) return "completed";

    if (lastEvent.stream === "system") {
      try {
        const d = JSON.parse(lastEvent.data) as Record<string, unknown>;
        if (d.type === "error" || d.state === "error") return "error";
        if (d.type === "complete" || d.state === "final") return "completed";
      } catch {
        /* ignore */
      }
    }

    // If last event is recent (< 5 min), consider it running
    const elapsed = Date.now() - new Date(lastEventAt).getTime();
    if (elapsed < 5 * 60_000) return "running";

    return "completed";
  }

  /** Compute aggregated summary for a single run. Returns null if run not found. */
  getRunSummary(runId: string): RunSummary | null {
    const events = this.getRunEvents(runId);
    if (events.length === 0) return null;

    let toolCalls = 0;
    let modelCalls = 0;
    let fileOps = 0;
    let subagentSpawns = 0;
    let compacted = false;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheTokens = 0;

    for (const event of events) {
      switch (event.stream) {
        case "tool_call":
          toolCalls++;
          break;
        case "model": {
          modelCalls++;
          try {
            const d = JSON.parse(event.data) as Record<string, number>;
            totalInputTokens += d.inputTokens ?? 0;
            totalOutputTokens += d.outputTokens ?? 0;
            totalCacheTokens += d.cacheTokens ?? 0;
          } catch {
            /* ignore */
          }
          break;
        }
        case "file_op":
          fileOps++;
          break;
        case "subagent":
          subagentSpawns++;
          break;
        case "compaction":
          compacted = true;
          break;
      }
    }

    const first = new Date(events[0].created_at).getTime();
    const last = new Date(events[events.length - 1].created_at).getTime();
    const durationMs = Math.max(0, last - first);

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

  /** Return overview statistics. */
  getStats(): OverviewStats {
    const totalRow = this.db
      .prepare("SELECT COUNT(DISTINCT run_id) AS cnt FROM run_events")
      .get() as { cnt: number };

    const todayRow = this.db
      .prepare(
        "SELECT COUNT(DISTINCT run_id) AS cnt FROM run_events WHERE created_at >= date('now')",
      )
      .get() as { cnt: number };

    // Average duration: difference between first and last event per run
    const avgRow = this.db
      .prepare(
        `
      SELECT AVG(duration) AS avg FROM (
        SELECT (julianday(MAX(created_at)) - julianday(MIN(created_at))) * 86400000 AS duration
        FROM run_events
        GROUP BY run_id
        HAVING COUNT(*) > 1
      )
    `,
      )
      .get() as { avg: number | null };

    const topAgents = this.db
      .prepare(
        `
      SELECT agent_id AS agentId, COUNT(DISTINCT run_id) AS runCount
      FROM run_events
      WHERE agent_id IS NOT NULL
      GROUP BY agent_id
      ORDER BY runCount DESC
      LIMIT 5
    `,
      )
      .all() as Array<{ agentId: string; runCount: number }>;

    return {
      totalRuns: totalRow.cnt,
      todayRuns: todayRow.cnt,
      avgDurationMs: Math.round(avgRow.avg ?? 0),
      topAgents,
    };
  }

  // -- Maintenance --

  /** Delete events older than retention period. Returns number of deleted rows. */
  pruneOldEvents(): number {
    const info = this.db
      .prepare(
        `DELETE FROM run_events WHERE created_at < datetime('now', '-${RETENTION_DAYS} days')`,
      )
      .run();
    return info.changes ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckRunEventStore__";

export function getRunEventStore(): RunEventStore {
  const g = globalThis as unknown as Record<string, RunEventStore | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new RunEventStore();
  }
  return g[GLOBAL_KEY];
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd dashboard && pnpm vitest run server/run-event-store.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/migrations/007_run_events.sql dashboard/server/run-event-store.ts dashboard/server/run-event-store.test.ts
git commit -m "[enhanced] [impl] feat(deck): add RunEventStore with SQLite persistence for run events"
```

---

### Task 2: Event Write Pipeline [backend]

**covers:** `run-event-persistence > Batch write pipeline with flush window`, `run-event-persistence > Run events persisted to SQLite` (tool_call scenario, model scenario, no-runId scenario)

**Files:**

- Create: `dashboard/server/run-event-pipeline.ts`
- Create: `dashboard/server/run-event-pipeline.test.ts`
- Modify: `dashboard/server/event-bus.ts` (add `"run.event"` to DeckEventType)
- Modify: `dashboard/server/runtime.ts` (wire pipeline startup + cleanup)

- [ ] **Step 1: Write tests for event classification and batch flush**

Create `dashboard/server/run-event-pipeline.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyEvent, type ClassifiedEvent } from "./run-event-pipeline";

describe("classifyEvent", () => {
  // Real agent event shape: { runId, seq, stream, ts, data: {...}, sessionKey? }
  test("classifies tool_call from agent tool stream", () => {
    const result = classifyEvent("agent", {
      runId: "r1",
      seq: 1,
      stream: "tool",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", name: "bash", toolCallId: "tc-1", args: { cmd: "ls" } },
    });
    expect(result).not.toBeNull();
    expect(result!.stream).toBe("tool_call");
    expect(result!.runId).toBe("r1");
    expect(result!.agentId).toBe("main"); // derived from sessionKey
  });

  // Real chat event shape: { runId, sessionKey, seq, state, usage?, ... }
  test("classifies model from chat final event", () => {
    const result = classifyEvent("chat", {
      runId: "r2",
      sessionKey: "agent:main:main",
      seq: 5,
      state: "final",
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    expect(result).not.toBeNull();
    expect(result!.stream).toBe("model");
  });

  test("returns null for events without runId", () => {
    const result = classifyEvent("agent", {
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      data: { phase: "start" },
    });
    expect(result).toBeNull();
  });

  test("classifies file_op from agent tool with file operation", () => {
    const result = classifyEvent("agent", {
      runId: "r1",
      seq: 2,
      stream: "tool",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", name: "write_file", toolCallId: "tc-2" },
    });
    expect(result).not.toBeNull();
    expect(result!.stream).toBe("file_op");
  });

  test("classifies lifecycle as system event", () => {
    const result = classifyEvent("agent", {
      runId: "r1",
      seq: 1,
      stream: "lifecycle",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start" },
    });
    expect(result).not.toBeNull();
    expect(result!.stream).toBe("system");
  });

  test("classifies subagent spawn from lifecycle with childRunId", () => {
    const result = classifyEvent("agent", {
      runId: "r1",
      seq: 3,
      stream: "lifecycle",
      ts: Date.now(),
      sessionKey: "agent:main:main",
      data: { phase: "start", childRunId: "sub-1", type: "subagent_spawn" },
    });
    expect(result).not.toBeNull();
    expect(result!.stream).toBe("subagent");
  });

  test("classifies compaction from chat compaction event", () => {
    const result = classifyEvent("chat", {
      runId: "r1",
      sessionKey: "agent:main:main",
      seq: 10,
      state: "delta",
      compaction: true,
    });
    expect(result).not.toBeNull();
    expect(result!.stream).toBe("compaction");
  });

  test("skips chat delta events without compaction", () => {
    const result = classifyEvent("chat", {
      runId: "r1",
      sessionKey: "agent:main:main",
      seq: 2,
      state: "delta",
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd dashboard && pnpm vitest run server/run-event-pipeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RunEventPipeline**

Create `dashboard/server/run-event-pipeline.ts`:

```typescript
/**
 * RunEventPipeline — EventBus subscriber that classifies SSE events
 * and batch-writes them to RunEventStore.
 *
 * Flush triggers: 50 events accumulated OR 500ms since first buffered event.
 */
import type { ServerEvent, ServerEventSubscriber } from "./event-bus";
import type { RunEventInput } from "./run-event-store";

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

export type ClassifiedEvent = {
  runId: string;
  stream: string;
  data: Record<string, unknown>;
  agentId?: string;
  sessionKey?: string;
};

const FILE_TOOLS = new Set(["read_file", "write_file", "edit_file", "create_file", "delete_file"]);

/**
 * Classify a raw SSE event into a run_events stream type. Returns null to skip.
 *
 * Real SSE contract:
 * - "chat" events: { runId, sessionKey, seq, state: "delta"|"final"|"error"|"aborted", usage?, ... }
 *   (from ChatEventSchema in src/gateway/protocol/schema/logs-chat.ts)
 * - "agent" events: { runId, seq, stream: "lifecycle"|"tool"|"assistant"|"error", ts, data: {...}, sessionKey? }
 *   (from AgentEventPayload in src/infra/agent-events.ts)
 *   data fields vary by stream:
 *     tool: { phase: "start"|"result"|"error", name, toolCallId, args }
 *     lifecycle: { phase: "start"|"end"|"error"|"fallback", activeModel? }
 *     subagent: not a stream value — subagent spawning uses lifecycle with data.type
 *
 * Note: agentId is NOT a top-level field on agent events. It must be derived
 * from sessionKey (agent:{agentId}:{...}) or from the runtime context.
 */
export function classifyEvent(eventType: string, payload: unknown): ClassifiedEvent | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  const runId = p.runId as string | undefined;
  if (!runId) return null;

  const sessionKey = p.sessionKey as string | undefined;
  // Derive agentId from sessionKey pattern "agent:{agentId}:{...}"
  const agentId = sessionKey ? extractAgentId(sessionKey) : undefined;

  if (eventType === "chat") {
    const state = p.state as string | undefined;
    // Compaction: check for compaction-related content in delta
    if (p.compaction) {
      return { runId, stream: "compaction", data: p, agentId, sessionKey };
    }
    // Only persist final/error — skip delta (too many)
    if (state === "final" || state === "error") {
      return { runId, stream: "model", data: p, agentId, sessionKey };
    }
    return null;
  }

  if (eventType === "agent") {
    // Agent events have: { runId, seq, stream, ts, data, sessionKey? }
    const stream = p.stream as string | undefined;
    const data = (p.data ?? {}) as Record<string, unknown>;
    const phase = data.phase as string | undefined;

    // Lifecycle events → system stream
    if (stream === "lifecycle") {
      // Subagent spawn is reported as lifecycle with subagent-related data
      if (data.childRunId || data.subagentRunId || data.type === "subagent_spawn") {
        return { runId, stream: "subagent", data: { ...p, _inner: data }, agentId, sessionKey };
      }
      return { runId, stream: "system", data: { ...p, _inner: data }, agentId, sessionKey };
    }

    // Tool events
    if (stream === "tool") {
      const toolName = data.name as string | undefined;
      if (toolName && FILE_TOOLS.has(toolName)) {
        return { runId, stream: "file_op", data: { ...p, _inner: data }, agentId, sessionKey };
      }
      return { runId, stream: "tool_call", data: { ...p, _inner: data }, agentId, sessionKey };
    }

    // Error stream
    if (stream === "error") {
      return { runId, stream: "system", data: { ...p, _inner: data }, agentId, sessionKey };
    }

    return null;
  }

  return null;
}

/** Extract agentId from session key like "agent:{agentId}:{...}" */
function extractAgentId(sessionKey: string): string | undefined {
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const FLUSH_THRESHOLD = 50;
const FLUSH_INTERVAL_MS = 500;

export class RunEventPipeline {
  private buffer: RunEventInput[] = [];
  private seqCounters = new Map<string, number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriber: ServerEventSubscriber | null = null;

  constructor(private readonly appendEvents: (events: RunEventInput[]) => void) {}

  /** Get next sequence number for a run. */
  private nextSeq(runId: string): number {
    const current = this.seqCounters.get(runId) ?? 0;
    const next = current + 1;
    this.seqCounters.set(runId, next);
    return next;
  }

  /** Process a single EventBus event. */
  handleEvent(event: ServerEvent): void {
    if (event.type !== "chat" && event.type !== "agent") return;

    const classified = classifyEvent(event.type, event.data);
    if (!classified) return;

    this.buffer.push({
      runId: classified.runId,
      seq: this.nextSeq(classified.runId),
      stream: classified.stream,
      data: JSON.stringify(classified.data),
      agentId: classified.agentId,
      sessionKey: classified.sessionKey,
    });

    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  /** Flush buffered events to store. */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return;

    const batch = this.buffer;
    this.buffer = [];

    try {
      this.appendEvents(batch);
    } catch (err) {
      console.error("[RunEventPipeline] flush error:", err);
    }
  }

  /** Create the EventBus subscriber function. */
  createSubscriber(): ServerEventSubscriber {
    this.subscriber = (event: ServerEvent) => this.handleEvent(event);
    return this.subscriber;
  }

  /** Stop the pipeline and flush remaining events. */
  stop(): void {
    this.flush();
    this.subscriber = null;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd dashboard && pnpm vitest run server/run-event-pipeline.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Add `"run.event"` to DeckEventType**

In `dashboard/server/event-bus.ts`, add `"run.event"` after the P4 additions line:

```typescript
  // P4 additions (A2UI Canvas)
  | "a2ui"
  // P4 additions (Execution Monitor)
  | "run.event";
```

- [ ] **Step 6: Wire pipeline in runtime.ts**

In `dashboard/server/runtime.ts`:

1. Add import at top:

```typescript
import { RunEventPipeline } from "./run-event-pipeline";
import { getRunEventStore } from "./run-event-store";
```

2. In `initRuntime()`, after the `adapter.start()` block (before `const runtime = ...`), add:

```typescript
// Initialize run event pipeline (P4: Execution Monitor)
const runEventStore = getRunEventStore();
const runEventPipeline = new RunEventPipeline((events) => runEventStore.appendEvents(events));
const runEventSubscriber = runEventPipeline.createSubscriber();
eventBus.subscribe(runEventSubscriber);
```

3. In `initRuntime()`, store cleanup ref:

```typescript
gCleanup.__deckRunEventPipeline = runEventPipeline;
gCleanup.__deckRunEventSubscriber = runEventSubscriber;
```

4. In `shutdownRuntime()`, add cleanup before adapter stop:

```typescript
const pipeline = gCleanup.__deckRunEventPipeline as RunEventPipeline | undefined;
const pipelineSub = gCleanup.__deckRunEventSubscriber as ServerEventSubscriber | undefined;
if (pipeline) pipeline.stop();
if (pipelineSub) runtime.eventBus.unsubscribe(pipelineSub);
gCleanup.__deckRunEventPipeline = undefined;
gCleanup.__deckRunEventSubscriber = undefined;
```

5. Add `"run.event"` to the `VALID_DECK_EVENTS` set.

- [ ] **Step 7: Verify build**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 8: Commit**

```bash
git add dashboard/server/run-event-pipeline.ts dashboard/server/run-event-pipeline.test.ts dashboard/server/event-bus.ts dashboard/server/runtime.ts
git commit -m "[enhanced] [impl] feat(deck): add RunEventPipeline — EventBus to SQLite batch writer"
```

---

### Task 3: Monitor API Routes [backend]

**covers:** `monitor-panel > Monitor API routes` (all 3 scenarios)

**Files:**

- Create: `dashboard/src/app/api/monitor/runs/route.ts`
- Create: `dashboard/src/app/api/monitor/runs/[runId]/route.ts`
- Create: `dashboard/src/app/api/monitor/stats/route.ts`

- [ ] **Step 1: Create GET /api/monitor/runs**

Create `dashboard/src/app/api/monitor/runs/route.ts`:

```typescript
import { getRunEventStore } from "@server/run-event-store";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const store = getRunEventStore();
  const { searchParams } = request.nextUrl;

  const result = store.listRuns({
    agentId: searchParams.get("agentId") ?? undefined,
    sessionKey: searchParams.get("sessionKey") ?? undefined,
    since: searchParams.get("since") ?? undefined,
    until: searchParams.get("until") ?? undefined,
    status: searchParams.get("status") as "completed" | "error" | "running" | undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "20", 10) || 20,
  });

  return NextResponse.json(result);
});
```

- [ ] **Step 2: Create GET /api/monitor/runs/[runId]**

Create `dashboard/src/app/api/monitor/runs/[runId]/route.ts`:

```typescript
import { getRunEventStore } from "@server/run-event-store";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ runId: string }> };

export const GET = withAuth(async (_request: NextRequest, ...args: unknown[]) => {
  const ctx = args[0] as RouteContext;
  const { runId } = await ctx.params;
  const store = getRunEventStore();

  const events = store.getRunEvents(runId);
  const summary = store.getRunSummary(runId);

  if (events.length === 0) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ events, summary });
});
```

- [ ] **Step 3: Create GET /api/monitor/stats**

Create `dashboard/src/app/api/monitor/stats/route.ts`:

```typescript
import { getRunEventStore } from "@server/run-event-store";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const store = getRunEventStore();
  const stats = store.getStats();
  return NextResponse.json(stats);
});
```

- [ ] **Step 4: Verify build**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/monitor/
git commit -m "[enhanced] [impl] feat(deck): add Monitor API routes (runs, runs/[runId], stats)"
```

---

### Task 4: UI Store & Panel Type Migration [frontend]

**covers:** `monitor-panel > Monitor panel replaces Activity panel`, `monitor-panel > Gateway panel removed from NavRail`, `monitor-panel > Monitor panel registered in NavRail OBSERVE group`, `monitor-panel > Monitor Zustand store`

**Files:**

- Create: `dashboard/src/stores/monitor.ts`
- Modify: `dashboard/src/stores/ui.ts`
- Modify: `dashboard/src/components/layout/NavRail.tsx`
- Modify: `dashboard/src/components/layout/HeaderBar.tsx`
- Modify: `dashboard/src/app/page.tsx`
- Delete: `dashboard/src/stores/activity.ts`
- Move: `panels/gateway/ConnectionCard.tsx` → `panels/monitor/overview/ConnectionCard.tsx`
- Move: `panels/gateway/HealthCard.tsx` → `panels/monitor/overview/HealthCard.tsx`
- Move: `panels/gateway/HeartbeatCard.tsx` → `panels/monitor/overview/HeartbeatCard.tsx`
- Delete: `panels/gateway/GatewayPanel.tsx`
- Delete: `panels/activity/ActivityPanel.tsx`
- Delete: `panels/activity/EventTimeline.tsx`
- Delete: `panels/activity/useActivitySSE.ts`

- [ ] **Step 1: Create monitor store**

Create `dashboard/src/stores/monitor.ts`:

```typescript
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorTab = "overview" | "timeline" | "history";

export type ActivityEventType = "tool_call" | "chat" | "status" | "agent" | "system";

export interface LiveEvent {
  id: string;
  timestamp: number;
  type: ActivityEventType;
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
}

export type RunStatus = "completed" | "error" | "running";

export interface RunListItem {
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
}

export interface RunSummary {
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
}

export interface RunEventRow {
  id: number;
  run_id: string;
  seq: number;
  stream: string;
  data: string;
  agent_id: string | null;
  session_key: string | null;
  created_at: string;
}

export interface OverviewStats {
  totalRuns: number;
  todayRuns: number;
  avgDurationMs: number;
  topAgents: Array<{ agentId: string; runCount: number }>;
}

interface MonitorFilters {
  agentId: string | null;
  sessionKey: string | null;
  since: string | null;
  until: string | null;
  status: RunStatus | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_LIVE_EVENTS = 200;

interface MonitorState {
  // Tab
  activeTab: MonitorTab;
  setActiveTab: (tab: MonitorTab) => void;

  // Live events (migrated from activity store)
  liveEvents: LiveEvent[];
  addLiveEvent: (event: LiveEvent) => void;
  addLiveEvents: (events: LiveEvent[]) => void;

  // Run list (History tab)
  runs: RunListItem[];
  nextCursor: string | null;
  filters: MonitorFilters;
  runsLoading: boolean;
  fetchRuns: (reset?: boolean) => Promise<void>;
  loadMoreRuns: () => Promise<void>;
  setFilter: (key: keyof MonitorFilters, value: string | null) => void;
  clearFilters: () => void;

  // Run detail (Timeline tab)
  selectedRunId: string | null;
  runEvents: RunEventRow[];
  runSummary: RunSummary | null;
  runDetailLoading: boolean;
  selectRun: (runId: string) => void;
  fetchRunDetail: (runId: string) => Promise<void>;

  // Overview stats
  stats: OverviewStats | null;
  statsLoading: boolean;
  fetchStats: () => Promise<void>;

  // Live feed (Overview tab)
  liveLoading: boolean;
  fetchRecentLiveEvents: () => Promise<void>;
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
  activeTab: "overview",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // -- Live events --
  liveEvents: [],
  addLiveEvent: (event) =>
    set((state) => {
      if (state.liveEvents.some((e) => e.id === event.id)) return state;
      const updated = [event, ...state.liveEvents];
      return { liveEvents: updated.slice(0, MAX_LIVE_EVENTS) };
    }),
  addLiveEvents: (newEvents) =>
    set((state) => {
      const existingIds = new Set(state.liveEvents.map((e) => e.id));
      const unique = newEvents.filter((e) => !existingIds.has(e.id));
      if (unique.length === 0) return state;
      const merged = [...unique, ...state.liveEvents]
        .toSorted((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_LIVE_EVENTS);
      return { liveEvents: merged };
    }),

  // -- Runs --
  runs: [],
  nextCursor: null,
  filters: { agentId: null, sessionKey: null, since: null, until: null, status: null },
  runsLoading: false,

  fetchRuns: async (reset = true) => {
    set({ runsLoading: true });
    const { filters } = get();
    try {
      const params = new URLSearchParams();
      if (filters.agentId) params.set("agentId", filters.agentId);
      if (filters.sessionKey) params.set("sessionKey", filters.sessionKey);
      if (filters.since) params.set("since", filters.since);
      if (filters.until) params.set("until", filters.until);
      if (filters.status) params.set("status", filters.status);
      params.set("limit", "20");

      const res = await fetch(`/api/monitor/runs?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { runs: RunListItem[]; nextCursor: string | null };
      set(
        reset
          ? { runs: data.runs, nextCursor: data.nextCursor }
          : (s) => ({
              runs: [...s.runs, ...data.runs],
              nextCursor: data.nextCursor,
            }),
      );
    } catch {
      /* ignore */
    } finally {
      set({ runsLoading: false });
    }
  },

  loadMoreRuns: async () => {
    const { nextCursor } = get();
    if (!nextCursor) return;
    set({ runsLoading: true });
    const { filters } = get();
    try {
      const params = new URLSearchParams();
      if (filters.agentId) params.set("agentId", filters.agentId);
      if (filters.sessionKey) params.set("sessionKey", filters.sessionKey);
      if (filters.since) params.set("since", filters.since);
      if (filters.until) params.set("until", filters.until);
      params.set("cursor", nextCursor);
      params.set("limit", "20");

      const res = await fetch(`/api/monitor/runs?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { runs: RunListItem[]; nextCursor: string | null };
      set((s) => ({ runs: [...s.runs, ...data.runs], nextCursor: data.nextCursor }));
    } catch {
      /* ignore */
    } finally {
      set({ runsLoading: false });
    }
  },

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () =>
    set({ filters: { agentId: null, sessionKey: null, since: null, until: null } }),

  // -- Run detail --
  selectedRunId: null,
  runEvents: [],
  runSummary: null,
  runDetailLoading: false,

  selectRun: (runId) => {
    set({ selectedRunId: runId, activeTab: "timeline" });
    void get().fetchRunDetail(runId);
  },

  fetchRunDetail: async (runId) => {
    set({ runDetailLoading: true });
    try {
      const res = await fetch(`/api/monitor/runs/${encodeURIComponent(runId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { events: RunEventRow[]; summary: RunSummary | null };
      set({ runEvents: data.events, runSummary: data.summary, selectedRunId: runId });
    } catch {
      /* ignore */
    } finally {
      set({ runDetailLoading: false });
    }
  },

  // -- Stats --
  stats: null,
  statsLoading: false,

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const res = await fetch("/api/monitor/stats");
      if (!res.ok) return;
      const data = (await res.json()) as OverviewStats;
      set({ stats: data });
    } catch {
      /* ignore */
    } finally {
      set({ statsLoading: false });
    }
  },

  // -- Live feed --
  liveLoading: false,

  fetchRecentLiveEvents: async () => {
    set({ liveLoading: true });
    try {
      const res = await fetch("/api/activity?limit=100");
      if (!res.ok) return;
      const data = (await res.json()) as { events?: LiveEvent[] };
      const events = data.events ?? [];
      set({ liveEvents: events.slice(0, MAX_LIVE_EVENTS) });
    } catch {
      /* ignore */
    } finally {
      set({ liveLoading: false });
    }
  },
}));
```

- [ ] **Step 2: Update Panel type in stores/ui.ts**

In `dashboard/src/stores/ui.ts`, update the `Panel` type:

- Remove `"gateway"` and `"activity"` from the union
- Add `"monitor"` to the union (place it where `"gateway"` was in the CORE group area)

The type should become:

```typescript
export type Panel =
  | "chat"
  | "agents"
  | "routing"
  | "monitor"
  | "models"
  | "subagents"
  | "usage"
  | "sessions"
  | "memory"
  | "logs"
  | "cron"
  | "webhooks"
  | "approvals"
  | "skills"
  | "budget"
  | "alerts"
  | "channels"
  | "config"
  | "docs"
  | "settings";
```

- [ ] **Step 3: Update NavRail.tsx**

In `dashboard/src/components/layout/NavRail.tsx`:

1. Replace imports: remove `Radio` and `Activity`, add `MonitorDot` from lucide-react.
2. In the `navGroups` array:
   - In the `"core"` group, remove the `gateway` entry entirely
   - In the `"observe"` group, replace the `activity` entry with:
     ```typescript
     { panel: "monitor", labelKey: "monitor", icon: MonitorDot },
     ```

- [ ] **Step 4: Update HeaderBar.tsx — status pill click navigates to monitor**

In `dashboard/src/components/layout/HeaderBar.tsx`:

1. Import `useUIStore` (already imported)
2. Add `setActivePanel` to destructured state:
   ```typescript
   const { activePanel, theme, locale, setTheme, setLocale, setMobileNavOpen, setActivePanel } =
     useUIStore();
   ```
3. Wrap the status pill `<div>` with a clickable button that navigates to monitor:
   ```tsx
   <button
     onClick={() => setActivePanel("monitor")}
     className={cn(
       "flex items-center gap-1.5 h-6 rounded-full text-[11px] font-medium border px-2.5 cursor-pointer transition-colors",
       cfg.bg,
     )}
   >
     ...existing dot + label...
   </button>
   ```

- [ ] **Step 5: Update page.tsx — replace lazy imports**

In `dashboard/src/app/page.tsx`:

1. Remove `LazyGatewayPanel` and `LazyActivityPanel` lazy imports
2. Add `LazyMonitorPanel`:
   ```typescript
   const LazyMonitorPanel = lazy(() =>
     import("@/components/panels/monitor/MonitorPanel").then((m) => ({ default: m.MonitorPanel })),
   );
   ```
3. In `ActivePanel` function:
   - Remove the `"gateway"` branch and `"activity"` branch
   - Add `"monitor"` branch:
     ```typescript
     } else if (panel === "monitor") {
       LazyComponent = LazyMonitorPanel;
     ```

- [ ] **Step 6: Create MonitorPanel placeholder** (required for page.tsx import)

Create `dashboard/src/components/panels/monitor/MonitorPanel.tsx` as placeholder:

```tsx
"use client";

import { useTranslations } from "next-intl";

export function MonitorPanel() {
  const t = useTranslations("monitor");
  return (
    <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
      {t("title")}
    </div>
  );
}
```

This will be replaced with the full implementation in Task 5.

- [ ] **Step 7: Move gateway diagnostic cards to monitor/overview/**

```bash
mkdir -p dashboard/src/components/panels/monitor/overview
cp dashboard/src/components/panels/gateway/ConnectionCard.tsx dashboard/src/components/panels/monitor/overview/ConnectionCard.tsx
cp dashboard/src/components/panels/gateway/HealthCard.tsx dashboard/src/components/panels/monitor/overview/HealthCard.tsx
cp dashboard/src/components/panels/gateway/HeartbeatCard.tsx dashboard/src/components/panels/monitor/overview/HeartbeatCard.tsx
```

No import path changes needed inside the cards — they import from `@/stores/gateway` and `@/components/ui/*` which remain valid.

- [ ] **Step 8: Delete old files**

```bash
rm -rf dashboard/src/components/panels/gateway/
rm -rf dashboard/src/components/panels/activity/
rm dashboard/src/stores/activity.ts
```

- [ ] **Step 9: Update ActivityFeed.tsx to use monitor store**

`dashboard/src/components/panels/routing/ActivityFeed.tsx` imports from `@/stores/activity`. Update:

- Replace `import { useActivityStore, type ActivityEvent } from "@/stores/activity"` with `import { useMonitorStore, type LiveEvent } from "@/stores/monitor"`
- Replace `useActivityStore` calls with `useMonitorStore` (field names: `events` → `liveEvents`, `addEvent` → `addLiveEvent`, `fetchRecent` → `fetchRecentLiveEvents`)
- Replace `ActivityEvent` type references with `LiveEvent`

- [ ] **Step 10: Update useKeyboardShortcuts.ts**

In `dashboard/src/hooks/useKeyboardShortcuts.ts`, update the `NAV_PANELS` array:

- Replace `"gateway"` with `"monitor"`
- Remove `"activity"` (or replace with another panel like `"routing"`)

- [ ] **Step 11: Fix remaining TypeScript errors**

Run `cd dashboard && pnpm tsc --noEmit` and fix any import references to deleted files. Common fixes:

- Any file importing from `@/stores/activity` → update to `@/stores/monitor` (with LiveEvent type)
- Any file importing from `panels/gateway/` → dead code, remove import
- Any file referencing `"activity"` or `"gateway"` as Panel values → update to `"monitor"`

- [ ] **Step 12: Verify build**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 13: Commit**

```bash
git add -A dashboard/src/stores/ dashboard/src/components/panels/monitor/ dashboard/src/components/panels/gateway/ dashboard/src/components/panels/activity/ dashboard/src/components/layout/ dashboard/src/app/page.tsx dashboard/src/components/panels/routing/ActivityFeed.tsx
git commit -m "[enhanced] [impl] feat(deck): migrate Activity+Gateway → Monitor panel with Zustand store"
```

---

### Task 5: Monitor Panel — Overview Tab [frontend]

**covers:** `monitor-panel > Monitor panel has three tabs`, `monitor-panel > Overview tab contains gateway diagnostics and live feed`

**Files:**

- Create: `dashboard/src/components/panels/monitor/MonitorPanel.tsx`
- Create: `dashboard/src/components/panels/monitor/overview/OverviewTab.tsx`
- Create: `dashboard/src/components/panels/monitor/overview/LiveFeed.tsx`

- [ ] **Step 1: Create MonitorPanel.tsx**

Create `dashboard/src/components/panels/monitor/MonitorPanel.tsx`:

```tsx
"use client";

import { MonitorDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMonitorStore, type MonitorTab } from "@/stores/monitor";
import { HistoryTab } from "./history/HistoryTab";
import { OverviewTab } from "./overview/OverviewTab";
import { TimelineTab } from "./timeline/TimelineTab";

export function MonitorPanel() {
  const t = useTranslations("monitor");
  const { activeTab, setActiveTab } = useMonitorStore();

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-muted)]">
          <MonitorDot size={14} className="text-[var(--accent)]" />
        </div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          {t("title")}
        </h2>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MonitorTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("tabs.timeline")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-auto">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="timeline" className="flex-1 overflow-auto">
          <TimelineTab />
        </TabsContent>
        <TabsContent value="history" className="flex-1 overflow-auto">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Create OverviewTab.tsx**

Create `dashboard/src/components/panels/monitor/overview/OverviewTab.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMonitorStore } from "@/stores/monitor";
import { ConnectionCard } from "./ConnectionCard";
import { HealthCard } from "./HealthCard";
import { HeartbeatCard } from "./HeartbeatCard";
import { LiveFeed } from "./LiveFeed";

export function OverviewTab() {
  const t = useTranslations("monitor");
  const { stats, fetchStats } = useMonitorStore();

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <div className="p-4 space-y-4">
      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t("stats.totalRuns")} value={String(stats.totalRuns)} />
          <StatCard label={t("stats.todayRuns")} value={String(stats.todayRuns)} />
          <StatCard
            label={t("stats.avgDuration")}
            value={stats.avgDurationMs > 0 ? `${Math.round(stats.avgDurationMs / 1000)}s` : "—"}
          />
          <StatCard label={t("stats.topAgent")} value={stats.topAgents[0]?.agentId ?? "—"} />
        </div>
      )}

      {/* Diagnostics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ConnectionCard />
        <HealthCard />
        <HeartbeatCard />
      </div>

      {/* Live event feed */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          {t("liveFeed")}
        </h3>
        <LiveFeed />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
      <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-lg font-semibold text-[var(--text-primary)] mt-0.5">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create LiveFeed.tsx (adapted from EventTimeline)**

Create `dashboard/src/components/panels/monitor/overview/LiveFeed.tsx`:

Adapt the existing `EventTimeline` component — keep the same visual rendering (dot + badge + relative time), but consume from `useMonitorStore().liveEvents` instead of `useActivityStore().events`. Also add SSE subscription inline (from `useActivitySSE`).

```tsx
"use client";

import { MonitorDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMonitorStore, type ActivityEventType, type LiveEvent } from "@/stores/monitor";

const TYPE_BADGE_STYLES: Record<ActivityEventType, string> = {
  tool_call: "bg-[var(--purple-muted)] text-[var(--purple)]",
  chat: "bg-[var(--accent-muted)] text-[var(--accent)]",
  status: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
  agent: "bg-[var(--success-muted)] text-[var(--success)]",
  system: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

const TYPE_DOT_COLORS: Record<ActivityEventType, string> = {
  tool_call: "bg-[var(--purple)]",
  chat: "bg-[var(--accent)]",
  status: "bg-[var(--warning)]",
  agent: "bg-[var(--success)]",
  system: "bg-[var(--neutral-muted-text)]",
};

function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 0) return "now";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LiveFeed() {
  const t = useTranslations("monitor");
  const { liveEvents, addLiveEvent, fetchRecentLiveEvents } = useMonitorStore();

  // Load recent events on mount
  useEffect(() => {
    void fetchRecentLiveEvents();
  }, [fetchRecentLiveEvents]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("activity.event", (e) => {
      try {
        const payload = JSON.parse(e.data) as LiveEvent;
        if (payload.id && payload.description) {
          addLiveEvent({
            id: payload.id,
            timestamp: payload.timestamp ?? Date.now(),
            type: payload.type ?? "system",
            agentId: payload.agentId,
            agentName: payload.agentName,
            description: payload.description,
            details: payload.details,
          });
        }
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [addLiveEvent]);

  if (liveEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-[var(--text-secondary)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <MonitorDot size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm">{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {liveEvents.slice(0, 50).map((event) => (
        <div
          key={event.id}
          className="group relative flex items-start gap-3 py-2.5 transition-panel"
        >
          <div className="flex flex-col items-center shrink-0 pt-0.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full ring-2 ring-[var(--bg-secondary)]",
                TYPE_DOT_COLORS[event.type] ?? TYPE_DOT_COLORS.system,
              )}
            />
            <div className="w-px flex-1 bg-[var(--border-subtle)] mt-1 group-last:hidden" />
          </div>
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className={cn(
                  "font-medium text-[10px] h-auto py-0.5",
                  TYPE_BADGE_STYLES[event.type] ?? TYPE_BADGE_STYLES.system,
                )}
              >
                {event.type}
              </Badge>
              {(event.agentName ?? event.agentId) && (
                <span className="text-xs font-medium text-[var(--accent)]">
                  {event.agentName ?? event.agentId}
                </span>
              )}
              <span className="text-[10px] font-mono text-[var(--text-secondary)] ml-auto shrink-0">
                {relativeTime(event.timestamp)}
              </span>
            </div>
            <p className="text-xs text-[var(--text-primary)] break-words">{event.description}</p>
            {event.details && (
              <pre className="text-[11px] mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-mono max-h-[60px] overflow-hidden break-words whitespace-pre-wrap">
                {event.details}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder TimelineTab and HistoryTab** (to be filled in Tasks 6 and 7)

Create `dashboard/src/components/panels/monitor/timeline/TimelineTab.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

export function TimelineTab() {
  const t = useTranslations("monitor");
  return (
    <div className="p-4 text-sm text-[var(--text-secondary)]">
      {t("tabs.timeline")} — {t("comingSoon")}
    </div>
  );
}
```

Create `dashboard/src/components/panels/monitor/history/HistoryTab.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

export function HistoryTab() {
  const t = useTranslations("monitor");
  return (
    <div className="p-4 text-sm text-[var(--text-secondary)]">
      {t("tabs.history")} — {t("comingSoon")}
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/monitor/ dashboard/src/stores/monitor.ts
git commit -m "[enhanced] [impl] feat(deck): add MonitorPanel with Overview tab, diagnostics cards, live feed"
```

---

### Task 6: Monitor Panel — Timeline Tab [frontend]

**covers:** `run-timeline-view > Gantt-style run timeline`, `run-timeline-view > Tool waterfall view`, `run-timeline-view > File change summary`, `run-timeline-view > Model statistics panel`, `run-timeline-view > Subagent execution tree`, `run-timeline-view > Compaction event markers`, `run-timeline-view > Stream color coding`

**Files:**

- Create: `dashboard/src/components/panels/monitor/timeline/TimelineTab.tsx` (replace placeholder)
- Create: `dashboard/src/components/panels/monitor/timeline/RunTimeline.tsx`
- Create: `dashboard/src/components/panels/monitor/timeline/ToolWaterfall.tsx`
- Create: `dashboard/src/components/panels/monitor/timeline/FileChangeSummary.tsx`
- Create: `dashboard/src/components/panels/monitor/timeline/ModelStats.tsx`
- Create: `dashboard/src/components/panels/monitor/timeline/SubagentTree.tsx`

- [ ] **Step 1: Replace TimelineTab.tsx with full implementation**

The TimelineTab shows: run selector dropdown (if no run selected), then Gantt timeline + details sections. When a runId is selected (from History tab click or URL param), load events and display.

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMonitorStore } from "@/stores/monitor";
import { FileChangeSummary } from "./FileChangeSummary";
import { ModelStats } from "./ModelStats";
import { RunTimeline } from "./RunTimeline";
import { SubagentTree } from "./SubagentTree";
import { ToolWaterfall } from "./ToolWaterfall";

export function TimelineTab() {
  const t = useTranslations("monitor");
  const { selectedRunId, runEvents, runSummary, runDetailLoading, fetchRunDetail } =
    useMonitorStore();

  // Check URL for deep link
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlRunId = params.get("runId");
    if (urlRunId && urlRunId !== selectedRunId) {
      void fetchRunDetail(urlRunId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedRunId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
        {t("timeline.selectRun")}
      </div>
    );
  }

  if (runDetailLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (runEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
        {t("timeline.noEvents")}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-auto">
      {/* Run header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {t("timeline.runId")}:{" "}
          <span className="font-mono text-[var(--accent)]">{selectedRunId}</span>
        </h3>
        {runSummary && (
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span>
              {runSummary.toolCalls} {t("timeline.tools")}
            </span>
            <span>
              {runSummary.modelCalls} {t("timeline.models")}
            </span>
            <span>
              {formatTokens(runSummary.totalInputTokens + runSummary.totalOutputTokens)}{" "}
              {t("timeline.tokens")}
            </span>
            <span>{formatDuration(runSummary.durationMs)}</span>
          </div>
        )}
      </div>

      {/* Gantt timeline */}
      <RunTimeline events={runEvents} />

      {/* Tool waterfall */}
      <ToolWaterfall events={runEvents.filter((e) => e.stream === "tool_call")} />

      {/* File changes */}
      <FileChangeSummary events={runEvents.filter((e) => e.stream === "file_op")} />

      {/* Model stats */}
      <ModelStats events={runEvents.filter((e) => e.stream === "model")} />

      {/* Subagent tree */}
      <SubagentTree events={runEvents.filter((e) => e.stream === "subagent")} />
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
```

- [ ] **Step 2: Create RunTimeline.tsx (CSS Grid Gantt)**

Create the Gantt-style timeline using CSS Grid with `left` and `width` percentages. Each stream type gets a color from `STREAM_COLORS`. Compaction events rendered as vertical marker lines.

The implementation should:

- Parse `created_at` from each event to compute relative position
- Calculate total run duration from first to last event
- Render bars with `left: ${startPct}%` and `width: ${max(durationPct, 0.5)}%`
- Use CSS variable colors for each stream type per spec: tool_call=purple, model=accent, file_op=success, subagent=warning, compaction=warning dashed, system=neutral
- Render compaction events as vertical lines with "Context Compacted" label

- [ ] **Step 3: Create ToolWaterfall.tsx**

Hierarchical tree of tool calls with expandable details (args, result, duration). Parse `data` JSON from tool_call events. Flat list initially, clicking expands to show full args/result JSON.

- [ ] **Step 4: Create FileChangeSummary.tsx**

Group file_op events by operation type (read/write/modify), show file paths and operation count badges. If no file_op events, show "No file changes" message.

- [ ] **Step 5: Create ModelStats.tsx**

Per-model call count, token breakdown (input/output/cache), fallback markers. Parse `data` JSON from model events to extract model name, token usage.

- [ ] **Step 6: Create SubagentTree.tsx**

Wrapper around shared `LineageTree` component. Transform `subagent` stream events into `LineageNode[]` format. If no subagent events, don't render the section.

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { LineageTree } from "@/components/shared/LineageTree";
import type { LineageNode } from "@/stores/deck-subagents";
import type { RunEventRow } from "@/stores/monitor";

interface SubagentTreeProps {
  events: RunEventRow[];
}

export function SubagentTree({ events }: SubagentTreeProps) {
  const t = useTranslations("monitor");

  const nodes = useMemo((): LineageNode[] => {
    const validStatuses = new Set(["active", "completed", "failed", "timeout"]);
    return events.map((event) => {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      const rawStatus = (data.status as string) ?? "active";
      return {
        runId: (data.subagentRunId as string) ?? event.run_id,
        agentId: (data.agentId as string) ?? "",
        agentName: (data.agentName as string) ?? undefined,
        parentRunId: (data.parentRunId as string) ?? null,
        status: validStatuses.has(rawStatus) ? rawStatus : "active",
        depth: (data.depth as number) ?? 0,
        sessionKey: event.session_key ?? "",
      };
    });
  }, [events]);

  if (nodes.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
        {t("timeline.subagents")}
      </h4>
      <div className="rounded-lg bg-[var(--bg-tertiary)] p-3 ring-1 ring-[var(--border-subtle)]">
        <LineageTree nodes={nodes} rootSessionKey="" />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/panels/monitor/timeline/
git commit -m "[enhanced] [impl] feat(deck): add Monitor Timeline tab — Gantt, waterfall, file summary, model stats, subagent tree"
```

---

### Task 7: Monitor Panel — History Tab [frontend]

**covers:** `run-history-query > Run history list with pagination`, `run-history-query > Run history filtering`, `run-history-query > Run detail navigation`, `run-history-query > Run status indicators`, `run-history-query > Run summary cards in History`

**Files:**

- Create: `dashboard/src/components/panels/monitor/history/HistoryTab.tsx` (replace placeholder)

- [ ] **Step 1: Replace HistoryTab.tsx with full implementation**

The HistoryTab shows:

- Filter bar at top: agent dropdown, session input, time range selector, status filter, clear button
- Run list with inline metrics: tool count, model calls, tokens, duration, status badge
- Infinite scroll (load 20, append on scroll to bottom)
- Click row → `selectRun(runId)` which switches to Timeline tab

```tsx
"use client";

import { Filter, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMonitorStore, type RunListItem } from "@/stores/monitor";

const TIME_RANGE_VALUES = ["1h", "24h", "7d", "all"] as const;

export function HistoryTab() {
  const t = useTranslations("monitor");
  const {
    runs,
    nextCursor,
    runsLoading,
    filters,
    fetchRuns,
    loadMoreRuns,
    setFilter,
    clearFilters,
    selectRun,
  } = useMonitorStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  // Re-fetch on filter change
  useEffect(() => {
    void fetchRuns(true);
  }, [filters.agentId, filters.sessionKey, filters.since, filters.until, filters.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || runsLoading || !nextCursor) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      void loadMoreRuns();
    }
  }, [runsLoading, nextCursor, loadMoreRuns]);

  const handleTimeRange = (value: string) => {
    if (value === "all") {
      setFilter("since", null);
      setFilter("until", null);
      return;
    }
    const now = new Date();
    let since: Date;
    if (value === "1h") since = new Date(now.getTime() - 3600_000);
    else if (value === "24h") since = new Date(now.getTime() - 86400_000);
    else since = new Date(now.getTime() - 7 * 86400_000);
    setFilter("since", since.toISOString());
    setFilter("until", null);
  };

  const hasActiveFilters = filters.agentId || filters.sessionKey || filters.since || filters.status;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0 flex-wrap">
        <Filter size={14} className="text-[var(--text-secondary)]" />
        <Input
          type="text"
          value={filters.agentId ?? ""}
          onChange={(e) => setFilter("agentId", e.target.value || null)}
          placeholder={t("history.filterAgent")}
          className="text-xs h-7 w-[140px]"
        />
        <Input
          type="text"
          value={filters.sessionKey ?? ""}
          onChange={(e) => setFilter("sessionKey", e.target.value || null)}
          placeholder={t("history.filterSession")}
          className="text-xs h-7 w-[140px]"
        />
        <Select onValueChange={handleTimeRange} defaultValue="all">
          <SelectTrigger className="w-[80px] h-7 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGE_VALUES.map((v) => (
              <SelectItem key={v} value={v}>
                {t(`history.time.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? "all"}
          onValueChange={(v) => setFilter("status", v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[100px] h-7 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.time.all")}</SelectItem>
            <SelectItem value="completed">{t("history.completed")}</SelectItem>
            <SelectItem value="error">{t("history.error")}</SelectItem>
            <SelectItem value="running">{t("history.running")}</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
            <X size={12} className="mr-1" />
            {t("history.clearFilters")}
          </Button>
        )}
      </div>

      {/* Run list */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {runs.length === 0 && !runsLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
            <Search size={24} className="mb-2 opacity-40" />
            <p className="text-sm">{t("history.noRuns")}</p>
          </div>
        )}

        {runs.map((run) => (
          <RunRow key={run.runId} run={run} onClick={() => selectRun(run.runId)} />
        ))}

        {runsLoading && (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-[var(--text-secondary)]" />
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-[var(--success-muted)] text-[var(--success)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger)]",
  running: "bg-[var(--accent-muted)] text-[var(--accent)]",
};

function RunRow({ run, onClick }: { run: RunListItem; onClick: () => void }) {
  const t = useTranslations("monitor");
  const elapsed = new Date(run.lastEventAt).getTime() - new Date(run.firstEventAt).getTime();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] transition-colors text-left cursor-pointer"
    >
      {/* Status badge */}
      <Badge
        className={cn(
          "text-[10px] h-auto py-0.5 shrink-0",
          STATUS_STYLES[run.status] ?? STATUS_STYLES.completed,
        )}
      >
        {run.status === "running" && (
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1" />
        )}
        {t(`history.${run.status}`)}
      </Badge>

      {/* Run ID + agent */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-medium text-[var(--text-primary)] truncate">
          {run.runId}
        </p>
        <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">
          {run.agentId ?? t("history.unknownAgent")} · {run.sessionKey ?? "—"}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          {run.toolCalls} {t("timeline.tools")}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          {run.modelCalls} {t("timeline.models")}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          {formatTokens(run.totalTokens)} {t("timeline.tokens")}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          {formatDuration(elapsed)}
        </span>
      </div>
    </button>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m`;
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/monitor/history/
git commit -m "[enhanced] [impl] feat(deck): add Monitor History tab — run list, filters, infinite scroll, navigation"
```

---

### Task 8: i18n Keys [frontend]

**covers:** `monitor-panel > i18n keys for Monitor panel`

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add monitor namespace to zh.json**

Add `"monitor"` namespace with all keys used by the Monitor panel components. Remove the `"activity"` namespace. Keep `"gateway"` namespace keys that are used by the migrated diagnostic cards (ConnectionCard, HealthCard, HeartbeatCard still use `useTranslations("gateway")`).

```json
"monitor": {
  "title": "监控",
  "tabs": {
    "overview": "概览",
    "timeline": "时间线",
    "history": "历史"
  },
  "comingSoon": "即将推出",
  "liveFeed": "实时事件",
  "noEvents": "暂无事件",
  "stats": {
    "totalRuns": "总运行",
    "todayRuns": "今日运行",
    "avgDuration": "平均耗时",
    "topAgent": "最活跃 Agent"
  },
  "timeline": {
    "selectRun": "从历史记录中选择一个运行以查看时间线",
    "noEvents": "该运行没有记录的事件",
    "runId": "运行 ID",
    "tools": "工具",
    "models": "模型",
    "tokens": "tokens",
    "duration": "耗时",
    "toolCalls": "工具调用",
    "fileChanges": "文件变更",
    "noFileChanges": "无文件变更",
    "modelStats": "模型统计",
    "subagents": "子 Agent",
    "compaction": "上下文压缩",
    "read": "读取",
    "write": "写入",
    "modify": "修改",
    "inputTokens": "输入",
    "outputTokens": "输出",
    "cacheTokens": "缓存",
    "calls": "次调用",
    "fallback": "降级",
    "noTimedEvents": "无计时事件",
    "expandDetails": "展开详情",
    "collapseDetails": "收起"
  },
  "history": {
    "filterAgent": "按 Agent 过滤",
    "filterSession": "按会话过滤",
    "clearFilters": "清除过滤",
    "noRuns": "暂无运行记录",
    "unknownAgent": "未知 Agent",
    "events": "事件",
    "completed": "已完成",
    "error": "错误",
    "running": "运行中",
    "time": {
      "1h": "1小时",
      "24h": "24小时",
      "7d": "7天",
      "all": "全部"
    }
  }
}
```

Also update `nav` namespace:

- Remove `"activity": "动态"` and `"gateway": "网关"`
- Add `"monitor": "监控"`

- [ ] **Step 2: Add matching monitor namespace to en.json**

Mirror all keys with English translations.

```json
"monitor": {
  "title": "Monitor",
  "tabs": {
    "overview": "Overview",
    "timeline": "Timeline",
    "history": "History"
  },
  "comingSoon": "Coming Soon",
  "liveFeed": "Live Feed",
  "noEvents": "No events yet",
  "stats": {
    "totalRuns": "Total Runs",
    "todayRuns": "Today",
    "avgDuration": "Avg Duration",
    "topAgent": "Top Agent"
  },
  "timeline": {
    "selectRun": "Select a run from History to view its timeline",
    "noEvents": "No events recorded for this run",
    "runId": "Run ID",
    "tools": "tools",
    "models": "models",
    "tokens": "tokens",
    "duration": "duration",
    "toolCalls": "Tool Calls",
    "fileChanges": "File Changes",
    "noFileChanges": "No file changes",
    "modelStats": "Model Statistics",
    "subagents": "Subagents",
    "compaction": "Context Compacted",
    "read": "Read",
    "write": "Write",
    "modify": "Modify",
    "inputTokens": "Input",
    "outputTokens": "Output",
    "cacheTokens": "Cache",
    "calls": "calls",
    "fallback": "Fallback",
    "noTimedEvents": "No timed events",
    "expandDetails": "Expand details",
    "collapseDetails": "Collapse"
  },
  "history": {
    "filterAgent": "Filter by agent",
    "filterSession": "Filter by session",
    "clearFilters": "Clear Filters",
    "noRuns": "No runs recorded yet",
    "unknownAgent": "Unknown Agent",
    "events": "events",
    "completed": "Completed",
    "error": "Error",
    "running": "Running",
    "time": {
      "1h": "1 Hour",
      "24h": "24 Hours",
      "7d": "7 Days",
      "all": "All"
    }
  }
}
```

Also update `nav`:

- Remove `"activity"` and `"gateway"`
- Add `"monitor": "Monitor"`

- [ ] **Step 3: Remove activity namespace from both files**

Delete the entire `"activity": { ... }` object from both `zh.json` and `en.json`.

**Keep** the `"gateway"` namespace — it's still used by ConnectionCard, HealthCard, HeartbeatCard (which now live under `monitor/overview/` but still call `useTranslations("gateway")`).

- [ ] **Step 4: Verify no missing i18n keys**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): add monitor i18n namespace, remove activity namespace"
```

---

### Task 9: Integration & Verification [test]

**covers:** All specs — cross-cutting verification

**Files:**

- No new files — verification only

- [ ] **Step 1: TypeScript check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors from P4 changes

- [ ] **Step 2: Lint/format check**

Run: `pnpm check`
Expected: Clean (fix any issues)

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass (including new RunEventStore + RunEventPipeline tests)

- [ ] **Step 4: Verify Panel type migration completeness**

Search for any remaining references to `"activity"` or `"gateway"` as panel values:

```bash
grep -rn '"activity"' dashboard/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".json"
grep -rn '"gateway"' dashboard/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".json" | grep -v "gateway-allowlist" | grep -v "gateway-adapter" | grep -v stores/gateway
```

Expected: No results (all references updated to "monitor")

- [ ] **Step 5: Verify deleted files are not imported**

```bash
grep -rn "panels/activity" dashboard/src/ --include="*.ts" --include="*.tsx"
grep -rn "panels/gateway" dashboard/src/ --include="*.ts" --include="*.tsx"
grep -rn "stores/activity" dashboard/src/ --include="*.ts" --include="*.tsx"
```

Expected: No results

- [ ] **Step 6: Verify i18n key sync**

Check that `monitor` namespace key count is identical in zh.json and en.json:

```bash
grep -c '"monitor"' dashboard/src/i18n/zh.json
grep -c '"monitor"' dashboard/src/i18n/en.json
```

- [ ] **Step 7: Verify responsive layout**

Manual check or visual inspection that MonitorPanel, all 3 tabs, render correctly at:

- Desktop (≥1280px): 3-column diagnostics grid, full timeline
- Tablet (≥768px): 2-column grid, timeline scrollable
- Mobile (<768px): 1-column stack, tabs functional

- [ ] **Step 8: Commit verification docs**

```bash
git add -A
git commit -m "[enhanced] docs: P4 deck-execution-monitor verification complete"
```

---

## Requirements Coverage Matrix

| Spec                  | Requirement                            | Scenario                           | Task   |
| --------------------- | -------------------------------------- | ---------------------------------- | ------ |
| run-event-persistence | Run events persisted to SQLite         | Tool call persisted                | T1, T2 |
| run-event-persistence | Run events persisted to SQLite         | Model inference persisted          | T1, T2 |
| run-event-persistence | Run events persisted to SQLite         | Events without runId not persisted | T2     |
| run-event-persistence | Batch write pipeline with flush window | Batch flush on count               | T2     |
| run-event-persistence | Batch write pipeline with flush window | Batch flush on time                | T2     |
| run-event-persistence | Batch write pipeline with flush window | Duplicate rejected                 | T1     |
| run-event-persistence | 7-day retention with lazy pruning      | Prune triggered after 1 hour       | T1     |
| run-event-persistence | 7-day retention with lazy pruning      | Prune skipped within 1 hour        | T1     |
| run-event-persistence | Query events by runId                  | Retrieve all events                | T1     |
| run-event-persistence | Query events by runId                  | Empty result                       | T1     |
| run-event-persistence | Query run list with filters            | Filter by agent                    | T1     |
| run-event-persistence | Query run list with filters            | Filter by time window              | T1     |
| run-event-persistence | Query run list with filters            | Cursor pagination                  | T1     |
| run-event-persistence | Run summary aggregation                | Completed run summary              | T1     |
| run-event-persistence | Run summary aggregation                | No events → null                   | T1     |
| run-event-persistence | Database migration                     | Migration applied                  | T1     |
| run-event-persistence | Database migration                     | Migration idempotent               | T1     |
| monitor-panel         | Monitor replaces Activity              | Panel type renamed                 | T4     |
| monitor-panel         | Monitor replaces Activity              | Legacy URL migration               | T4     |
| monitor-panel         | Three tabs                             | Default tab Overview               | T5     |
| monitor-panel         | Three tabs                             | Tab switching                      | T5     |
| monitor-panel         | Overview tab                           | Diagnostics cards displayed        | T5     |
| monitor-panel         | Overview tab                           | Live feed below diagnostics        | T5     |
| monitor-panel         | Gateway removed                        | NavRail no Gateway                 | T4     |
| monitor-panel         | Gateway removed                        | HeaderBar → Monitor                | T4     |
| monitor-panel         | NavRail OBSERVE group                  | Monitor entry                      | T4     |
| monitor-panel         | Monitor Zustand store                  | Tab state persisted                | T4     |
| monitor-panel         | Monitor Zustand store                  | Selected run state                 | T4     |
| monitor-panel         | Monitor API routes                     | List runs API                      | T3     |
| monitor-panel         | Monitor API routes                     | Run detail API                     | T3     |
| monitor-panel         | Monitor API routes                     | Stats API                          | T3     |
| monitor-panel         | i18n keys                              | Keys present                       | T8     |
| monitor-panel         | i18n keys                              | zh and en in sync                  | T8     |
| run-timeline-view     | Gantt-style timeline                   | Tool call with duration            | T6     |
| run-timeline-view     | Gantt-style timeline                   | Model inference displayed          | T6     |
| run-timeline-view     | Gantt-style timeline                   | Approval wait displayed            | T6     |
| run-timeline-view     | Gantt-style timeline                   | Empty run                          | T6     |
| run-timeline-view     | Tool waterfall                         | Flat tool calls                    | T6     |
| run-timeline-view     | Tool waterfall                         | Nested tool calls                  | T6     |
| run-timeline-view     | Tool waterfall                         | Expand details                     | T6     |
| run-timeline-view     | File change summary                    | File operations displayed          | T6     |
| run-timeline-view     | File change summary                    | No file operations                 | T6     |
| run-timeline-view     | Model statistics                       | Single model stats                 | T6     |
| run-timeline-view     | Model statistics                       | Fallback event highlighted         | T6     |
| run-timeline-view     | Model statistics                       | Cache hit displayed                | T6     |
| run-timeline-view     | Subagent execution tree                | Tree rendered                      | T6     |
| run-timeline-view     | Subagent execution tree                | No subagents                       | T6     |
| run-timeline-view     | Compaction markers                     | Marker displayed                   | T6     |
| run-timeline-view     | Compaction markers                     | Multiple compactions               | T6     |
| run-timeline-view     | Stream color coding                    | Color consistency                  | T6     |
| run-history-query     | Run history list                       | Default view                       | T7     |
| run-history-query     | Run history list                       | Load more                          | T7     |
| run-history-query     | Run history list                       | Empty state                        | T7     |
| run-history-query     | Filtering                              | Filter by agent                    | T7     |
| run-history-query     | Filtering                              | Filter by time range               | T7     |
| run-history-query     | Filtering                              | Combined filters                   | T7     |
| run-history-query     | Filtering                              | Clear filters                      | T7     |
| run-history-query     | Run detail navigation                  | Navigate to run                    | T7     |
| run-history-query     | Run detail navigation                  | Deep link                          | T6     |
| run-history-query     | Run status indicators                  | Completed/Error/Running            | T7     |
| run-history-query     | Run summary cards                      | Summary metrics                    | T7     |
| run-history-query     | Run summary cards                      | Abbreviated numbers                | T7     |
