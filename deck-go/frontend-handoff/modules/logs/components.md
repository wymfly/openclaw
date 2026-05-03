# logs - components

## Tree

```txt
LogsPanel
├─ LogsHeader
│  ├─ title / contract subtitle
│  ├─ tail Badge
│  ├─ stream Badge
│  ├─ streaming Toggle
│  └─ refresh Button
├─ LogsMetrics
│  └─ MetricTile x5
├─ LogsWorkbench
│  ├─ TailCard
│  │  ├─ FilterSurface
│  │  │  ├─ LevelToggleRow
│  │  │  ├─ source Select
│  │  │  └─ session Input
│  │  ├─ ActionRow
│  │  ├─ LogLineList
│  │  │  └─ LogLineRow x N
│  │  └─ ExportPreview
│  └─ StreamSidecar
│     ├─ LiveTapeCard
│     ├─ StreamEventsCard
│     └─ TailPayloadCard
```

## Production ownership

The production panel can remain a single bounded `LogsPanel.tsx` during this
pass if helper functions stay readable and unit tests protect the existing
behavior. A local `logs-panel.css` should own the visual shell instead of
extending broad `theme.css` selectors.

## Local molecules

### MetricTile

Small `label + value + optional hint` tile. This repeats agents/routing/
subagents visually and is another promotion signal, but remains local in this
module change.

### LevelToggleRow

Four compact checkbox-backed toggles for `debug`, `info`, `warn`, and `error`.

Rules:

- Preserve native checkbox semantics for accessibility and existing tests.
- A checked level participates in local filtering.
- The row must wrap without resizing the workbench.

### LogLineRow

Renders:

- timestamp
- level
- source
- optional `sessionKey`
- message/code text

Rules:

- Long messages wrap inside a stable scrollable code area.
- Rows do not invent stack trace, host, or request metadata.
- Latest rows render in loaded/stream insertion order from current state.

### LiveTapeRow

Compact stream summary row from `summarizeLogEvent(event)`.

Rules:

- `log.reset` uses the localized reset label.
- Batch summaries remain secondary evidence, not a replacement for tail rows.

### StreamEventSummary

Uses existing `EventFeedCard` when useful. The high-fidelity shell should frame
it as raw stream evidence, not a primary metric.

### PayloadSeam

Uses existing `JsonDetails` or canonical `Code` for raw payload inspection.

Rules:

- `cursor`, filtered entries, and `reset` are visible when a tail payload exists.
- The seam is secondary and can scroll independently.

## Atom mapping

- Use canonical `Badge`, `Button`, `Card`, `Code`, `Input`, `Select`,
  `Spinner`, and `Toggle` where they fit.
- Keep `MetricTile`, `LevelToggleRow`, `LogLineRow`, `LiveTapeRow`, and
  `PayloadSeam` local.
- Do not introduce new canonical atoms or tokens in this change.

## Class-name intent

Production CSS should preserve these semantic regions:

- `.logs-panel`
- `.logs-panel__header`
- `.logs-panel__metrics`
- `.logs-workbench`
- `.logs-tail-card`
- `.logs-filter-surface`
- `.logs-level-row`
- `.logs-action-row`
- `.logs-line-list`
- `.logs-line-row`
- `.logs-sidecar`
- `.logs-live-tape`
- `.logs-stream-events`
- `.logs-payload-seam`
- `.logs-export`
