# budget — high-fidelity handoff (v2)

**Status:** `revised v2 — pending implementation`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`budget/` is the **deck-go budget governance workbench** — a rule-driven
threshold panel where operators define warn/over thresholds per dimension
(USD cost / tokensIn / tokensOut / totalTokens) and scope (global /
workspace / agent / task / channel), and observe each rule's current
status (ok / warn / over) against live usage.

The hard rule: this is a **rules + evaluations** panel, not a
time-series usage dashboard. There is no forecast, no chart, no per-day
breakdown — those belong to the **usage** panel (US-014). Budget surfaces
declarative thresholds and a single "current vs warn vs over" snapshot
per rule.

## File inventory

| File                      | Purpose                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~24-line shell loading React + Babel + 6 jsx + 2 css.                                                                                                                                                                     |
| `data.js`                 | Mock fixture: 7 rules across 4 dimensions × 5 scopes × 6 periods + 7 evaluations (ok/warn/over) + 4 recentChanges + bootstrap status + 5-agent directory.                                                                 |
| `icons.jsx`               | 21 SVG icons + per-dimension icons (cost/tokensIn/tokensOut/totalTokens) + `DimensionPill` (4 tones) + `BudgetStatusPill` (3 tones ok/warn/over) + `ScopeChip` (5 tones) + `PeriodChip` + `ActorChip` + `ThresholdMeter`. |
| `rule-nav.jsx`            | Left rail: status filter strip (all/ok/warn/over) + searchable rule list + per-rule status pill + scope/dimension/period meta + disabled-pill.                                                                            |
| `rule-detail.jsx`         | Right pane: hero (name + dimension/scope/period meta + actions) + 4-cell KPI summary + threshold meter + rule definition table + recent changes.                                                                          |
| `dialogs.jsx`             | `EditRuleDialog` (3-phase wizard with full RuleForm) + `CreateRuleDialog` + `ToggleRuleDialog` + `DeleteRuleDialog` + `ModalShell`.                                                                                       |
| `app.jsx`                 | `BudgetApp` orchestrator + topbar KPI grid (ok/warn/over/rules count) + draft state + ⌘K + dialog lifecycle + 10% simulated validation error on edit.                                                                     |
| `styles.css`              | Two-pane workspace + KPI grid + threshold meter (CSS gradient + tick marks) + rule list + rule definition table + change list + modal shell + density variants + light theme stub.                                        |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                                                                                                                      |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density).                                                                                                                                                                                  |
| `prototype-v1-codex.html` | Original Codex single-file prototype (383 lines).                                                                                                                                                                         |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export type DeckGoBudgetDimension = "tokensIn" | "tokensOut" | "totalTokens" | "cost";

export type DeckGoBudgetStatus = "ok" | "warn" | "over";

