# plugins — states

> View routing, list states, per-tab states, focus management, a11y semantics.

## View routing

Two top-level views, page-transition (no split panel):

- `view = "list"` → `PluginsListView`
- `view = "detail"` → `PluginsDetailView`

Routing is local component state (prototype) → `useRoute()` / store hook in production. Selected
plugin id and active tab persist across `list↔detail` transitions so going back keeps your scroll
position and previously-open tab.

## List states

| State     | Trigger                              | Renders                                          |
| --------- | ------------------------------------ | ------------------------------------------------ |
| `ready`   | inventory fetch resolved with rows   | Toolbar + KPI strip + filtered row list          |
| `loading` | first fetch or manual refresh        | Spinner + "Loading plugin inventory…"            |
| `error`   | BFF returned 5xx / network fail      | Error icon + retry button                        |
| `empty`   | inventory resolved but no rows match | Empty illustration + "Try clearing search…" hint |

The `empty` state is reached via two paths: 0 inventory entries from BFF, or filters reduce the
list to zero. Both render the same component; copy adapts in production via a `cause` prop.

### Filters that compose

- `searchQuery` (string, free text on id + name + capability + channel + tool + provider)
- `filter` (capability segmented: `all | channel | tool | agent | provider`)
- `origin` (segmented: `all | bundled | extension`)
- `scope` (segmented: `all | channel`) — emulates the BFF API: scope=channel calls the default
  `GET /api/deck/plugins`, scope=all calls `GET /api/deck/plugins?capability=all`. Switching this
  in production should re-fetch.

All four are independent and AND-combined.

## Detail states

| State     | Trigger                               | Renders                                                                 |
| --------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `ready`   | plugin found in inventory             | Hero + tabs + active tab body                                           |
| `loading` | refetch initiated                     | Hero (cached) + spinner panel below tabs                                |
| `error`   | manifest / timeline projection failed | Hero (cached) + inline error panel; tab content from inventory still ok |

A missing plugin id (e.g., user navigates back after the row was removed by a refresh) renders
the `ListView` again as a fallback — it does not show a 404 page.

## Per-tab state

| Tab            | Source                                 | Empty fallback                              |
| -------------- | -------------------------------------- | ------------------------------------------- |
| `overview`     | inventory entry only                   | n/a (overview always renders)               |
| `capabilities` | inventory entry only                   | per-section empty blocks                    |
| `diagnostics`  | `plugin.diagnostics`                   | "No diagnostics reported" success block     |
| `activation`   | inventory + activation chain heuristic | n/a                                         |
| `manifest`     | BFF projection + inventory fallback    | "No projected manifest" muted banner        |
| `audit`        | BFF activation timeline                | "No activation audit projected" empty block |

## Tweaks panel

Design-time only. Exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `comfortable | compact`
- `view` ∈ `list | detail`
- `listState` ∈ `ready | loading | error | empty`
- `scope` ∈ `all | channel`
- `origin` ∈ `all | bundled | extension`
- `selectedPlugin` (any plugin id from MOCK)
- `activeTab` ∈ all 6 plugin tabs
- `detailState` ∈ `ready | loading | error`
- `diagnosticOpen` / `manifestOpen` / `rawOpen` ∈ booleans

This panel is dropped at production translation; it is design-time tooling only.

## Focus

- List view first focusable: search input.
- After selecting a row, focus moves to the back button in the detail hero.
- After dismissing a dialog (Esc / backdrop / Close button), focus returns to the trigger.
- Esc:
  - In a dialog → close dialog (handled per-dialog).
  - On detail view, no dialog open → return to list.
  - On list view → no-op (do not eat Esc; let global handlers see it).

## A11y semantics

- `role="tablist"` / `role="tab"` / `aria-selected` on:
  - Capability segmented control
  - Origin segmented control
  - Scope segmented control
  - Detail tab strip
- `role="button"` + `tabIndex={0}` on inventory rows; Enter/Space activates.
- `role="dialog"` + `aria-modal="true"` + `aria-label` on each dialog. Focus trap inside dialog.
- Status, capability, origin, and diagnostic pills always include text — color is decoration only.
- Activation chain nodes carry both icon (✓ / number) and label, never relying on color alone.
- Empty / error / loading states use polite live regions (`aria-live="polite"`) so refresh
  transitions are announced.
