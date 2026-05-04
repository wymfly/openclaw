# Interactions

Keyboard, focus, hover, animations, edge cases. Cross-section coupling — what changes in pane A when pane B mutates.

## Keyboard

| Key                 | Context                                 | Effect                                                                                                |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab` | Anywhere                                | Focus rotates: topbar actions → list filters → list rows → detail tabs → action buttons → tab content |
| `Enter` / `Space`   | A focused webhook row                   | Selects that webhook (same as click); arrow keys do **not** navigate rows in this iteration           |
| `Esc`               | Builder modal (when `phase === "idle"`) | Closes modal, drops draft                                                                             |
| `Esc`               | Delete confirm modal                    | Closes modal, no delete                                                                               |
| `Esc`               | Anywhere else                           | No effect (does **not** clear selection)                                                              |
| `Cmd+K` / `Ctrl+K`  | Reserved for global command palette     | Out of scope this iteration                                                                           |

Modal Esc is gated on `phase === "idle"` so users cannot abandon a save mid-flight.

## Hover & focus styling

- **Webhook row** — `background: --ds-bg-2` on hover; selected row paints with `--ds-accent-bg-soft` and stays painted on hover
- **Filter chip** — color shifts from `--ds-text-muted` to `--ds-text-primary` on hover; on-state has `--ds-bg-1` background and `--ds-accent-bg-soft` count chip
- **Delivery row** — `background: --ds-bg-2` on hover; chevron rotates 90° with 160ms ease when expanded
- **Builder chip** — `background: --ds-bg-3` on hover; on-state paints with `--ds-accent-bg-soft` and `--ds-accent-fg` border + check icon
- **Action buttons** — primary uses `--ds-accent-bg-hover`; ghost uses `--ds-bg-3`; danger uses `--ds-danger-bg-soft`
- **Focus rings** — inputs paint border `--ds-accent-fg` on `:focus`; buttons inherit user-agent focus ring

## Animations

| Element                          | Animation                                                                      | Timing              |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| Modal backdrop                   | fade-in opacity                                                                | `160ms ease-out`    |
| Modal content                    | translateY(8px) → 0, scale 0.98 → 1, opacity 0 → 1                             | `220ms ease-out`    |
| Delivery row chevron             | rotate 0° → 90°                                                                | `160ms`             |
| Test delivery button transitions | idle → running → done/error → idle                                             | sim total ~2.0–2.4s |
| Builder save                     | idle → saving → done → close                                                   | sim total ~1.3s     |
| Countdown chip                   | live tick every 1s; pulse animation if remaining < 15s and tone === "imminent" | smooth              |

## Test delivery flow

1. **idle**: `<IconSend /> Test delivery` button on detail actions row
2. Click → button changes to `Sending…` with `cursor:wait`, disabled
3. After ~920ms (sim) → 85% chance `done`, 15% chance `error`
4. **done** → `<IconCheck /> Delivered`, ok tone, button stays disabled for 1200ms
5. **error** → `<IconAlert /> Test failed`, danger tone, button stays disabled for 1200ms
6. Returns to **idle**

In production, this maps to `POST /api/webhooks/{id}/test` — the response includes the resulting `DeckGoWebhookDelivery` object which should be prepended to the deliveries list optimistically.

**Cross-section coupling**: a successful test delivery should optimistically:

- Update `lastFiredAt` and `lastStatus` on the parent webhook DTO (so the list-row last-fired column refreshes immediately)
- Reset `consecutiveFailures` to 0 (which flips the health badge from `degraded` → `healthy`)
- Prepend the new delivery to the deliveries tab table

A failed test delivery should:

- Update `lastFiredAt` and `lastStatus` (with the failure code)
- Increment `consecutiveFailures` (which may flip the badge from `healthy` → `degraded` → `failing`)

## Builder modal lifecycle

1. Open via "New webhook" topbar btn → `EMPTY_DRAFT` cloned, `isEdit=false`
2. Open via "Edit" detail action → current webhook fields cloned into draft, `isEdit=true`
3. Backdrop click or Esc (only when `phase === "idle"`) → close + drop draft
4. Save flow: phase `idle` → `saving` (700ms sim) → `done` (600ms sim) → modal closes + commit
5. While `saving`: all inputs disabled, save button shows "Saving…", close/cancel disabled

## Event chip multi-select

In the builder, events are grouped by prefix (e.g., `approval.*`, `cron.*`, `channel.*`, `alert.*`). Each group renders a row of chips:

- Click an unselected chip → adds event to `draft.events`, chip flips to on-state with check icon
- Click a selected chip → removes from `draft.events`, chip flips to off-state
- Header shows live count: `Events (3 selected)`
- If `draft.events.length === 0`, save is disabled and inline hint shows `Select at least one event to subscribe to`

## Search interaction

- Search input is uncontrolled-feeling but actually controlled (`onChange` updates `query` state)
- Matches case-insensitively against name, url, id, and **all** subscribed event names
- Empty query → no filter applied
- Filter chips compose: `filter` is applied first, then `query`
- Both controls clear together via no explicit clear button (out of scope this iteration)

## Delete confirm

1. Click "Delete" on actions row → confirm modal opens with webhook name interpolated into copy
2. Modal shows: title `Delete this webhook?`, body `<webhook name> will stop receiving deliveries. This cannot be undone.`
3. Two buttons: "Cancel" (ghost) and "Delete" (danger primary)
4. Confirm → webhook removed from local state; if selected, falls back to next available webhook or null
5. In production, this is `DELETE /api/webhooks/{id}` with optimistic UI

## Delivery row expand

1. Single click anywhere on the delivery row → expand (or collapse if already open)
2. Only one row open at a time — opening a new row collapses the previous one
3. Expanded content shows in a sibling `delivery-expanded` div, indented to align with the event-name column
4. Sections inside expanded:
   - **Payload** — JSON pretty-printed
   - **Response body** — if present (often null on network errors)
   - **Error** — single-line danger-toned text (e.g., `fetch failed: ETIMEDOUT`)
   - **Retry context** — if `nextRetryAt`, live countdown; if `parentDeliveryId`, link to parent
   - **Actions** — manual retry button (only for failed, non-retrying deliveries)

## Cross-section coupling

| Action                   | Affected sections                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Toggle `enabled`         | Hero badge + meta + list-row health badge + topbar enabled count                                                          |
| Test delivery (success)  | Hero meta cells (last fired, failures) + list-row last-fired/last-status/health + deliveries tab                          |
| Test delivery (failure)  | Same as success but failures increments + health may flip                                                                 |
| Save (edit)              | Hero name + url + events + meta cells; list row name + url + events count                                                 |
| Save (create)            | New row prepended to list, automatically selected; topbar webhooks count + (if enabled) deliveries 24h doesn't change yet |
| Delete                   | Row removed from list; selection fallback; topbar counts decrement                                                        |
| Manual retry on delivery | Adds new attempt row to deliveries; updates parent's status if successful                                                 |

## Edge cases

- **Webhook with no secret**: SecretReveal renders `no secret` muted; builder save still allowed (signature header simply omitted)
- **Webhook with all events disabled**: cannot exist — builder validation prevents save with empty events array
- **Disabled webhook clicked Test delivery**: button is enabled regardless of `enabled` flag (test deliveries bypass enable gate); production may differ
- **Delivery with `statusCode: null`**: classified as network error; `StatusCodeBadge` renders `—`; `DeliveryStatusBadge` renders `network`
- **Refresh during running test**: prototype state resets; production should keep request in-flight
- **Two test deliveries fired back-to-back**: button is disabled during phase ≠ idle, so impossible from UI; production should still serialize on backend

## Cross-module coupling (for production)

When a webhook is fired by a **real platform event** (not via test), the firing chain is:

- Platform event hits the event bus (e.g., `alert.fired`)
- Webhook delivery worker resolves matching subscriptions and dispatches HTTP POSTs
- Each delivery writes a `DeckGoWebhookDelivery` row + updates the parent webhook's `lastFiredAt`, `lastStatus`, `consecutiveFailures`
- Frontend receives a WS push (if backend supports `webhook.delivery` event) or polls — see `api-usage.md`

This coupling means the panel cannot assume static data even between manual interactions; always re-fetch on tab focus or use SSE/WS.
