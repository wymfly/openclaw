# Webhooks API Usage

## Source Truth

- Deck-facing DTO source: `deck-go/contracts/source/deck-api.contract.ts`
- Generated DTOs: `DeckGoWebhook`, `DeckGoWebhookDelivery`, `DeckGoWebhooksResponse`, `DeckGoWebhookDeliveriesResponse`
- Frontend wrappers: `deck-go/frontend-new/src/api.ts`
- Backend routes: `deck-go/backend/internal/api/http/admin.go`
- Backend adapter: `deck-go/backend/internal/controld/admin.go`
- Storage model: `deck-go/backend/internal/localstore/webhooks.go`

## Read Routes

### `fetchWebhooks()`

- Route: `GET /api/webhooks`
- Response: `{ webhooks: DeckGoWebhook[] }`
- Used for inventory, counts, selected fallback, failure status, and last status.

### `fetchWebhookDeliveries(id)`

- Route: `GET /api/webhooks/{id}/deliveries`
- Response: `{ deliveries: DeckGoWebhookDelivery[] }`
- Used for selected webhook delivery history and raw delivery inspection.

## Mutation Routes

### `createWebhook(input)`

- Route: `POST /api/webhooks`
- Body: `{ name, url, secret?, events, enabled? }`
- Response: `DeckGoWebhook`

### `updateWebhook(id, input)`

- Route: `PATCH /api/webhooks/{id}`
- Body: partial `{ name, url, secret?, events, enabled? }`
- Response: `DeckGoWebhook`

### `deleteWebhook(id)`

- Route: `DELETE /api/webhooks/{id}`
- Response: record-like delete result
- UI must keep guarded confirmation.

### `testWebhook(id)`

- Route: `POST /api/webhooks/{id}/test`
- Response: record-like delivery result
- The test path attempts an actual HTTP request to the configured URL and writes a delivery record.

## Boundaries

- Browser code must not call Gateway or localstore directly.
- The production UI should not fabricate delivery success, response body, retry, or duration fields when the DTO omits them.
- Mock/local visual tests may create webhooks through public Deck routes and may use a local test receiver for deterministic delivery evidence.
