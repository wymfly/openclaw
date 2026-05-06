# budget — interactions (v2)

## Pointer

- **RuleNav item click** → switches `selectedId`, scrolls main pane to top.
- **Status filter tab click** → updates `filterStatus`; nav list re-filters.
  Status counts always reflect the full evaluation set, not the filtered subset.
- **Search input change** → live filter on rule name + scope + agentId
  - taskId + dimension.
- **Hero "Edit"** → opens `EditRuleDialog` with the current rule pre-filled.
- **Hero "Disable" / "Enable"** → opens `ToggleRuleDialog`.
- **Hero "Delete"** → opens `DeleteRuleDialog`.
- **Nav "New"** → opens `CreateRuleDialog`.
- **Topbar / nav-foot Refresh** → re-fetches rules + evaluations.
- **Modal backdrop click** → closes the dialog (except `running` phase).

## Keyboard

| Key                 | Context                                | Behavior                                       |
| ------------------- | -------------------------------------- | ---------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere                               | Focus the rule-nav search input.               |
| `Esc`               | open dialog                            | Close dialog (except `running` phase).         |
| `Enter`             | inside Edit / Create dialog name input | Submit (if valid).                             |
| `Tab` / `Shift Tab` | inside dialog                          | Cycle focus through fields and footer buttons. |
| `Enter` / `Space`   | focused rule row                       | Select that rule.                              |
| `Enter` / `Space`   | focused status filter tab              | Apply that filter.                             |

The mutation wizards are **non-cancellable** during the `running` phase —
both Esc and backdrop click are no-ops while the simulated 480-720ms
timer is in flight.

## Hover

- **RuleNav item** — bg lifts to `--ds-bg-hover`. Active item keeps
  accent inset shadow + brighter text.
- **Status filter tab** — bg lifts; active tab keeps tone-specific
  border + inset shadow (success/warn/error per tone).
- **Buttons (`ds-btn`)** — bg-2 → bg-hover; primary inverts to filled
  accent on hover; warn keeps warn-bg / warn-1.
- **Threshold meter** — `title` attributes on tick marks expose
  numeric thresholds on hover.
- **Modal close button** — bg lifts on hover; disabled state during
  `running` phase doesn't react.

## Density

`compact` (default):

- Rule nav item padding `10px 10px`.
- Hero padding `18px 20px`.
- KPI summary cell padding `12px 14px`.

`cozy`:

- Rule nav item padding `12px 12px`.
- Hero padding `22px 24px`.
- KPI summary cell padding `16px 18px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                                   | UI                                                         |
| ------------------------------------------ | ---------------------------------------------------------- |
| `selectedId === null`                      | Detail empty card with "Pick a rule" prompt.               |
| `evaluation === null` for selected rule    | KPI summary cells show "—"; threshold-card placeholder.    |
| Filtered nav results empty                 | Nav: "No rules match."                                     |
| Bootstrap not ready                        | Warn banner above sections; all hero actions disabled.     |
| Edit / Create / Toggle / Delete running    | Dialog footer hidden; phase strip "Saving rule…" / etc.    |
| Edit / Create / Toggle / Delete done       | Phase strip green check + auto-close after 360-480ms.      |
| Edit error (validation)                    | Phase strip red error message + retry button in footer.    |
| `recentChanges` filtered to selected empty | Recent changes section: "No recent changes for this rule." |

## Focus

- After RuleNav item click → focus jumps to `.rule-detail__title`.
- After dialog dismiss → focus returns to the trigger button.
- After Edit / Toggle / Delete commit → focus returns to the trigger
  button (now potentially reflecting new state).
- After Create commit → focus jumps to the new rule's nav row + then
  to its hero h1.
- After Refresh → focus stays on the Refresh button.
- ⌘K → focus the rule-nav search input from anywhere.

## A11y semantics

- **RuleNav**: `<aside>` with `aria-label="Budget rules"`. Status
  filter strip uses `role="tablist"` + per-tab `role="tab"` +
  `aria-selected`. Rule list uses `role="list"` + per-row
  `role="listitem"`.
- **RuleDetail**: `<section>` with descriptive heading hierarchy.
- **Threshold meter**: `title` attributes on tick marks expose numeric
  thresholds; the bar itself is decorative.
- **Modal**: `role="dialog" aria-modal="true"` + close button has
  `aria-label="Close"`. Focus trap on mount.
- **Banner**: `role="alert"` for the bootstrap-not-ready callout.
- **Phase strip running**: `role="status"` (live region for "Saving…").
- **Phase strip error**: `role="alert"` (live region for error message).
- **KPI summary cells**: tone is conveyed via both color AND value
  (e.g., "WARN" text in the status cell, not color-only).

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`

Production translation drops the panel entirely.

## Mutation behavior

- **Edit** is full-rule replace at the BFF (PATCH semantics).
  Server returns the refreshed rule; production refetches evaluations.
- **Toggle** is a special-case PATCH that only flips `enabled`.
- **Create** appends a rule. Server immediately evaluates against
  current usage on the next `evaluate` request; UI refetches `evaluate` to get the new status.
- **Delete** is a hard delete. Past audit entries (`recentChanges`)
  are prototype/local-only; there is no current BFF audit projection.
- **All mutations** are followed by a `evaluate` refetch so KPI strip
  - meter reflect the updated thresholds.
- **Form validation** (client-side, recommended for production):
  warnThreshold < overThreshold, both >= 0, agentId required when
  scope = "agent", taskId required when scope = "task".

## Cross-section coupling

- **Budget ↔ Usage** (US-014): usage panel surfaces the time-series
  data that drives `current` here.
- **Budget ↔ Alerts** (US-007): when a rule fires warn/over, the
  alerts panel may surface an alert event. There's no direct contract
  link today; see open question §5 in README.
- **Budget ↔ Identity** (US-012): rules scoped to `agent:X` reference
  canonical IDs from identity. Renaming a canonical there does not
  cascade here today (rule's `agentId` stays as the old name).
- **Budget ↔ Topbar KPI**: nav status filter and topbar KPI strip
  share the same evaluation count source. They stay in sync.
