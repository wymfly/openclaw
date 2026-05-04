# Components

## Tree

```
RoutingApp                                      app.jsx
├── routing-app__head
│   ├── brand (IconRoute + h1 + subtitle)
│   └── status pill (advisory conflicts count)
├── MetricStrip (5 cards)
│   ├── Bindings count
│   ├── Default agent (AgentChip)
│   ├── DM scope (mono)
│   ├── Advisory conflicts (warn-tinted when > 0)
│   └── Last simulation (AgentChip when set)
└── routing-app__workbench
    ├── RoutingQueue (left card)         routing-queue.jsx
    │   ├── queue-card__head             title + Refresh + "Add binding…"
    │   ├── FilterRow                    agent / channel / account / Apply / Clear
    │   ├── DmScopePanel                 select + Patch button (dirty-detect)
    │   ├── AddBindingDraft (when active) agent + tier + match form + comment + validate/add
    │   ├── BindingRow × N               order # + agent chip + tier badge + match chips + meta + conflict warn
    │   └── queue-card__foot             count summary
    │
    └── RoutingDetail (right card)       routing-detail.jsx
        ├── detail-card__head            title + HashChip
        ├── ConfirmRow                   (when pendingAction set)
        ├── MutationStrip                (when mutationResult set)
        ├── SelectedBindingHero          binding identity + conflict list + 4 actions + JSON
        ├── SimulatorPanel               6-field grid + Simulate/Reset/Open + tier timeline + session key
        └── ActivityList                 5 routing-related events with type pill + agent chip + summary
```

## Component contracts

### `<RoutingApp />`

Root orchestrator. Owns:

- `bindings: DeckGoRoutingBinding[]` — full inventory (mock-mutates on add/remove/reorder)
- `head: { defaultAgentId, dmScope, configHash }` — page-level routing metadata
- `scope: string` — local DM scope state (forks from head until patched)
- `filters: { agentId, channel, accountId }` — draft form state
- `appliedFilters: { agentId, channel, accountId }` — applied filter state (only changes on Apply)
- `selectedId: string | null` — currently-selected binding id
- `pendingAction: { kind, label, hint, danger, payload } | null`
- `mutationResult: { tone, heading, detail?, atMs, newHash? } | null`
- `simulatorInput: { channel, accountId?, peer?, guildId?, teamId?, roles? }`
- `lastSimulationResponse: DeckGoRoutingSimulateResponse | null`
- `showAddDraft: boolean` — whether the draft drawer is open
- `draft: DeckGoRoutingBinding-shaped` — the draft binding being edited
- `validation: DeckGoRoutingValidateResponse | null` — last validate result for the draft
- `refreshing: boolean` / `refreshingActivity: boolean` / `busy: boolean`

Computes `filteredBindings` from `bindings × appliedFilters`, then derives `selectedBinding` + `selectedIndex`.

### `<MetricStrip />`

5-metric KPI card row. Re-derives counts on every render. The "advisory conflicts" card flips warn-tinted when > 0; the "last simulation" card shows the agent chip from the latest simulator response.

### `<RoutingQueue />`

Left card. Owns the binding queue + filter form + DM scope panel + add-binding draft drawer. Emits `onSelect(id)`, `onFiltersApply()`, `onPatchScope(scope)`, `onShowAddDraft()`, `onValidateDraft()`, `onAddDraft()`, `onRefresh()`.

The DmScopePanel uses local-state dirty-detect: dropdown changes don't immediately patch — user must click Patch scope, which raises a confirm gate.

### `<RoutingDetail />`

Right card. Owns the selected hero + simulator + activity. Emits `onUseAsSimulation()`, `onMoveUp()`, `onMoveDown()`, `onRemove()`, `onSimulate()`, `onOpenAgent(id)`, `onOpenSession(key)`, `onRefreshActivity()`.

ConfirmRow + MutationStrip stack at the top of the card body, above the SelectedBindingHero, so they're always visible regardless of scroll position when an action is in flight.

### `<SelectedBindingHero />`

Single binding visualization with full identity + tier + order + advisory conflicts list + 4-action toolbar + JSON view. Branches on `binding === null` → empty state ("No binding selected").

### `<SimulatorPanel />`

6-field form (channel / accountId / peer.kind / peer.id / guildId / roles) + Simulate / Reset / Open agent / Open session actions + tier timeline (matched / checked / skipped) + session key footer.

The peer-id field is disabled when peer.kind is empty — mirrors the contract's `peer?: { kind, id }` shape (you can't have id without kind).

