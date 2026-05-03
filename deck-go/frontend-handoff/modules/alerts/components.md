# alerts — components

> v2 multi-file handoff. Engineering target is
> `frontend-new/src/components/panels/alerts/`.

## Production component skeleton

```
AlertsPanel
  └── (route) → AlertsListView
                 ├── AlertsToolbar (search + action seg + entity select + enabled seg + create btn)
                 ├── AlertsKpiStrip
                 └── RuleRow[]
                      ├── EntityGlyph
                      ├── ConditionCell (mono code)
                      ├── ThresholdTag
                      ├── ActionPill
                      ├── TimeMono (cooldown / lastFiredAt)
                      └── inline { TestFireBtn, ToggleEnabledBtn }
  └── (route) → AlertsDetailView
                 ├── DetailHero (glyph + name + enabled pill + ActionPill + actions)
                 ├── AlertTabsBar
                 └── (tab body)
                      ├── TabOverview
                      ├── TabConditions (condition-card + ActionExplainer)
                      ├── TabFires
                      └── TabAudit
  └── AlertDialogs
       ├── RuleEditDialog (entity-tile grid + action-tile grid + cooldown seg)
       ├── DeleteRuleDialog
       └── TestFireDialog
```

## Prototype file → production target

| Prototype file     | Production target                                                                 |
| ------------------ | --------------------------------------------------------------------------------- |
| `app.jsx`          | `AlertsPanel.tsx`                                                                 |
| `list-view.jsx`    | `AlertsListView.tsx` + `RuleRow.tsx` + `AlertsKpiStrip.tsx` + `AlertsToolbar.tsx` |
| `detail-view.jsx`  | `AlertsDetailView.tsx` + 4 tab modules                                            |
| `dialogs.jsx`      | `dialogs/RuleEditDialog.tsx` + `DeleteRuleDialog.tsx` + `TestFireDialog.tsx`      |
| `data.js`          | `__fixtures__/alerts.fixture.ts`                                                  |
| `icons.jsx`        | `@/design-system/icons` re-exports + `EntityGlyph.tsx` + `ActionPill.tsx` local   |
| `styles.css`       | per-component `.css` files (kebab-case)                                           |
| `tokens.css`       | dropped                                                                           |
| `tweaks-panel.jsx` | dropped                                                                           |

## Props (shape contracts)

### AlertsListView

```ts
interface AlertsListViewProps {
  rules: AlertRule[]; // from DeckGoAlertsResponse.rules
  selectedId: string | null;
  listState: "ready" | "loading" | "error" | "empty";
  searchQuery: string;
  filterAction: "all" | "toast" | "activity" | "webhook";
  filterEntity: "all" | string;
  filterEnabled: "all" | "enabled" | "disabled";
  entityTypes: string[];
  asOfMs: number;
  runtimeId: string;
  onSearch: (q: string) => void;
  onFilterAction: (a: AlertActionFilter) => void;
  onFilterEntity: (e: string) => void;
  onFilterEnabled: (e: AlertEnabledFilter) => void;
  onSelect: (ruleId: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onToggleEnabled: (ruleId: string) => void;
  onTestFire: (ruleId: string) => void;
}

interface AlertRule extends DeckGoAlertRule {}
```

### RuleRow

```ts
interface RuleRowProps {
  rule: AlertRule;
  selected: boolean;
  onSelect: (ruleId: string) => void;
  onToggleEnabled: (ruleId: string) => void;
  onTestFire: (ruleId: string) => void;
}
```

8 columns: glyph, name+id+entity, condition (mono), threshold, action pill, cooldown, last
fired, inline actions (Test fire + Power toggle).

### AlertsDetailView

```ts
interface AlertsDetailViewProps {
  rule: AlertRule;
  fires: AlertFireEvent[]; // BFF projection
  audit: AlertAuditEvent[]; // BFF projection
  detailState: "ready" | "loading" | "error";
  activeTab: AlertTabId;
  onTabChange: (tab: AlertTabId) => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTestFire: () => void;
  onToggleEnabled: () => void;
}

type AlertTabId = "overview" | "conditions" | "fires" | "audit";
```

### Dialogs

| Dialog             | Props                                                            |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `RuleEditDialog`   | `{ open, mode: "create"                                          | "edit", rule, entityTypes, onClose, onSave }` — form with validation |
| `DeleteRuleDialog` | `{ open, rule, onCancel, onConfirm }`                            |
| `TestFireDialog`   | `{ open, rule, onClose }` — preview action + sample payload JSON |

## Class naming

- `.list-view` / `.kpi-strip` / `.kpi`
- `.toolbar` / `.toolbar__search` / `.seg` / `.seg--cooldown`
- `.row` / `.row--selected` / `.row--muted`
- `.row__condition` / `.row__threshold` / `.row__action` / `.row__cooldown` / `.row__last-fired` / `.row__actions`
- `.threshold-tag` / `.time-mono`
- `.action-pill` / `.action-pill--{toast|activity|webhook}`
- `.meta-pill` / `.meta-pill--off`
- `.detail` / `.hero` / `.tabs` / `.tab` / `.tab--active`
- `.section` / `.field-grid` / `.field-row`
- `.condition-card` / `.condition-card__expr` / `.condition-card__threshold`
- `.action-explainer`
- `.banner` / `.banner--info`
- `.timeline` / `.timeline__row--{fire|created|edited|auto-created}`
- `.event-pill` / `.event-pill--{fire|created|edited|auto-created}`
- `.modal-backdrop` / `.modal--{rule-edit|confirm|test-fire}`
- `.entity-grid` / `.entity-tile`
- `.action-grid` / `.action-tile`
- `.input` / `.input--mono` / `.input--err` / `.input--inline` / `.input-error`
- `.toggle-row`
- `.icon-btn--on`

## Accessibility

- Rule rows: `role="button"`, `tabIndex={0}`, Enter/Space activates.
- Inline icon buttons (Test fire / Power) are independently focusable + labeled; click bubbling
  is stopped so they don't open the row's detail view.
- Action / entity / enabled segmented controls: `role="tablist"` + `role="tab"` + `aria-selected`.
- Detail tabs: same.
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-label`. Focus trap + Esc close.
- RuleEditDialog inputs labeled with explicit `aria-label`.
- Validation errors: live region `aria-live="polite"` so screen readers announce on submit.
- Action pills always carry text; color is decoration only.
