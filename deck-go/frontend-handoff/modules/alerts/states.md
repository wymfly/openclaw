# alerts — states

## View routing

- `view = "list"` → `AlertsListView`
- `view = "detail"` → `AlertsDetailView`

Selected ruleId persists across `list↔detail`. No mode dimension; the panel is a single
inventory + a detail page.

## List states

| State     | Trigger                             | Renders                                    |
| --------- | ----------------------------------- | ------------------------------------------ |
| `ready`   | rules fetch resolved                | KPI strip + toolbar + filtered rows        |
| `loading` | first fetch or manual refresh       | Spinner + "Loading alert rules…"           |
| `error`   | BFF returned 5xx / network fail     | Error icon + retry button                  |
| `empty`   | filter or search produces zero rows | Bell icon + "No rules match…" + Create CTA |

### Filters that compose

- `searchQuery` — free text on `id + name + condition + entityType`.
- `filterAction` — segmented: `all | toast | activity | webhook`.
- `filterEntity` — `<select>` over the entity-type universe (any entity / specific).
- `filterEnabled` — segmented: `all | enabled | disabled`.

All AND-combined.

## Detail states

| State     | Trigger                       | Renders                                                 |
| --------- | ----------------------------- | ------------------------------------------------------- |
| `ready`   | rule found in inventory       | Hero + tabs + active tab body                           |
| `loading` | refetch initiated             | Hero (cached) + spinner panel below tabs                |
| `error`   | BFF projection (fires) failed | Hero (cached) + inline error panel; tab content renders |

## Per-tab state

| Tab          | Source         | Empty fallback                               |
| ------------ | -------------- | -------------------------------------------- |
| `overview`   | inventory only | n/a                                          |
| `conditions` | inventory only | n/a                                          |
| `fires`      | BFF projection | "No recent fires for this rule." empty block |
| `audit`      | BFF projection | "No audit projected for this rule yet."      |

## Dialog state

### RuleEditDialog

```
opened ─[edit field]─▶ opened (draft mutated)
       ─[Save]─▶ saving ─[validate ok]─▶ closed (parent applies onSave(draft))
                       └─[validate fail]─▶ opened (errors shown)
       ─[Cancel]─▶ closed (draft discarded)
```

Validation runs on Save. Errors render inline under the offending field (`input-error` class)
with `aria-live="polite"`.

### DeleteRuleDialog

Two-button confirm. No internal state.

### TestFireDialog

Pretty-print + close. No internal state.

## Tweaks panel

Design-time only. Exposes:

- `theme`, `density`
- `view` ∈ `list | detail`, `listState`, `detailState`
- `selectedRule`, `activeTab`
- All 4 dialog toggles + `editMode` ∈ `create | edit`

Dropped at production translation.

## Focus

- List view first focusable: search input.
- Inline icon buttons (Test fire + Power) have their own focus order; the row's `role="button"`
  preserves the navigation hierarchy.
- After selecting a row → focus moves to back button in detail hero.
- After dismissing a dialog → focus returns to trigger.
- Esc:
  - In dialog → close dialog.
  - In detail (no dialog) → return to list.
  - In list → no-op.
- ⌘N → opens RuleEditDialog in `create` mode.

## A11y semantics

- Action / enabled segments: tablist + tab + aria-selected.
- Entity filter: native `<select>`.
- Detail tabs: tablist + tab + aria-selected.
- RuleEditDialog inputs: aria-label per field; error message tied to input via `aria-describedby`
  (production).
- Action pills always carry text; color is decoration only.
- ToggleEnabled icon button reflects state in `aria-label` ("Disable" / "Enable") and visual
  highlight (`icon-btn--on` when enabled).
