# alerts — interactions

## Keyboard

| Key             | Context                | Behavior                               |
| --------------- | ---------------------- | -------------------------------------- |
| `⌘K` / `Ctrl K` | anywhere               | Focus search input                     |
| `⌘N` / `Ctrl N` | anywhere               | Open RuleEditDialog in create mode     |
| `⌘R` / `Ctrl R` | anywhere               | Refresh inventory (320ms debounce)     |
| `Esc`           | detail view, no dialog | Return to list view                    |
| `Esc`           | any open dialog        | Close dialog, focus trigger            |
| `Enter`/`Space` | focused rule row       | Activate row → navigate to detail      |
| `Tab`/`Shift T` | within a dialog        | Cycle focus inside dialog (focus trap) |

## Pointer

- **Rule rows** — full-row click → detail. Cursor `pointer`.
- **Inline icon buttons** (Test fire, Power toggle) — independent click; bubble stopped.
- **Toolbar search** — typing filters in real time.
- **Action / entity / enabled filters** — single click sets active filter.
- **Hero buttons** — Test fire / Disable / Edit / Delete drive their dialogs.
- **Modal backdrop** — click outside the modal frame closes it.

## Hover

- **Rule rows** — background tint; left border accent on `:focus-visible` / `--selected`.
- **Tabs / segments** — text color brightens.
- **Entity-tile / action-tile in RuleEditDialog** — background lifts; active state has accent
  border + soft accent fill.

## Empty / loading / error

| Scenario                | UI                                                  |
| ----------------------- | --------------------------------------------------- |
| `listState = "loading"` | Spinner row "Loading alert rules…"                  |
| `listState = "error"`   | Error icon + retry button                           |
| filter zero results     | Bell icon + "No rules match…" + Create CTA          |
| Recent fires — empty    | "No recent fires for this rule." empty block        |
| Audit — empty           | "No audit projected for this rule yet." empty block |

## Dialog flows

### RuleEditDialog

1. Opens via `⌘N`, toolbar **New rule**, or hero **Edit**.
2. Draft initializes: empty (create) or `rule` (edit).
3. Form fields:
   - Name (text)
   - Entity type (radio grid of EntityGlyph tiles, 4 cols)
   - Condition DSL (mono text)
   - Threshold (number)
   - Action (radio grid of 3 ActionPill tiles with descriptions)
   - Cooldown (segmented presets: 1m / 5m / 10m / 30m / 1h / 4h / 24h)
   - Enabled (checkbox)
4. **Save** → validate → on errors, render inline + stay open; on ok → simulated mutation;
   dialog closes.
5. **Cancel** discards draft.

### DeleteRuleDialog

1. Open from hero **Delete**.
2. Body: "rule will stop evaluating immediately, history retained, no undo".
3. **Delete rule** (danger) → simulated mutation; close.

### TestFireDialog

1. Open from inline list row Test-fire button OR hero **Test fire**.
2. Renders ActionPill + brief explanation of what firing does + sample payload JSON.
3. **Close** ends.

## Inline row actions

- **Test fire icon button** → opens TestFireDialog with that rule selected (regardless of
  current detail selection).
- **Power toggle icon button** → flips `enabled`; visual highlight reflects new state.

## Tweaks-driven exploration

The Tweaks panel exposes:

- `view` / `listState` / `detailState` / `selectedRule` / `activeTab`
- 4 dialog toggles + `editMode` (`create` vs `edit`).

In production these knobs disappear; corresponding state arrives from real fetch + selectors.
