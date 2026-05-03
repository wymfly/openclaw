# plugins — interactions

> Pointer, keyboard, hover, empty, error, and dialog flows.

## Keyboard

| Key                 | Context                  | Behavior                                                 |
| ------------------- | ------------------------ | -------------------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere in the panel    | Focus search input in toolbar                            |
| `⌘R` / `Ctrl R`     | anywhere in the panel    | Refresh inventory (debounced 320ms; stays on `loading`)  |
| `Esc`               | detail view, no dialog   | Return to list view (preserves selected id + active tab) |
| `Esc`               | any open dialog          | Close dialog, focus the trigger                          |
| `Enter`/`Space`     | focused inventory row    | Activate row → navigate to detail                        |
| `Tab` / `Shift Tab` | within a dialog          | Cycle focus inside dialog (focus trap)                   |
| `Arrow keys`        | inside segmented control | Move active option (production: ARIA tablist)            |

Production must keep these behaviors. Prototype implements only `⌘K`, `⌘R`, `Esc`,
`Enter` / `Space` row activation.

## Pointer

- **List rows** — full-row click target (cursor `pointer`). Click activates → detail.
- **Toolbar search** — typing filters in real time; no debounce in prototype, production should
  add ~120ms debounce to avoid render thrash on large inventories.
- **Segmented controls** — single click sets active filter. No multi-select.
- **Hero "Manifest" / "Raw" buttons** — open the corresponding dialog; close via the dialog's
  `×` button or backdrop click.
- **Diagnostic rows** — click anywhere on the row → open `DiagnosticDetailDialog` for that entry.
- **Modal backdrop** — click outside the modal frame closes it. Close also via the `×` button.

## Hover

- **List rows** — background tint on hover; left border becomes accent on `:focus-visible`.
- **Tabs** — text color brightens on hover; active tab carries the accent underline.
- **Capability chips, origin pill, status pill, event pill** — visual only, no hover affordance.
- **Buttons** — ghost buttons darken background; primary button uses accent hover token.

## Empty / loading / error

| Scenario                  | UI                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `listState = "loading"`   | Centered spinner row with copy "Loading plugin inventory…"                                 |
| `listState = "error"`     | Error icon + headline + retry button (`onRefresh`)                                         |
| `listState = "empty"`     | Extension icon + headline "No plugins match this filter." + hint to clear filters          |
| `detailState = "loading"` | Hero remains visible; below it spinner row                                                 |
| `detailState = "error"`   | Hero remains visible; below it error panel; tab content from inventory still renders below |
| Diagnostics tab — clean   | Success block "No diagnostics reported" with check glyph                                   |
| Manifest tab — no project | Muted banner "BFF returned no projected manifest" + inventory fallback fields              |
| Audit tab — no events     | Empty block "No activation audit projected for this plugin yet."                           |

## Dialog flows

### DiagnosticDetailDialog

1. User opens via diagnostics-row click OR Tweaks panel toggle.
2. Dialog renders message, level, source identity (id + version + origin), and a remediation hint
   that varies with level (`error` → "Check runtime logs and restart Gateway", etc.).
3. Footer: `Close` (ghost) + `Re-check on next sync` (primary, no-op in prototype — informational).
4. Esc / backdrop / `×` / `Close` → close, focus returns to the trigger row.

### ManifestPreviewDialog

1. User opens via the hero's `Manifest` button or Tweaks panel toggle.
2. If BFF projected a manifest, render pretty-printed JSON in a scrollable code block.
3. Else, render an info banner ("BFF returned no projected manifest") followed by inventory
   fallback fields stitched into the same JSON shape.
4. `Copy JSON` ghost button → writes to clipboard via `navigator.clipboard.writeText`. Button
   label switches to `Copied` for 1.4s.
5. `Close` (primary) → close.

### RawJsonDialog

1. User opens via the hero's `Raw` button or Tweaks panel toggle.
2. Pretty-prints the entire `DeckGoPluginInventoryEntry` (debug surface).
3. `Copy JSON` works the same as ManifestPreviewDialog.
4. `Close` (primary) → close.

## Tweaks-driven exploration

The Tweaks panel exposes design-time knobs that can otherwise be hard to reach:

- `listState` lets reviewers see the loading / error / empty states without touching the network.
- `detailState` exercises the cached hero with stale tab content.
- `selectedPlugin` rotates through the 12 mock plugins to verify every status / capability /
  origin combination.
- Dialog toggles (`diagnosticOpen` / `manifestOpen` / `rawOpen`) open each dialog directly with
  the selected plugin's first diagnostic / manifest / raw payload.

In production, these knobs disappear; corresponding states arrive from real fetch + selectors.
