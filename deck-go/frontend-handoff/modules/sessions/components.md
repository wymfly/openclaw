# sessions - components

## Tree

```txt
SessionsPanel
├─ SessionsHeader
│  ├─ title / contract subtitle
│  ├─ inventory/detail/visible badges
│  └─ refresh actions
├─ SessionsMetrics
│  └─ MetricTile x5
├─ SessionsWorkbench
│  ├─ InventoryColumn
│  │  ├─ SearchFilterBar
│  │  ├─ SessionInventoryList
│  │  ├─ PaginationStrip
│  │  └─ PreviewOverlayDisclosure
│  ├─ DetailColumn
│  │  ├─ SelectedSessionHero
│  │  ├─ RuntimeMetadataGrid
│  │  ├─ SessionUsageContext
│  │  ├─ CompactionCheckpointList
│  │  ├─ SubagentLineagePanel
│  │  ├─ TranscriptSearchExport
│  │  └─ TranscriptDetail
│  └─ ActionColumn
│     ├─ SessionPatchControls
│     ├─ SessionMutationActions
│     ├─ SelectedSessionMetadata
│     └─ ActionResult
```

## Production ownership

The production panel can remain in the existing `SessionsPanel.tsx` plus the
three helper files during this pass if the code remains readable:

- `SessionUsageDetails.tsx`
- `SessionCompactionHistory.tsx`
- `SessionSubagentDetails.tsx`

Use a local `sessions-panel.css` for the visual shell. Remove or narrow the old
`deck-ui-sessions` global styling only after tests pass.

## Local molecules

### MetricTile

Small `label + value + optional hint` tile. This repeats prior modules and is a
promotion candidate, but remains local in this module change.

### InventoryRow

Renders session title/key, status, agent/model, preview, token/cost hints, and
selected state.

Rules:

- Clicking selects the session.
- Long session keys wrap or truncate without resizing the list.
- `subagent` kind gets a distinct but non-decorative badge.

### SelectedSessionHero

Renders selected identity, agent/status, history count, runtime, context
pressure, and optional lineage state.

Rules:

- Missing optional fields render as `n/a`.
- Does not invent status values.

### TranscriptSearchExport

Renders transcript search, match navigation, export actions, selected match,
and export preview.

Rules:

- Search uses loaded normalized transcript messages.
- Export is client-side only.

### UsageContextPanel

Renders usage totals, cost, compaction count, context-weight breakdown, and
usage-log timeline.

Rules:

- High-token turns remain visible but not alarmist.
- Missing context weight gets a compact empty row.

### CompactionCheckpointRow

Renders checkpoint metadata, saved-token estimate, summary, branch/restore
actions, and action result.

Rules:

- Actions use existing wrappers.
- Restore refreshes checkpoint state.

### LineageRelationRow

Renders subagent lineage nodes plus parent/child session navigation.

Rules:

- Open Subagents action uses panel navigation.
- Parent/child buttons select sessions locally.

### ActionResultSeam

Renders the latest action result as structured evidence.

Rules:

- Keep JSON readable and bounded.
- Do not block the primary workbench.

## Atom mapping

- Use canonical `Badge`, `Button`, `Card`, `Code`, `Input`, `Select`,
  `SegmentedControl`, `Spinner`, and `Toggle` where they fit.
- Keep inventory rows, lineage rows, context timeline, compaction rows, and
  action result seam local.
- Do not introduce new canonical atoms or tokens in this change.

## Class-name intent

Production CSS should preserve these semantic regions:

- `.sessions-panel`
- `.sessions-panel__header`
- `.sessions-panel__metrics`
- `.sessions-workbench`
- `.sessions-inventory-card`
- `.sessions-detail-card`
- `.sessions-actions-card`
- `.sessions-surface`
- `.sessions-inventory-row`
- `.sessions-session-hero`
- `.sessions-usage-row`
- `.sessions-compaction-row`
- `.sessions-lineage-row`
- `.sessions-transcript-seam`
- `.sessions-action-result`
