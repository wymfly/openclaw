# routing - components

## Tree

```txt
RoutingPanel
├─ RoutingHeader
│  ├─ title / contract subtitle
│  ├─ ready/error/loading Badge
│  └─ refresh Button
├─ RoutingMetrics
│  └─ MetricTile x5
├─ RoutingWorkbench
│  ├─ BindingQueueCard
│  │  ├─ filter row
│  │  ├─ DM scope control
│  │  └─ BindingQueue
│  │     └─ BindingRow x N
│  └─ RoutingDetailWorkspace
│     ├─ SelectedBindingCard
│     ├─ SimulatorCard
│     ├─ BindingDraftCard
│     ├─ ActivityCard
│     └─ MutationResult
```

## Production ownership

The production panel can remain a single bounded `RoutingPanel.tsx` during this pass if helper functions and tests remain readable. A local `routing-panel.css` should own the visual shell instead of extending broad `theme.css` selectors.

## Local molecules

### MetricTile

Small `label + value + optional hint` tile. This repeats agents visually, but stays local until subagents validates the same pattern.

### BindingRow

Renders:

- `agentId`
- `tier`
- `binding.id`
- match summary from `DeckGoRoutingMatch`
- local advisory conflict count
- selection state

Rules:

- Click selects the binding.
- Keyboard Enter/Space selects the binding.
- Long IDs and peer/account values truncate or wrap without resizing the row.

### MatchChipRow

Compact chips for channel, account, peer, guild, team, and roles.

Rules:

- Do not render empty optional fields.
- Roles render as a joined compact value.
- The chip label names the dimension.

### SelectedBindingHero

Selected binding summary with tier, channel, agent, order, and conflict markers.

Rules:

- Does not invent route confidence or route usage counts.
- Navigation buttons use existing `navigateToAgent`, `navigateToChannel`, `navigateToChannelAccess`, and `navigateToSession` helpers.

### SimulatorTierTimeline

Compact list of simulation tiers.

Rules:

- `matched=true` renders as matched.
- `checked=true` and `matched=false` renders as checked.
- `checked=false` renders as skipped.
- No explanatory text is invented.

### MutationResultStrip

Collapsed result summary plus optional JSON details.

Rules:

- Add/remove results show config hash.
- Remove results show impact when present.
- Raw payload is secondary.

## Atom mapping

- Use canonical `Button`, `Badge`, `Chip`, `Card`, `Input`, `Select`, `Textarea`, and `Spinner` where they fit.
- Keep `MetricTile`, `BindingRow`, `MatchChipRow`, `SelectedBindingHero`, and `SimulatorTierTimeline` local.
- Do not introduce new canonical atoms or tokens in this change.

## Class-name intent

Production CSS should preserve these semantic regions:

- `.routing-panel`
- `.routing-panel__header`
- `.routing-panel__metrics`
- `.routing-workbench`
- `.routing-queue-card`
- `.routing-filter-row`
- `.routing-binding-list`
- `.routing-binding-row`
- `.routing-detail`
- `.routing-selected`
- `.routing-simulator`
- `.routing-draft`
- `.routing-activity`
- `.routing-tier-row`
- `.routing-result`
