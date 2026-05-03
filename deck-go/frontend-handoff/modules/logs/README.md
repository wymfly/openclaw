# logs — high-fidelity handoff (v2)

**Status:** `revised v2 — pending implementation`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`logs/` is the operations workbench for tailing Gateway log lines and watching
the live `/logs/stream` SSE feed. The v2 prototype rebuilds the panel as
multi-file React with a left **stream pane** (KPI strip + filtered tail + live
tape) and a right **details pane** (selected line metadata + structured fields

- correlation context + stack trace + raw payload).

The 4-axis filter bar (level / source / session / correlation id / free text)
narrows already-loaded rows locally — server-side filtering is not in scope for
this contract pass.

## File inventory

| File                      | Purpose                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `prototype.html`          | ~30-line shell that loads React + Babel + the JSX modules.                   |
| `data.js`                 | Mock fixture: 124 log lines + live tape, seeded by mulberry32 PRNG.          |
| `icons.jsx`               | SVG icons + `LevelPill` + `SourceTile` + level/source meta tables.           |
| `filter-bar.jsx`          | 4-axis filter (level checkboxes / source / session / correlation / search).  |
| `log-row.jsx`             | One log row in the tail list (ts / level / source / session / msg / cursor). |
| `log-stream.jsx`          | Left pane: KPI strip + action row + filtered tail + live tape card.          |
| `details-pane.jsx`        | Right pane: hero + structured fields + correlation context + stack + raw.    |
| `dialogs.jsx`             | `RawLineDialog` + `ExportPreviewDialog`.                                     |
| `app.jsx`                 | `LogsApp` orchestrator + Tweaks host + state plumbing.                       |
| `styles.css`              | Two-pane workbench, log row grid, level pills, tape rows, modal.             |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens (Inter + JetBrains Mono).                |
| `tweaks-panel.jsx`        | Design-time state knobs (theme / density / list / stream / detail).          |
| `prototype-v1-codex.html` | Original Codex single-file prototype (preserved for reference).              |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export interface DeckGoLogStreamEvent {
  id?: string;
  event?: string;
  data?: string;
  json?: unknown;
}

export type DeckGoLogsTailResponse = {
  cursor?: number;
  lines?: unknown[];
  reset?: boolean;
};
```

Endpoints:

- `GET /api/deck/logs?cursor=&limit=&maxBytes=` → `DeckGoLogsTailResponse`
- `GET /api/deck/logs/stream` (SSE) → frames of `DeckGoLogStreamEvent` with
  `event = log.batch | log.reset`

`lines` is `unknown[]` in the raw contract. The prototype assumes a normalized
shape:

```ts
type LogLine = {
  cursor: number;
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  sessionKey: string;
  message: string;
  correlationId?: string;
  fields?: Record<string, unknown>;
  stack?: string;
};
```

Production must defensively parse strings vs objects. The shape assumption is
flagged in `api-usage.md`.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell` — page container with max-width + density tokens.
- `EmptyState` — empty-line placeholder when filters zero out.

`@/design-system/icons`:

- `IconSearch`, `IconRefresh`, `IconPause`, `IconPlay`, `IconClear`,
  `IconExport`, `IconCopy`, `IconClose`, `IconLink`, `IconBug`, `IconInfo`,
  `IconAlert`, `IconError`, `IconStream`, `IconClock`, `IconLayers`.

The level pills (`LevelPill`) and source tiles (`SourceTile`) stay local to
`logs/`. If a future panel (events, threads) needs them too, file a
`design-system/proposals/` proposal to promote.

## How to implement

1. Open `prototype.html` in a browser (`python3 -m http.server` or any static
   server) and walk every state via the Tweaks panel: ready / loading / error,
   stream live / paused, density compact / cozy.
2. Translate to `frontend-new/src/components/panels/logs/` keeping the
   class-name shape (`logs-app__*`, `log-stream__*`, `log-row__*`,
   `details-pane__*`).
3. Wire real fetchers in `frontend-new/src/api/logs.ts` — fetch tail with
   `cursor + limit + maxBytes`, stream `/logs/stream` with the existing
   helper.
4. Hardcoded literal strings get extracted into `frontend-new/src/i18n/{en,zh}.json`
   in one pass (see `frontend-handoff/CLAUDE.md` "Prototype string rule").
5. Buffer cap, copy-to-clipboard, and export logic stays client-side.
6. Filter logic stays client-side (level / source / session / correlation /
   free text) until the backend exposes server-side filters.

## Open questions for follow-up

- Should the `lines` array gain a typed `DeckGoLogLine` schema upstream so the
  prototype's normalized shape becomes contractual?
- Should `/logs/stream` carry structured `level` / `source` / `correlationId`
  fields directly in the SSE event envelope, or stay generic?
- Should real-time level/source filtering move server-side once log volume
  outpaces the 5,000-row local buffer?
- Should the export endpoint become a real download (`/api/deck/logs/export?…`)
  or stay copyable preview only?
