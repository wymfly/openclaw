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
│  ├─ SelectedWorkbench
│  │  ├─ SelectedSessionHero
│  │  ├─ RuntimeMetadataGrid
│  │  ├─ TranscriptSearchExport
│  │  └─ TranscriptDetail
│  └─ InspectorColumn
│     ├─ InspectorTabs
│     │  ├─ OverviewTab
│     │  ├─ UsageTab
│     │  ├─ CompactionTab
│     │  ├─ LineageTab
│     │  └─ ActionsTab
│  │  ├─ SessionUsageContext
│  │  ├─ CompactionCheckpointList
│  │  ├─ SubagentLineagePanel
│     ├─ SessionPatchControls
│     ├─ GuardedSessionActions
│     └─ ActionResult
```

## Production ownership

The production panel can remain in the existing `SessionsPanel.tsx` plus the
three helper files during this pass if the code remains readable:

- `SessionUsageDetails.tsx`
- `SessionCompactionHistory.tsx`
- `SessionSubagentDetails.tsx`

Use a local `sessions-panel.css` for the visual shell. The Inspector tab
composition can be a local molecule backed by `SegmentedControl` or equivalent
token-compatible button groups; do not promote a cross-module pattern until at
least two modules need it.

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

### SessionInspectorTabs

Renders `Overview`, `Usage`, `Compaction`, `Lineage`, and `Actions` tabs.

Rules:

- Default-open on desktop.
- Tabs control hierarchy and visibility only; they do not own data fetching.
- Switching tabs must not change selected session key or transcript cache.
- Tab labels stay short and use localized strings in production.

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

- Lives in the Inspector `Usage` tab.
- High-token turns remain visible but not alarmist.
- Missing context weight gets a compact empty row.

### CompactionCheckpointRow

Renders checkpoint metadata, saved-token estimate, summary, branch/restore
actions, and action result.

Rules:

- Actions use existing wrappers.
- Branch remains a mutating checkpoint action.
- Restore is destructive and must require confirmation before calling its
  wrapper.
- Restore refreshes checkpoint state after execution.

### LineageRelationRow

Renders subagent lineage nodes plus parent/child session navigation.

Rules:

- Open Subagents action uses panel navigation.
- Parent/child buttons select sessions locally.
- Full subagent orchestration stays in the Subagents module.

### GuardedSessionActions

Renders scoped patch controls plus reset, clear, compact, delete, and
compaction restore confirmation gates.

Rules:

- Reset, clear, compact, delete, and restore need a second confirming operator
  action before calling wrappers.
- Patch stays scoped to model, label, thinking, fast mode, and other
  product-backed fields.
- Do not expose Chat compose/send/abort/steer controls here.

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
- `.sessions-inspector-card`
- `.sessions-inspector-tabs`
- `.sessions-surface`
- `.sessions-inventory-row`
- `.sessions-session-hero`
- `.sessions-usage-row`
- `.sessions-compaction-row`
- `.sessions-lineage-row`
- `.sessions-transcript-seam`
- `.sessions-action-result`
