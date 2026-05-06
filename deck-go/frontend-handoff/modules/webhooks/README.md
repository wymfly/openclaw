# Webhooks

**Status**: implemented-real-contract
**Design completed**: 2026-05-04
**Designer**: design agent (multi-file React rebuild - v2)
**Depends on atoms**: Button, Input, Toggle, Badge, Tag, Code, StatusPill, Spinner, ConfirmDialog
**New atoms needed**: none (all local molecules - see components.md)
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

The Webhooks panel is the deck-go automation surface for outbound event delivery. Operators register HTTP receivers, subscribe each receiver to event types, run safe test deliveries, and inspect localstore-backed delivery evidence without leaving the deck.

The production implementation follows the v2 two-pane CRUD workspace where the current BFF contract supports it:

1. Are my receivers healthy? Health badge per row, failing KPI, consecutive-failure counter.
2. What did the last delivery do? Last-fired evidence, last HTTP status, delivery history.
3. Why did this delivery fail? Expand a delivery to inspect payload, response body, error string, and retry metadata when present.
4. Can I repair it quickly? Test delivery, edit, disable, and delete actions are beside selected receiver evidence.

Layout is a two-pane workbench: filterable receiver inventory on the left, tabbed selected detail on the right, topbar KPIs, modal create/edit builder, and guarded delete confirmation.

## Contract truth

- BFF endpoints: `GET /api/webhooks`, `POST /api/webhooks`, `PATCH /api/webhooks/{id}`, `DELETE /api/webhooks/{id}`, `GET /api/webhooks/{id}/deliveries`, `POST /api/webhooks/{id}/test`
- DTO authority: `DeckGoWebhook`, `DeckGoWebhookDelivery`, `DeckGoWebhooksResponse`, `DeckGoWebhookDeliveriesResponse`
- BFF projections: KPI strip aggregates, local available-event chips, delivery row expansion, unsupported-gap copy
- Browser code must call Go BFF wrappers only. It must never reach into Gateway or localstore directly.
- Current backend does not expose delivery retry, stats, event catalog, audit timeline, or live webhook-delivery push routes. Production renders those as unsupported gaps instead of active controls.
- Code truth wins over this handoff package if drift is found later.

## How to implement

1. Open `prototype.html` and review the row filters, receiver selection, delivery expansion, test delivery phases, builder modal, and delete confirmation.
2. Read `components.md` for component structure and local molecule intent.
3. Read `states.md` for loading, empty, selected, test-running, test-error, saving, deleting, and delivery-row states.
4. Read `interactions.md` for keyboard, modal lifecycle, test-delivery sequence, delete confirmation, row expansion, and search behavior.
5. Read `api-usage.md` for endpoint table, mutation envelopes, redacted secret behavior, and unsupported follow-up routes. Treat code truth as authoritative.
6. Hardcoded strings should be lifted into `frontend-new/src/i18n/{en,zh}.json` when productionized.
7. Secret values are read-side redacted and edit forms keep the secret blank unless the operator intentionally replaces it.

## Open questions / follow-ups

- Live `webhook.delivery` event over WS: not present in current endpoint classification or Go BFF route truth.
- Retry queue visibility: delivery DTO has retry metadata fields, but no retry mutation route exists.
- Signature header: Go BFF signs outbound deliveries as `X-Signature-256: sha256=<hmac>` when a secret is configured.
- Available event types: production uses a bounded frontend-local list. A backend event catalog requires a separate contract proposal.