The Open agent / Open session buttons only render when `lastSimulationResponse?.matchedBy !== "default"` (no point opening a session that doesn't yet exist).

### `<ActivityList />`

Filtered slice of activity events. Each row shows the event type pill (warn-tinted for `route.fallback`, neutral otherwise) + agent chip + summary + relative time + binding id (truncated, mono).

### `<AddBindingDraft />`

Inline drawer (warn-tinted) above the binding list. 9-field grid + comment textarea + validation strip + Validate/Add actions.

The Validate button calls `window.validateBinding(draft, bindings)` synchronously and renders the result below the form. Add raises a confirm gate (because it requires the config hash and is a real mutation).

### `<DmScopePanel />`

Dropdown + dirty-detect Patch button. Patching raises a confirm gate ("DM scope: A → B (requires hash …)"). Confirm advances the hash and updates the scope.

### `<ConfirmRow />`

Reusable inline confirm banner. Same UX as docs delete + memory dreams reset + nodes mutations — promotion candidate already documented elsewhere; this is the **fourth deck-go panel** to use it. Promotion to `<ConfirmRow>` in `@/design-system/patterns` is overdue.

### `<MutationStrip />`

Inline result banner — heading + detail + new config hash. Tone variants:

- `ok` (green): successful add, scope patch, simulation matched
- `warn` (yellow): successful remove (impact summary), simulation fell through to default

## Local molecules

| Molecule              | Purpose                                                                      | Promotion candidate?                                                              |
| --------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `TierBadge`           | Tier-color-coded pill (peer / guild+roles / guild / team / channel)          | **Promote** if a 2nd module needs tier semantics                                  |
| `MatchChip`           | Labeled key/value chip (`channel · discord` / `peer(direct) · finance-lead`) | Reusable for any key/value display surface (settings, agents)                     |
| `MatchChipRow`        | Auto-renders all defined match dimensions                                    | Specific to routing match shape                                                   |
| `ConflictMarker`      | Inline warn pill for advisory conflict                                       | Reusable wherever "advisory severity" exists (other validation surfaces)          |
| `HashChip`            | Click-to-copy abbreviated config hash                                        | Reusable wherever versioned-config hash surfaces (gateway, models, settings)      |
| `AgentChip`           | Bullet + name (color from AGENT_TONE map)                                    | **Promote** — already used by docs/memory/routing/activity; 4th use met DS gate   |
| `JsonView`            | Pretty JSON + copy + scroll bound                                            | Reusable everywhere; same as memory/api-explorer/nodes — promote in next DS batch |
| `MutationStrip`       | ok/warn-tinted result banner with new-hash row                               | Reusable wherever hash-aware mutations exist                                      |
| `ConfirmRow`          | Inline danger gate (warn / danger variant)                                   | **Promote** — 4th use across deck-go panels (docs, memory, nodes, routing)        |
| `BindingRow`          | List-row layout for queue rows (order # + agent + tier + match + warn)       | Specific to routing                                                               |
| `SelectedBindingHero` | Hero card for selected binding                                               | Specific to routing                                                               |
| `SimulatorPanel`      | Form + tier timeline + session key footer                                    | Specific to routing                                                               |
| `ActivityList`        | Filtered activity events list                                                | Generalizable to any "filtered activity slice" panel                              |

## Tier semantics

| Tier          | Specificity | Match dimensions                        | Color   |
| ------------- | ----------- | --------------------------------------- | ------- |
| `peer`        | most        | channel + accountId + peer{kind, id}    | blue    |
| `guild+roles` | high        | channel + accountId + guildId + roles[] | purple  |
| `guild`       | mid         | channel + accountId + guildId           | yellow  |
| `team`        | mid         | channel + accountId + teamId            | green   |
| `channel`     | least       | channel + (accountId optional)          | neutral |

Walking order matches specificity. Validate's `tier: string` returns the auto-detected tier from a draft's match shape.

## Tone semantics

| Tone      | Use case                                      | Source                                             |
| --------- | --------------------------------------------- | -------------------------------------------------- |
| `ok`      | matched binding / successful mutation         | `--ds-success`                                     |
| `warn`    | advisory conflict / fell to default / removal | `--ds-warning`                                     |
| `neutral` | checked-but-not-matched simulator tier        | `--ds-text-faint` shell                            |
| `danger`  | remove confirm only                           | `--ds-danger` (only on Remove + ConfirmRow danger) |

## Depends on canonical patterns

When productionized in `frontend-new/src/components/panels/routing/`:

- `PageShell` for the outer page chrome (`@/design-system/patterns`)
- `EmptyState` for "no bindings match filters" / "no activity in window" / first-run
- 2-card workbench layout — same as gateway. Already canonical.

## Depends on canonical icons

| Local         | Canonical       | Used by                                  |
| ------------- | --------------- | ---------------------------------------- |
| IconRoute     | `IconRoute`     | brand                                    |
| IconRefresh   | `IconRefresh`   | refresh actions                          |
| IconAlert     | `IconAlert`     | confirm row, conflict marker, validation |
| IconCheck     | `IconCheck`     | validation ok, simulation matched        |
| IconX         | `IconX`         | close add-draft, simulator skipped       |
| IconPlay      | `IconPlay`      | Use as simulation, Simulate              |
| IconPlus      | `IconPlus`      | Add binding CTA                          |
| IconArrowUp   | `IconArrowUp`   | Move up                                  |
| IconArrowDown | `IconArrowDown` | Move down                                |
| IconTrash     | `IconTrash`     | Remove binding                           |
| IconHash      | `IconHash`      | Hash chip + activity binding id row      |
| IconCopy      | `IconCopy`      | JSON view copy / hash copy               |
| IconFilter    | `IconFilter`    | Filter Apply                             |
| IconAgent     | `IconAgent`     | reserved                                 |
| IconChannel   | `IconChannel`   | match chip channel                       |
| IconUsers     | `IconUsers`     | match chip peer                          |
| IconShield    | `IconShield`    | match chip guild                         |
| IconClock     | `IconClock`     | reserved                                 |
| IconExternal  | `IconExternal`  | Open agent / Open session                |
| IconCircle    | `IconCircle`    | simulator checked tier                   |
| IconDot       | `IconDot`       | tier badge dot                           |

(Reserved: `IconChevronR/D`, `IconArrowRight`, `IconHash2`, `IconChain` for future row affordances.)

## Out-of-scope (intentionally not modeled)

- **Reorder by drag** — reorder works via Move up/down only. Drag is a v3 enhancement.
- **Bulk operations** — too risky without a "what would happen" preview.
- **Conflict resolution wizard** — currently advisory-only; resolution requires editing the underlying bindings manually.
- **Custom simulation harness** — the prototype simulator uses an in-process matcher matching the contract intent. Production calls `simulateRouting()` and renders the response verbatim.
- **Per-binding history** — no contract for binding-version history. Would require a separate audit log.
