# activity — interactions

> Pointer, keyboard, hover, empty, error, and dialog flows.

## Keyboard

| Key                 | Context                | Behavior                                                |
| ------------------- | ---------------------- | ------------------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere in the panel  | Focus search input in toolbar                           |
| `⌘R` / `Ctrl R`     | anywhere in the panel  | Refresh inventory (debounced 320ms; stays on `loading`) |
| `Esc`               | EventDetailDialog open | Close dialog, focus the trigger row                     |
| `Enter` / `Space`   | focused feed row       | Open EventDetailDialog                                  |
| `Tab` / `Shift Tab` | within a dialog        | Cycle focus inside dialog (focus trap)                  |

Production must keep these. Prototype implements `⌘K`, `⌘R`, `Esc`, and `Enter` / `Space`
row activation.

## Pointer

- **Feed rows** — full-row click → open EventDetailDialog. Cursor `pointer`.
- **Toolbar search** — typing filters in real time; production should add ~120ms debounce on
  large feeds.
- **Family / severity / time-range segments** — single click sets active filter.
- **Modal backdrop** — click outside the modal frame closes it.

## Hover

- **Feed rows** — background tint on hover; left border becomes accent on `:focus-visible`.
- **Tabs / segments** — text color brightens on hover; active option highlighted.
- **Event glyph** — visual only (decorative).

## Empty / loading / error

| Scenario                | UI                                                                              |
| ----------------------- | ------------------------------------------------------------------------------- |
| `feedState = "loading"` | Centered spinner row with copy "Loading activity feed…"                         |
| `feedState = "error"`   | Error icon + headline + retry button (`onRefresh`)                              |
| filter zero results     | Activity icon + "No events match this filter." + clear-filter / time-range hint |
| time-range past cutoff  | Same empty-block; copy hints at widening the range                              |

## Dialog flows

### EventDetailDialog

1. Open via feed row click or Tweaks toggle.
2. Renders the event header (severity-tinted pill + type + description), full timestamp +
   id, agent chip if present, details (mono pre), raw JSON code block.
3. **Copy JSON** writes the entire event to clipboard via `navigator.clipboard.writeText`.
   Button label flips to "Copied" for ~1.4s.
4. **Close** (primary) / Esc / backdrop click / `×` → close, focus returns to the trigger row.

## Tweaks-driven exploration

The Tweaks panel exposes:

- `feedState` lets reviewers exercise loading / error / empty without a network.
- All four filters can be flipped from the panel (mode toggle for filter / severity / time
  range, plus search).
- `selectedEvent` rotates through 20 events for the dialog.

In production these knobs disappear; corresponding state arrives from real fetch + selectors

- live stream.
