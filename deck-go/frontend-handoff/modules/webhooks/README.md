# Webhooks

**Status**: implemented-awaiting-archive
**Design completed**: 2026-05-03
**Designer**: Codex single-agent replacement workflow
**Depends on atoms**: Button, Input, Toggle/Checkbox, Badge/Pill, Card, Code/Json detail, Status, Spinner
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

Webhooks is the Automate workspace for receiver configuration and delivery evidence. It lets an operator inspect configured endpoints, subscribed events, failure state, last delivery status, delivery history, and run a manual test delivery.

This package is a high-fidelity handoff for `deck-go/frontend-new/src/components/panels/webhooks/`. It is based on the current deck-go contract chain and production behavior. Code and contracts remain the source of truth; this prototype is an implementation guide.

## Contract truth

- Frontend wrappers: `fetchWebhooks`, `fetchWebhookDeliveries`, `createWebhook`, `updateWebhook`, `deleteWebhook`, and `testWebhook`.
- BFF endpoints: `GET /api/webhooks`, `POST /api/webhooks`, `PATCH /api/webhooks/{id}`, `DELETE /api/webhooks/{id}`, `GET /api/webhooks/{id}/deliveries`, and `POST /api/webhooks/{id}/test`.
- Backend source: Go admin routes -> `webhookAdapter` -> `localstore.Webhook` and `localstore.WebhookDelivery`.
- DTO authority: `DeckGoWebhook`, `DeckGoWebhookDelivery`, `DeckGoWebhooksResponse`, and `DeckGoWebhookDeliveriesResponse`.
- Browser code must continue to call the Go BFF wrappers only; it must not call Gateway or localstore directly.

## How to implement

1. Open `prototype.html` and inspect the receiver workbench layout, inventory, selected receiver detail, event controls, delivery history, form, and last action detail.
2. Read `components.md` for module-local component structure and data boundaries.
3. Read `states.md` for loading, ready, empty, error, selected-webhook, form, delivery, delete, and test-delivery states.
4. Read `interactions.md` for selection, event toggles, create/edit, test delivery, refresh, and guarded delete behavior.
5. Read `api-usage.md` and preserve the current BFF path and mutation envelopes.
6. Read `implementation-notes.md` for the production migration notes and verified mock/local visual coverage.

## Open questions for implementation

- Mock visual E2E should seed data through the normal Deck routes. If a delivery success state is needed, use a temporary local receiver inside the test rather than adding production-only seed code.
- Real external receiver availability, retry behavior, and signature validation are not fully proven by mock/local visual tests.
- A full event schema explorer, retry policy editor, or delivery replay queue is out of scope for this pass.
