# budget — components (v2)

## Tree

```
BudgetApp                                          [app.jsx]
├─ Topbar
│  ├─ eyebrow / title / subtitle (endpoint hint)
│  ├─ KPI strip: ok / warn / over / rules count
│  ├─ bootstrap status pill
│  └─ ⌘K kbd hint + Refresh
├─ RuleNav (left rail)                             [rule-nav.jsx]
│  ├─ head: title + rules count + New CTA
│  ├─ status filter strip (4-tab grid: all / ok / warn / over)
│  ├─ search input
│  └─ rule list × N (name + dimension chip + scope chip + period + status pill + disabled pill)
└─ Main column                                     [app.jsx]
   └─ RuleDetail                                   [rule-detail.jsx]
      ├─ Hero: rule name + dimension/scope/period meta + actions (Edit / Toggle / Delete)
      ├─ Banner (warn): bootstrap-not-ready alert
      ├─ Section: KPI summary (4-cell grid status / current / warn / over)
      ├─ Section: Threshold meter (CSS gradient bar + tick marks at warn/over)
      ├─ Section: Definition (8-row 2-column key-value grid)
      └─ Section: Recent changes (prototype/local-only; no current BFF endpoint)
```

## Dialogs

| Component          | Trigger                       | Body                                                                           |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------ |
| `EditRuleDialog`   | Hero "Edit" CTA               | Full RuleForm (8 fields) + 3-phase wizard with 10% simulated validation error. |
| `CreateRuleDialog` | Nav "New" CTA                 | Full RuleForm + 2-phase wizard + collision detection on name.                  |
| `ToggleRuleDialog` | Hero "Disable" / "Enable" CTA | KV preview + 2-phase wizard.                                                   |
| `DeleteRuleDialog` | Hero "Delete" CTA             | KV preview + 2-phase wizard with warn tone.                                    |

All dialogs share `ModalShell` (Esc + backdrop click to close, focus trap on
mount). The wizard's `running` phase is non-cancellable.

## Local molecules

### DimensionPill

`<DimensionPill dimension="cost" />` — color-coded per dimension (cost
mustard, tokensIn blue, tokensOut violet, totalTokens teal). Inline
DimensionIcon + label. Strong promotion candidate for usage panel.

### DimensionIcon

Resolves per-dimension SVG: `IconCoin` (cost) / `IconArrowDown`
(tokensIn) / `IconArrowUp` (tokensOut) / `IconSigma` (totalTokens) /
fallback `IconBolt` for unknown.

### BudgetStatusPill

Wraps `StatusPill` with the correct tone+icon for the 3 budget
statuses (ok=success/warn=warn/over=error).

### ScopeChip

Color-coded per scope with appropriate icon. Surfaces the scope target
inline (e.g., `agent:main`, `task:review-pool/*`).

### PeriodChip

Clock icon + "per day" / "per hour" / etc. label.

### ThresholdMeter

Single CSS bar with:

- Fill width = `min(100, current/maxScale × 100)` where `maxScale = over × 1.15`.
- Fill tone: success (current < warn) / warn (warn ≤ current < over) / error (current ≥ over).
- Two vertical tick marks at warn% and over% positions.

Strong promotion candidate; usage panel quota meters need the same shape.

### RuleHeroSummary

4-cell KPI grid: Status / Current / Warn at / Over at. Each cell tinted
by status. Hint line shows "X% of warn" / "X% of over" derived from
current/threshold.

### ChangeRow

Single mutation entry. 5 mutation kinds (`update` / `create` /
`delete` / `enable` / `disable`).

### ActorChip

Shared with identity panel — color-codes by actor prefix (operator /
automation / system).

## Per-section renderers

The single right pane is `RuleDetail` — flat curated layout, not
schema-driven.

### Hero

- Eyebrow / rule name / dimension+scope+period+enabled meta pills + status pill.
- Foot: rule id + created relative + updated relative.
- Action cluster: Edit (primary) / Disable-or-Enable / Delete.
- All actions disabled when `bootstrap.ok === false`.

### KPI summary

- 4-cell grid (status, current, warn, over) — tinted per cell.
- Numeric formatting: `cost` → `$X.XX` (or `$X.XXX` if < 1); tokens →
  `X.Yk` / `X.YYM` / locale-string.

### Threshold meter

- Hero card with single ThresholdMeter + 3-mark legend.
- Empty state when no evaluation snapshot exists.

### Definition

- 8-row 2-column grid: scope / agentId / taskId / dimension / period /
  warnThreshold / overThreshold / enabled.
- Read-only display; mutations go through Edit dialog.

### Recent changes

- Prototype/local-only evidence filtered to mutations scoped to the selected rule.
- Not a production guarantee until a Deck-facing audit endpoint exists.

## Props (production target)

```ts
type BudgetAppProps = {};

type RuleNavProps = {
  rules: DeckGoBudgetRule[];
  evaluations: DeckGoBudgetEvaluation[];
  selectedId: string | null;
  onSelect: (ruleId: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onCreate: () => void;
  fetchedAt: number;
  onRefresh: () => void;
  filterStatus: "all" | "ok" | "warn" | "over";
  onFilterStatusChange: (s: "all" | "ok" | "warn" | "over") => void;
};

type RuleDetailProps = {
  rule: DeckGoBudgetRule | null;
  evaluation: DeckGoBudgetEvaluation | null;
  now: number;
  recentChanges: ChangeEvent[];
  bootstrap: DeckGoBootstrapStatusResponse;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
};

type EditRuleDialogProps = {
  rule: DeckGoBudgetRule;
  agentDirectory: { id: string; label: string }[];
  onClose: () => void;
  onCommit: (next: DeckGoBudgetRule) => void;
};
```

## Class-name intent

| Class                             | Purpose                           |
| --------------------------------- | --------------------------------- |
| `.budget-app`                     | Top-level grid                    |
| `.budget-app__topbar`             | Header bar with KPI strip         |
| `.budget-app__kpi--*`             | Per-status KPI cell variants      |
| `.budget-app__layout`             | Two-column workspace              |
| `.rule-nav`                       | Left rail container               |
| `.rule-nav__status-tab--*`        | Status filter strip variants      |
| `.rule-nav__item--on`             | Active rule                       |
| `.rule-nav__item--disabled`       | Disabled rule (dimmed)            |
| `.rule-nav__item-disabled-pill`   | "disabled" overlay pill           |
| `.rule-detail`                    | Right pane container              |
| `.rule-detail--empty`             | No-rule-selected state            |
| `.rule-detail__hero`              | Hero card                         |
| `.rule-detail__banner--warn`      | Bootstrap-not-ready warn callout  |
| `.rule-detail__enabled-pill`      | Enabled status pill in hero       |
| `.rule-summary`                   | 4-cell KPI grid                   |
| `.rule-summary__cell--*`          | Per-status KPI cell tint variants |
| `.threshold-card`                 | Threshold meter card              |
| `.threshold-meter__fill--*`       | Per-status fill tint              |
| `.threshold-meter__tick--*`       | Warn/over tick marks              |
| `.threshold-card__legend-mark--*` | Legend swatch variants            |
| `.rule-def`                       | Definition KV grid                |
| `.change-row`                     | Single mutation entry             |
| `.change-row__kind--*`            | Per-kind chip variants            |
| `.dim-pill--*`                    | Per-dimension pill variants       |
| `.scope-chip--*`                  | Per-scope chip variants           |
| `.period-chip`                    | Period chip                       |
| `.modal-backdrop` / `.modal`      | Modal shell                       |
| `.phase--running/done/error`      | Mutation wizard phase rows        |
