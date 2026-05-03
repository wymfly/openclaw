# Alerts Components

## Component Tree

```text
AlertsPanel
  AlertsMetric x4
  RuleList
    RuleRow
  SelectedRuleDetail
    TriggerExpressionSurface
    ActionDeliverySurface
    TimestampSurface
    InlineDeleteConfirmation
  RuleForm
  FiredAlertsList
```

## `AlertsPanel`

Owns server state, selection, view mode, editing rule, inline delete
confirmation, save state, last mutation action, and load error.

Props: none. It is resolved by the panel registry.

## `AlertsMetric`

Props:

```ts
{
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}
```

Renders compact metric evidence for rule count, enabled count, webhook actions,
and rules with `lastFiredAt`.

## `RuleList`

Props:

```ts
{
  rules: DeckGoAlertRule[];
  selectedRuleId: string | null;
  onSelect: (rule: DeckGoAlertRule) => void;
}
```

Rows are single buttons. Inline edit/toggle/delete actions belong in selected
detail, not inside the inventory row.

## `SelectedRuleDetail`

Rendered inside `AlertsPanel` because it needs mutation handlers and local
confirmation state. It must show:

- rule name
- entity type
- condition
- threshold
- action
- cooldown
- enabled state
- last fired fallback
- updated timestamp

## `RuleForm`

Props:

```ts
{
  rule?: DeckGoAlertRule;
  saving: boolean;
  onSubmit: (input: AlertRuleInput) => Promise<void>;
  onCancel: () => void;
}
```

Validation is local and prevents mutation calls when required fields or numeric
fields are invalid.

## `FiredAlertsList`

Props:

```ts
{
  rules: DeckGoAlertRule[];
}
```

Renders the unsupported-history notice and only lists `lastFiredAt` fallback
snapshots from rules when present.
