# gateway — states (v2)

## Production delta

The prototype still describes a modal "dry-run" composer in a few lower
sections. The implemented `frontend-new` panel uses an inline bundled-only
batch composer backed by `POST /api/v1/runtimes/{runtimeId}/gateway/batch`.
Because `gateway.batch` executes real upstream calls, production filters child
methods to read-only describe entries, excludes nested batch/subscription calls,
and disables submission in remote mode.

## Top-level state

```ts
{
  // Server-side snapshots
  healthResp: DeckGoGatewayHealthResponse,
  statusResp: DeckGoGatewayStatusResponse,
  describeResp: DeckGoGatewayDescribeResponse,
  recentBatches: Array<DeckGoGatewayBatchResponse & {
    requestedAt: number;
    durationMs: number;
    calls: DeckGoGatewayBatchCall[];
    options?: DeckGoGatewayBatchOptions;
  }>,
  throughputPoints: Array<{ timestamp: number; requests: number; errors: number; latencyP95: number }>,  // BFF projection
  auditEntries: Array<{ ts: number; actor: string; method: string; ok: boolean; meta?: object }>,         // BFF projection
  bootstrap: { ok: boolean },

  // UI state
  tab: "describe" | "batch" | "activity",
  expandedBatch: string | null,
  composer: { open: boolean },
}
```

DescribeExplorer-internal state:

```ts
{
  mode: "methods" | "events",
  query: string,
  scopeFilter: "all" | "operator.read" | "operator.write" | "system",
  selectedKey: string | null,
}
```

BatchComposer-internal state:

```ts
{
  calls: Array<DeckGoGatewayBatchCall>,
  phase: "idle" | "running" | "done" | "error",
  results: Array<DeckGoGatewayBatchResultEntry> | null,
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
}
```

## Loading / Empty / Error states

| Scenario                                 | UI                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Initial load (no fixture yet)            | (production target) full-width loading shell — prototype always seeds.                                          |
| `health.ok === false`                    | Topbar health pill → "Gateway DOWN" (error tone). Hero KPI cells still render with whatever data was last seen. |
| `health` 5xx                             | (production target) full-width retry overlay; UI MUST refetch on Refresh.                                       |
| `status.state !== "running"`             | State pill shows the actual state value with accent color (operator must investigate; UI doesn't gate).         |
| `describe.methods === {}`                | DescribeExplorer list shows empty card "No entries match." Untyped footer hidden.                               |
| `describe.untyped === undefined` or `[]` | Untyped footer hidden.                                                                                          |
| Search filters all out                   | Empty card "No entries match. Try clearing search / scope filter."                                              |
| `recentBatches === []`                   | BatchConsole list empty — head still shows summary stats (0 / 0 / 0).                                           |
| Batch runtime mode = remote              | Composer visible but disabled with explanatory locked state.                                                    |
| Batch network 5xx                        | Inline error alert with retry by resubmitting after correction.                                                 |
| Activity audit empty                     | (production target) "No recent activity." inline message. Prototype always seeds 8 entries.                     |
| Bootstrap not ready                      | Bootstrap pill flips error tone. Read-only panel — no action gating beyond visual signal.                       |
| Throughput points all zero               | Cards still render; spark primitives draw 1px baseline.                                                         |

## Health states

| `health.ok` | UI                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `true`      | Topbar pill green "Gateway OK" + heart icon.                                                       |
| `false`     | Topbar pill red "Gateway DOWN". Hero KPI may show stale data with implicit warning via state pill. |
| `undefined` | Treated as down (defensive).                                                                       |

## Channel states

| Channel `connected`   | UI                                                                        |
| --------------------- | ------------------------------------------------------------------------- |
| `true`                | Solid pill, ConnDot green halo, last-seen relative.                       |
| `false`               | Dashed border + reduced opacity, ConnDot red, last-seen older.            |
| `lastSeen` very stale | UI tolerates — the relative time formatter handles "X h ago" / "X d ago". |

## Heartbeat agent states

| Agent `enabled`                    | UI                               |
| ---------------------------------- | -------------------------------- |
| `true`                             | Solid pill with strong agentId.  |
| `false`                            | Dashed border + reduced opacity. |
| Agent missing from `health.agents` | Sessions count shown as 0.       |

## Batch console states

| Scenario                      | UI                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Batch row with `failed === 0` | Border default; ok stat pill green.                                          |
| Batch row with `failed > 0`   | Border warn tone; both ok + err stat pills visible.                          |
| Batch row expanded            | Body shows options + per-call table.                                         |
| Per-call `ok === true`        | Status td-tag green "ok".                                                    |
| Per-call `ok === false`       | Status td-tag red with error code; meta cell shows message + retryable hint. |

## Composer lifecycle

```
idle
  ─[Run batch]─▶ submitting ─(BFF response)─▶ recent batch inserted + expanded
                                      └────▶ inline error alert
```

Notes:

- `submitting` locks composer inputs.
- Results are real BFF responses, not simulated.
- Invalid JSON and unsafe method selection fail locally before the route is
  called.

## Describe explorer states

| Mode      | Selection            | Detail card                                                      |
| --------- | -------------------- | ---------------------------------------------------------------- |
| `methods` | none                 | Placeholder "Pick a method".                                     |
| `methods` | selected with schema | name + ScopePill + SinceTag + 2 JSON sections (params + result). |
| `methods` | selected, no schema  | name + ScopePill + "No schema published."                        |
| `events`  | none                 | Placeholder "Pick an event".                                     |
| `events`  | selected             | name + event tag + SinceTag + payload JSON section.              |

## Tab states

| Tab        | Behavior                                                                    |
| ---------- | --------------------------------------------------------------------------- |
| `describe` | DescribeExplorer mounts. Mode + filter + selection persist for the session. |
| `batch`    | BatchConsole mounts. `expandedBatch` persists for local recent submissions. |
| `activity` | ActivityList mounts.                                                        |

## Refresh states

- **Topbar Refresh**: re-fetches health + status (production); prototype
  bumps `health.ts` for visual feedback.
- Refresh re-fetches runtime summary, health, status, describe, activity, and
  monitor projections.
- Refresh does NOT clear composer state.

## A11y / focus rules

- After tab click → focus stays on the tab.
- After Refresh → focus stays on Refresh.
- After batch row expand → focus stays on the batch head.
- Inline composer keeps focus on the button/input the operator used.
- Tab strip uses `role="tablist"` + `aria-selected`.
- Batch head uses `aria-expanded` reflecting expansion state.
- Inline batch composer uses regular form controls plus `role="alert"` for
  validation/submission failures.

## Boundary cases

- **`health.channels` empty**: Hero KPI Channels cell shows 0/0; rail
  shows empty list.
- **`status.heartbeat` is a string** (legacy): Heartbeat rail shows the
  string as a single literal pill (defensive fallback).
- **`describe.methods` with `since` undefined**: SinceTag hidden.
- **Batch with `options` undefined**: row body opts row shows
  "failFast=false / timeoutMs=—".
- **Per-call result truncated**: result td-tag shows "—" if
  result/error both missing.
- **Audit entry with `meta` undefined**: meta cell shows "—".

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block.
