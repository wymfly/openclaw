# activity — states

> Feed states, filter compose, dialog state, focus, a11y.

## Feed states

| State     | Trigger                             | Renders                            |
| --------- | ----------------------------------- | ---------------------------------- |
| `ready`   | events fetched (snapshot or stream) | KPI strip + toolbar + grouped feed |
| `loading` | first fetch or manual refresh       | Spinner + "Loading activity feed…" |
| `error`   | BFF returned 5xx / network fail     | Error icon + retry button          |
| `empty`   | filter or search produces zero rows | Activity icon + "No events match…" |

The `empty` state can be reached three ways: zero events from BFF, all events filtered out,
or time range cutoff excludes everything.

## Filters that compose

- `searchQuery` — free text on `id + type + description + details + agentId + agentName`.
- `filter` — family segmented: `all | agent | tool | msg | subagent | channel | ops`. Each
  family maps to a fixed list of types defined in `FILTER_GROUPS`.
- `severity` — segmented: `all | info | ok | warn | err`. Severity is derived client-side from
  type via `TYPE_FAMILY` in `icons.jsx`.
- `timeRange` — segmented: `1h | 6h | 24h | all`. Cutoff = `asOfMs - windowMs`. `all` skips
  the time check entirely.

All AND-combined.

## Grouping

Events are sorted descending by `timestamp`, then grouped by hour bucket. Each transition into
a new bucket inserts a `GroupHeader` row. The bucket label format is
`YYYY-MM-DD HH:00`.

## Dialog state

### EventDetailDialog

No internal state machine. Renders selected event; copies JSON on demand. The "Copied" label
auto-clears after ~1.4s.

## Tweaks panel

Design-time only. Exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `comfortable | compact`
- `feedState` ∈ `ready | loading | error | empty`
- `filter`, `severity`, `timeRange` — same options as toolbar
- `selectedEvent` — any event id from MOCK
- `detailOpen` ∈ booleans

Dropped at production translation.

## Focus

- First focusable: search input.
- After clicking a feed row → focus moves to the dialog's first focusable (close button by
  default; production should set initial focus on the dialog body).
- After dismissing a dialog → focus returns to the trigger row.
- Esc:
  - In dialog → close dialog.
  - In feed (no dialog) → no-op (do not eat Esc; let global handlers see it).

## A11y semantics

- Toolbar segments: `role="tablist"` + `role="tab"` + `aria-selected`.
- Feed rows: `role="button"`, `tabIndex={0}`, Enter/Space activates.
- Group headers: visual separator only; production should add `role="separator"` or hide
  decoratively with `aria-hidden="true"`.
- Modal: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap; Esc close.
- Event glyph: `aria-hidden="true"` (severity is also conveyed by the type label + tint).
- Status pills always carry text; color is decoration only.
- For live tail (production): wrap the feed in `aria-live="polite"` with a throttling layer so
  high-volume runs do not flood the screen reader.
