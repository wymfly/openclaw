# channels — interactions

## Pointer

- Click an inventory row → enter detail view, set selected channel,
  reset `activeTab` to `overview`.
- Click "Refresh" → re-fetch channel inventory; preserve selected
  channel id when present in the new list.
- Click "New channel" → open `CreateChannelDialog` (3-step wizard).
- Click "Test channel" (detail hero or probe tab) → open
  `TestResultDialog` with the last probe; engineering-time wires this
  to `POST /channels/{id}/test`.
- Click "Logout" → open `LogoutDialog`; confirmation calls
  `POST /channels/{id}/logout` and refreshes status.
- Click a tab → switch active tab; URL/state updates.
- Click a throughput-window button (1h/6h/24h) → re-fetch
  `GET /channels/{id}/throughput?window=…`.
- Click "Save settings" (settings tab) → submit `PATCH /channels/{id}`
  with merged config + `baseHash` from snapshot.
- Click "Add binding" (routing tab) → opens routing add flow (v3 stub).
- Click a WeCom toggle → marks the wecom card local-dirty; "Save" submits
  the per-account access patch.
- Click outside a modal backdrop → close the modal.

## Keyboard

| Key                              | Action                                                  |
| -------------------------------- | ------------------------------------------------------- |
| `Enter` / `Space` on focused row | Enter detail view for that channel.                     |
| `Esc` in detail (no modal open)  | Return to list view.                                    |
| `Esc` in any modal               | Close the modal.                                        |
| `⌘N` / `Ctrl+N` (any view)       | Open `CreateChannelDialog`.                             |
| `⌘K` / `Ctrl+K` (list view)      | Focus the search input.                                 |
| `Tab`                            | Iterate rows, then KPI strip, then toolbar (DOM order). |
| Arrow keys on filter buttons     | Roving focus across filter pills.                       |

All inventory rows are real `<div role="button" tabIndex={0}>` (with
`onKeyDown` handling). All form controls keep native semantics.

## Hover

- Rows: subtle `--ds-bg-1` hover background; selected row keeps darker
  `--ds-bg-2`.
- Buttons: 120ms ease background + border-color transition.
- Throughput bars: 0.8 opacity on hover; tooltip via `title=` shows
  `time · in / out`.
- Tabs: text fades from `--ds-text-3` to `--ds-text-1`.

## Empty / error / loading

- Inventory: a single centered block per state, never inline within
  the row container.
- Detail body: tab body shows the relevant block; hero stays so the
  operator never loses channel context.
- Probe: explicit "Channel disabled — no probe runs" copy when probe
  is null because the channel is disabled.
- Settings: validation errors live under the offending field; the form
  doesn't break on a single bad input.

## Accessibility

- Root has `data-testid="channels-panel"` for E2E selectors.
- Throughput chart: `role="img"` with `aria-label` carrying the numeric
  totals (color is not the only signal).
- Status pills always include a textual label (`healthy`, `degraded`,
  `disabled`, `${latency}ms`, etc.); color is decoration.
- Destructive buttons (`Logout`) carry an explicit text label and a
  confirmation gate; never rely on icon-only.
- Toggle controls expose their state in text (`enabled` / `disabled`,
  `on` / `off`), not only via the visual switch.
- Modals: focus is trapped inside the modal while open; `Esc` closes;
  the trigger element receives focus on close.
- Tabs: `role="tablist"` + `aria-selected`. Tab body is implicit
  `role="tabpanel"` (engineering should add explicit `role` + `id`/
  `aria-labelledby` ties).

## Pointer + keyboard parity

Every action that's clickable is also keyboard-operable:

- Filter pills are buttons.
- Inventory rows respond to Enter/Space.
- Tabs respond to Enter/Space.
- Toggles respond to Space.
- Modal close is via the explicit close button + `Esc`.

## Long content

- Channel detail labels truncate via `text-overflow: ellipsis` in the
  row; hover/long-press shows the full label via `title=`.
- Account ids and config hashes use monospace font so byte-length is
  consistent.
- Throughput window may have many buckets — chart bars `flex: 1` so
  width is always content-bounded.
- Routing bindings list scrolls vertically; each binding row is a
  fixed-shape grid (no nested scroll).

## Dialogs

- `TestResultDialog` is informational; only "Done" closes it.
- `LogoutDialog` is destructive; primary action is right-aligned and
  styled `btn--danger`.
- `CreateChannelDialog` is a 3-step wizard:
  1. Provider pick (radio rows)
  2. Account id + enable toggle (form)
  3. Review (read-only summary)
     Step indicators show progress. "Continue" is disabled when step 2's
     account id is empty.

## Cross-channel side effects

- Logout success refreshes channel status (and clears probe locally).
- Settings save success increments `baseHash`; the next save uses the
  new hash.
- Routing changes invalidate `routing[channel].configHash`; the
  routing tab refetches.

## Out-of-scope for v2 prototype

(Documented for the engineering side to handle / for v3 design pass.)

- Bulk channel actions.
- Inventory column sort UI (currently insertion-ordered by
  `channelOrder`).
- Real account mutations (DM policy editor, account-level enable).
- Routing add-binding inline drawer (currently a CTA stub).
- Per-account WeCom save (currently shows state, save action stubbed).
- Probe history list (currently last-result only).
