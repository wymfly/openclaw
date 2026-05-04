# gateway — states (v2)

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
| Batch dry-run runtime mode = remote      | Composer trigger button hidden / disabled with tooltip.                                                         |
| Batch dry-run network 5xx                | Composer phase → `error` with retry button (production target). Prototype simulates per-call failures only.     |
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

## Composer wizard lifecycle

```
opened (phase: idle)
  ─[Cancel]─▶ closed
  ─[Submit]─▶ running ─(720-1080ms timer)─▶ done
                                              ─[Close]─▶ closed
                                              ─[Run again]─▶ running again
```

Notes:

- `running` phase locks composer inputs + close button + Cancel.
- `done` phase shows green status pill + per-call results (8%
  per-call simulated failure).
- Re-clicking Submit while in `done` phase resets results and goes
  back to `running`.
- Composer modal uses `role="dialog" aria-modal="true"` + focus trap on
  mount.

## Describe explorer states

| Mode      | Selection            | Detail card                                                      |
| --------- | -------------------- | ---------------------------------------------------------------- |
| `methods` | none                 | Placeholder "Pick a method".                                     |
| `methods` | selected with schema | name + ScopePill + SinceTag + 2 JSON sections (params + result). |
| `methods` | selected, no schema  | name + ScopePill + "No schema published."                        |
| `events`  | none                 | Placeholder "Pick an event".                                     |
| `events`  | selected             | name + event tag + SinceTag + payload JSON section.              |

## Tab states

| Tab        | Behavior                                                                             |
| ---------- | ------------------------------------------------------------------------------------ |
| `describe` | DescribeExplorer mounts. Mode + filter + selection persist for the session.          |
| `batch`    | BatchConsole mounts. `expandedBatch` persists; `composer.open` closes on tab switch. |
| `activity` | ActivityList mounts.                                                                 |

## Refresh states

- **Topbar Refresh**: re-fetches health + status (production); prototype
  bumps `health.ts` for visual feedback.
- Refresh does NOT re-fetch describe (rare to change at runtime; manual
  trigger only).
- Refresh does NOT clear composer state.

## A11y / focus rules

- After tab click → focus stays on the tab.
- After Refresh → focus stays on Refresh.
- After batch row expand → focus stays on the batch head.
- After composer open → focus moves to the first composer input
  (production target — focus trap on mount).
- After composer close → focus returns to the trigger button.
- Tab strip uses `role="tablist"` + `aria-selected`.
- Batch head uses `aria-expanded` reflecting expansion state.
- Composer modal uses `role="dialog" aria-modal="true"`; close button
  has `aria-label="Close composer"`.

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
