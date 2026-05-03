# models — interactions

## Pointer

- Click a model row → enter detail view, set selected model, reset
  `activeTab` to `overview`.
- Click "Refresh" → re-fetch model registry (`GET /models/config` +
  `models.configured`).
- Click "Add from catalog" → open `CatalogDialog`.
- Click a tab → switch active tab.
- Click "Run probe" → POST `deck.auth.probe`; opens probe dialog with
  result.
- Click "Set default" → PATCH runtime config to set this model as
  default for its provider.
- Click "Configure" (Auth tab) → open `AuthConfigDialog` for the
  provider.
- Click outside a modal backdrop → close modal.

## Keyboard

| Key                              | Action                            |
| -------------------------------- | --------------------------------- |
| `Enter` / `Space` on focused row | Enter detail view.                |
| `Esc` in detail (no modal)       | Return to list.                   |
| `Esc` in modal                   | Close modal.                      |
| `⌘N` / `Ctrl+N`                  | Open `CatalogDialog`.             |
| `⌘K` / `Ctrl+K`                  | Focus list search.                |
| Arrow keys on filter buttons     | Roving focus across filter pills. |

## Hover

- Rows: subtle `--ds-bg-1` hover; default rows keep accent-tinted bg.
- Buttons: 120ms ease background + border-color transition.
- Tabs: text fades from `--ds-text-3` to `--ds-text-1`.
- Quota bars: hover doesn't change appearance (informational only).

## Empty / error / loading

- List: centered block per state; never inline within rows.
- Detail body: tab body shows the state block; hero stays so model
  context never disappears.
- Auth tab: explicit empty when overview misses the provider.
- Pricing tab: empty for local models or un-snapshotted vendors.

## Accessibility

- Root has `data-testid="models-panel"` for E2E.
- Status pills always carry textual label (`ready`, `cooldown`,
  `missing key`, `default`, `fallback`, `reasoning`, `local`); color
  is decoration.
- Quota bars expose numeric percent next to the bar.
- Modals: focus trap inside while open; `Esc` closes; trigger
  re-focuses on close.
- Tabs: `role="tablist"` + `aria-selected`; engineering adds
  `role="tabpanel"` + `aria-labelledby` ties.

## Pointer + keyboard parity

- Filter pills are buttons.
- Rows respond to Enter/Space.
- Tabs respond to Enter/Space.
- Catalog provider list and model cards are buttons.
- Modal close is via close button + `Esc`.

## Long content

- Model ids and provider auth sources use monospace font.
- Long display names truncate via `text-overflow: ellipsis`; `title=`
  exposes full name.
- Audit log rows scroll vertically; each row is fixed-shape grid.

## Dialogs

- `ProbeResultDialog` — informational; "Done" closes. Tile-row for ok
  probes; warn banner for cooldown/error.
- `AuthConfigDialog` — segmented authType selector with per-type
  fields.
- `CatalogDialog` — two-pane (provider list + model cards). "Add to
  runtime" disabled until model card selected.

## Cross-module side effects

- "Set default" or "Add from catalog" updates runtime config hash;
  agents detail Model select re-renders.
- Auth changes affect agents reasoningDefault eligibility (a
  non-reasoning model can't have reasoningDefault=on).

## Out-of-scope for v2 prototype

- Inline fallback-chain reorder UI.
- Bulk-import models via JSON paste.
- Real-time streaming usage tiles.
- Per-model rate-limit override editor.
- Provider-specific advanced settings beyond apiKey/oauth/profile/none.
