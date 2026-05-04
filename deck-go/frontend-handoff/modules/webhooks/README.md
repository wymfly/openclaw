# Webhooks

**Status**: ready-for-implementation
**Design completed**: 2026-05-04
**Designer**: design agent (multi-file React rebuild — v2)
**Depends on atoms**: Button, Input, Toggle, Badge, Tag, Code, StatusPill, Spinner, ConfirmDialog
**New atoms needed**: none (all local molecules — see components.md)
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

The Webhooks panel is the deck-go automation surface for **outbound event delivery**. Operators register HTTP receivers (Slack, PagerDuty, GitHub, internal QA bridges, monitoring backends), subscribe each one to a curated set of event types, and watch live evidence of every delivery — successful, failed, or retried — without leaving the deck.

The panel must answer four operator questions in a single glance:

1. **Are my receivers healthy?** — health badge per row, top-bar "failing" KPI cell, consecutive-failure counter
2. **What did my last delivery do?** — last-fired relative time + last HTTP status code per row
3. **Why did this delivery fail?** — click any delivery → expand to payload, response body, error string, retry tree
4. **Can I get this thing working without leaving the deck?** — Test delivery button right next to Edit/Disable/Delete, with idle → running → done/error inline phases

Layout is the **2-pane CRUD workspace** (matches cron US-017): filterable list on the left (~620px), tabbed detail on the right; topbar carries 4 KPI cells; create/edit goes through a modal builder; delete is a confirm dialog.

## Contract truth

- BFF endpoints: `GET /api/webhooks`, `POST /api/webhooks`, `PATCH /api/webhooks/{id}`, `DELETE /api/webhooks/{id}`, `GET /api/webhooks/{id}/deliveries`, `POST /api/webhooks/{id}/test`
- DTO authority: `DeckGoWebhook`, `DeckGoWebhookDelivery`, `DeckGoWebhooksResponse`, `DeckGoWebhookDeliveriesResponse`
- BFF projections (frontend-only state, **not** in DTO): KPI strip aggregates, available-event catalog, retry tree (parent/child grouping)
- Browser code must call the Go BFF wrappers only — never reach into Gateway or localstore directly

## How to implement

1. Open `prototype.html` (Babel-standalone). Try the 4 row filters, click 4 different webhook types (healthy / degraded / failing / disabled), expand a delivery row to see payload + response, click "Test delivery" to see the running/done phases, click "New webhook" to walk the builder modal, click "Delete" to see the confirm pattern.
2. Read `components.md` — component tree, props contract, local molecules (StatusCodeBadge, DeliveryStatusBadge, WebhookHealthBadge, EnabledToggle, EventTag, SecretReveal, CountdownTimer)
3. Read `states.md` — loading / ready / empty / selected / test-running / test-error / saving / saved / deleting / retry-pending state machines
4. Read `interactions.md` — keyboard, modal lifecycle (backdrop+Esc), test-delivery phase ladder, delete confirm pattern, delivery row expand, retry button, search-events query
5. Read `api-usage.md` — endpoint table + mutation envelopes + WS/SSE contract for live `webhook.delivery` event
6. Hardcoded literal strings come straight out of the prototype; once translated, lift them into `frontend-new/src/i18n/{en,zh}.json` per the prototype-string convention
7. CountdownTimer reused from approvals US-016 + cron US-017; SecretReveal new but minimal — both promotion candidates documented in `implementation-notes.md`

## Open questions for implementation

- **Live `webhook.delivery` event over WS** — is the Go backend pushing per-delivery events, or does the frontend poll `/api/webhooks/{id}/deliveries`? Current prototype assumes ad-hoc refresh; `api-usage.md` calls out the WS contract that would unlock real-time updates if the backend supports it.
- **Retry queue visibility** — `nextRetryAt` lives on the failed delivery DTO. Is there a separate retry queue surface, or do we render upcoming retries inline on the row that triggered them? Prototype goes inline.
- **Signature header** — prototype assumes the secret produces an `X-Deck-Signature` HMAC-SHA256. If the actual header name differs, surface that in `implementation-notes.md` (it shows up in builder hint copy + audit timeline).
- **Available event types** — prototype lists 19 hardcoded events (`approval.*`, `cron.*`, `channel.*`, etc). The real catalog should come from a backend introspection endpoint (`GET /api/events/catalog` or similar). Until that exists, hardcode and flag in `api-discrepancy.md`.
