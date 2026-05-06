# budget — states (v2)

## Top-level state

```ts
{
  // Navigation + filter
  selectedId: string | null,
  query: string,
  filterStatus: "all" | "ok" | "warn" | "over" | "disabled",

  // Server-side snapshot
  fixture: {
    rules: DeckGoBudgetRule[],
    evaluations: DeckGoBudgetEvaluation[],
    recentChanges: ChangeEvent[],         // prototype/local-only; no current BFF endpoint
    fetchedAt: number,
    bootstrap: DeckGoBootstrapStatusResponse,
    agentDirectory: { id: string; label: string }[],
  },

  // Mutation lifecycle
  dialog: { kind: "edit" | "create" | "toggle" | "delete" } | null,

  now: number,                            // for relative-time formatting
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

| Scenario                                | UI                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Initial load (no fixture yet)           | (production target) full-width loading shell — prototype always seeds.                                       |
| `rules.length === 0`                    | Nav: "No rules match." inline empty row. Detail in `--empty` mode.                                           |
| Filtered nav results empty              | Nav: "No rules match."                                                                                       |
| `selectedId === null`                   | Detail empty card: "No rule selected. Pick a rule…"                                                          |
| `bootstrap.ok === false`                | Warn banner above sections; all hero actions disabled.                                                       |
| GET /api/usage/budget 5xx               | (production target) full-width retry overlay.                                                                |
| GET /api/usage/budget/evaluate 5xx      | Status pills hidden, KPI summary shows "—"; banner suggests Refresh.                                         |
| Mutation 4xx (validation)               | Dialog `phase--error`; retry button visible.                                                                 |
| Mutation 409 (concurrent edit)          | Dialog `phase--error` with "rule changed concurrently — refresh and retry"; UI MUST refetch on next Refresh. |
| Mutation 5xx                            | Dialog `phase--error`; refetch on next Refresh.                                                              |
| `evaluation === null` for selected rule | KPI summary cells show "—"; threshold-card shows empty placeholder.                                          |

## Selected-rule states

| `selected` shape                   | UI                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `null`                             | Empty card "Pick a rule from the left rail."                                                               |
| Rule with evaluation, enabled      | Hero with all 3 actions enabled; meter + KPI fully populated.                                              |
| Rule with evaluation, disabled     | Hero shows disabled-pill; Toggle CTA reads "Enable"; KPI/meter still rendered using last-known evaluation. |
| Rule without evaluation            | KPI summary cells show "—"; threshold-card empty.                                                          |
| Rule with `warnThreshold === null` | Threshold meter still renders, but warn tick is hidden.                                                    |
| Rule with `overThreshold === null` | Threshold meter still renders, but over tick is hidden; fill never reaches "error" tone.                   |

## Mutation lifecycle

EditRuleDialog (with simulated 10% validation drift):

```
opened ─[Cancel]─▶ closed
       ─[Save]──▶ running ─(720ms)─▶ done   ─(480ms)─▶ closed (parent commits)
                                       └─▶ error ("validation: warn must be < over") ─[Cancel]─▶ closed
                                                                                       └─[Save]──▶ running
```

Toggle / Delete dialogs use a 2-phase variant (no error simulation).

CreateRuleDialog has a 2-phase + collision-on-name precheck.

Notes:

- `running` phase is non-cancellable (Esc + backdrop are no-ops).
- `done` phase auto-closes after a 360-480ms grace; parent commits the
  mutation to local state and refetches evaluations.
- `error` phase keeps the dialog open with retry.

## Hero actions states

| Bootstrap | Rule shape    | Edit | Toggle  | Delete |
| --------- | ------------- | ---- | ------- | ------ |
| not-ready | any           | ❌   | ❌      | ❌     |
| ready     | enabled rule  | ✓    | Disable | ✓      |
| ready     | disabled rule | ✓    | Enable  | ✓      |

## KPI strip states (topbar)

The topbar KPI strip shows live counts of evaluations by status. It
remains visible in all states; counts default to 0 when no evaluations
exist. The "rules" cell shows total count regardless of status.

## A11y / focus rules

- After RuleNav item click → focus jumps to `.rule-detail__title`.
- After dialog dismiss → focus returns to the trigger button.
- After Edit / Create commit → focus returns to the trigger button (or
  the newly-created rule in the nav for Create).
- After Toggle commit → focus stays on the Toggle button (label may
  flip Disable ↔ Enable).
- After Delete commit → focus jumps to the next rule's nav row, or to
  the empty card if list is now empty.
- ⌘K → focus the rule-nav search input from anywhere.
- Status filter strip uses `role="tablist"` + `aria-selected`.

## Boundary cases

- **All rules disabled**: KPI strip shows ok=N (server may still
  evaluate disabled rules into ok status).
- **`overThreshold === null` and `warnThreshold === null`**: rule is a
  "monitor only" rule — never fires.
- **Filter status = warn but no warn rules**: nav shows "No rules
  match."; the status tab still shows count=0.
- **Concurrent edit**: prototype simulates a 10% rejection on edit.
  Production should also surface 409 on optimistic-concurrency drift.
- **Disabled rule edit**: editing a disabled rule keeps it disabled
  unless the form's `enabled` checkbox is also flipped.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block.