export interface DeckGoBudgetRule {
  id: string;
  name: string;
  scope: string; // "global" | "workspace" | "agent" | "task" | "channel"
  agentId: string | null;
  taskId: string | null;
  dimension: DeckGoBudgetDimension;
  warnThreshold: number | null;
  overThreshold: number | null;
  period: string; // "minute" | "hour" | "day" | "week" | "month" | "task"
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeckGoBudgetEvaluation {
  ruleId: string;
  ruleName: string;
  status: DeckGoBudgetStatus;
  current: number;
  warnThreshold: number | null;
  overThreshold: number | null;
  dimension: DeckGoBudgetDimension;
}

export interface DeckGoBudgetRulesResponse {
  rules: DeckGoBudgetRule[];
}

export interface DeckGoBudgetEvaluationsResponse {
  evaluations: DeckGoBudgetEvaluation[];
}
```

Endpoints:

- `GET    /api/usage/budget` → `DeckGoBudgetRulesResponse`
- `GET    /api/usage/budget/evaluate` → `DeckGoBudgetEvaluationsResponse`
- `POST   /api/usage/budget` → create rule
- `PATCH  /api/usage/budget/{ruleId}` → update rule
- `DELETE /api/usage/budget/{ruleId}` → delete rule

## Contract-reality scope correction

The **PRD originally listed** "KPI grid (current spend / projected /
quota / variance), Time-series chart, Per-agent / per-channel breakdown
table, Forecast card, Stack decision: chart lib flagged in
api-discrepancy.md if needed". The contract reality:

- **No time-series**. `DeckGoBudgetEvaluation.current` is a single number per
  rule — current usage in the rule's dimension over the rule's period.
  No daily/hourly buckets.
- **No forecast**. Server snapshots `current` against thresholds; no
  projection to end-of-period.
- **No per-agent / per-channel breakdown**. Each rule is already
  scoped by agentId/taskId/channel; rules ARE the breakdown.
- **Chart lib stack decision deferred** to **US-014 usage** — that
  panel has `DeckGoUsageCostResponse` with `daily` time-series + cost
  aggregates, which is where time-series rendering actually lives. See
  `docs/project/stack-decisions.md` (pending) for the locked decision
  there.

v2 reflects the contract: a two-pane workbench — rule list (left, with
status filter strip) + rule detail (right, with KPI summary +
threshold meter + definition table + change history).

The threshold meter is a **CSS-only** component (single bar with tick
marks at warn/over) — no chart lib required.

## Mutation model

| Mutation       | UI surface       | Server behavior                    | Contract today                         |
| -------------- | ---------------- | ---------------------------------- | -------------------------------------- |
| Edit rule      | EditRuleDialog   | PATCH; server returns updated rule | ✅ `PATCH /api/usage/budget/{ruleId}`  |
| Toggle enabled | ToggleRuleDialog | PATCH with `enabled` toggle        | ✅ same endpoint                       |
| Create rule    | CreateRuleDialog | POST; server returns new rule      | ✅ `POST /api/usage/budget`            |
| Delete rule    | DeleteRuleDialog | DELETE; server returns 204         | ✅ `DELETE /api/usage/budget/{ruleId}` |

After every mutation, the panel re-fetches `GET
/api/usage/budget/evaluate` so status pills reflect the new
threshold values immediately.

The prototype simulates a 10% validation error on edit (mostly to
exercise "warn must be < over" assertion) and otherwise commits.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState` (used implicitly by topbar + rule-detail empty card).

`@/design-system/icons`:

- `IconRefresh`, `IconPlus`, `IconEdit`, `IconTrash`, `IconClose`,
  `IconCheck`, `IconAlert`, `IconBolt`, `IconClock`, `IconCoin`,
  `IconArrowDown`, `IconArrowUp`, `IconSigma`, `IconSearch`, `IconUser`,
  `IconUsers`, `IconShield`, `IconHash`, `IconPower`.

Per-dimension icons (`IconCoin` for cost, `IconArrowDown` for tokensIn,
`IconArrowUp` for tokensOut, `IconSigma` for totalTokens) and
`DimensionPill` / `ScopeChip` / `PeriodChip` / `BudgetStatusPill` /
`ThresholdMeter` stay local to `budget/`. **`ThresholdMeter` is a
strong promotion candidate** — usage panel and quota meters elsewhere
will need the same shape.

## How to implement

1. Open `prototype.html` in a static server. Walk every state via the
   Tweaks panel (theme; density). Fire each mutation.
2. Translate to `frontend-new/src/components/panels/budget/` keeping
   the class-name shape (`rule-nav__*`, `rule-detail__*`,
   `rule-summary__*`, `threshold-meter__*`, `dim-pill--*`,
   `scope-chip--*`).
3. Wire real fetcher in `frontend-new/src/api/budget.ts`:
   - `fetchBudgetRules()` → `GET /api/usage/budget`
   - `evaluateBudgetRules()` → `GET /api/usage/budget/evaluate`
   - `createBudgetRule(input)` → `POST /api/usage/budget`
   - `updateBudgetRule(id, input)` → `PATCH /api/usage/budget/{id}`
   - `deleteBudgetRule(id)` → `DELETE /api/usage/budget/{id}`
4. Hardcoded literal strings get extracted to
   `frontend-new/src/i18n/{en,zh}.json`.
5. **Form validation client-side**: enforce `warnThreshold <
overThreshold` and both `>= 0`. The prototype simulates a server
   validation rejection on edit; production should also pre-check
   client-side and disable Save until valid.
6. Per-mutation refresh: after every PATCH/POST/DELETE, refetch
   `evaluate` so status pills reflect the new thresholds. Don't trust
   the local enabled flag — server may reject the toggle for some
   rules (system-protected, per future contract addition).

## Stack decisions punted from this panel

- **Chart lib**: no time-series surface here; defer until **US-014
  usage**. If usage panel locks recharts, the same lib serves any
  later budget-history view (currently absent from the contract).
- **Form lib**: `useState` is enough for 8 fields × 4 dialogs.
  Production may swap to react-hook-form for consistency with config /
  alerts; not blocking.

## Open questions for follow-up

1. **Predictive / forecast** — there's no projected end-of-period
   number in the contract today. Should the contract add
   `projection` (numeric, from a simple linear extrapolation) to
   `DeckGoBudgetEvaluation`? Useful for "warn-soon" UX without a
   chart.
2. **Per-rule history** — `current` is a single point. Should the
   contract gain `GET /api/usage/budget/{ruleId}/history?period=24h`
   returning a thin time-series for the threshold meter? Would let
   operators "see why a rule went over".
3. **Org / team scoping** — the contract has scope ∈
   global/workspace/agent/task/channel but no concept of multi-tenant
   org. Out of scope for v2 panel; surface as future contract evolution.
4. **Auto-disable on N over events** — the prototype's recentChanges
   includes an `automation:hooks/budget` actor that auto-disabled a
   rule. There's no contract for this hook; it's prototype-assumed.
5. **Notification routing** — when a rule fires warn/over, who gets
   notified? The alerts panel (US-007) handles delivery, but the
   contract doesn't link a budget rule to an alert rule. Should the
   contract gain `notifyRuleId: string | null` on
   `DeckGoBudgetRule`?
