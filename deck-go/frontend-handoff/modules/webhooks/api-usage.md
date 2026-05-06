# API usage

Source of truth: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/frontend-new/src/api.ts`, `deck-go/backend/internal/server/webhooks.go`, and `deck-go/backend/internal/controld/admin.go`.

Webhooks are a Deck Go BFF/localstore surface. They are not a browser-to-Gateway RPC surface.

## Endpoint table

| Verb     | Path                            | Request               | Response                                                                    |
| -------- | ------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `GET`    | `/api/webhooks`                 | none                  | `DeckGoWebhooksResponse` `{ webhooks: DeckGoWebhook[] }`                    |
| `POST`   | `/api/webhooks`                 | create fields         | `DeckGoWebhook`                                                             |
| `PATCH`  | `/api/webhooks/{id}`            | partial update fields | `DeckGoWebhook`                                                             |
| `DELETE` | `/api/webhooks/{id}`            | none                  | `{ deleted: true }`                                                         |
| `GET`    | `/api/webhooks/{id}/deliveries` | none                  | `DeckGoWebhookDeliveriesResponse` `{ deliveries: DeckGoWebhookDelivery[] }` |
| `POST`   | `/api/webhooks/{id}/test`       | currently no body     | `{ success, statusCode, durationMs, error, deliveryId }`                    |

Not implemented in the current contract chain:

- `POST /api/webhooks/{id}/deliveries/{deliveryId}/retry`
- `GET /api/webhooks/stats`
- `GET /api/events/catalog`
- live `webhook.delivery` WS/SSE push
- audit timeline endpoints

## Frontend wrapper signatures

The active wrappers live in `frontend-new/src/api.ts`.

```typescript
export async function fetchWebhooks(): Promise<DeckGoWebhook[]>;
export async function fetchWebhookDeliveries(webhookId: string): Promise<DeckGoWebhookDelivery[]>;
export async function createWebhook(input: WebhookInput): Promise<DeckGoWebhook>;
export async function updateWebhook(
  id: string,
  patch: Partial<WebhookInput>,
): Promise<DeckGoWebhook>;
export async function deleteWebhook(id: string): Promise<void>;
export async function testWebhook(id: string): Promise<Record<string, unknown>>;
```

There is no production `retryDelivery` wrapper because there is no retry endpoint.

## Mutation envelopes

### Create

```jsonc
{
  "name": "Ops Slack alerts",
  "url": "https://hooks.slack.com/services/...",
  "secret": "optional write-only shared secret",
  "events": ["alert.fired", "approval.pending"],
  "enabled": true,
}
```

### Update

All fields are optional. `events` is a full replacement. The edit modal leaves `secret` blank for existing webhooks; a non-empty value replaces the stored secret.

```jsonc
{
  "name": "Ops alerts",
  "url": "https://hooks.example.test/audit",
  "secret": "new secret value",
  "events": ["alert.fired"],
  "enabled": false,
}
```

### Test delivery

The current BFF sends a fixed `test.ping` event with `{ "test": true }` and returns a synchronous delivery summary. The persisted delivery can be read via `GET /api/webhooks/{id}/deliveries`.

```jsonc
{
  "success": true,
  "statusCode": 200,
  "durationMs": 3,
  "error": null,
  "deliveryId": "wd-123abc",
}
```

## Read-side shapes

### `DeckGoWebhook`

```jsonc
{
  "id": "wh-ops-slack",
  "name": "Ops Slack alerts",
  "url": "https://hooks.slack.com/services/...",
  "secret": "***redacted",
  "events": ["alert.fired", "approval.pending"],
  "enabled": true,
  "consecutiveFailures": 0,
  "lastFiredAt": "2026-05-04T08:14:32Z",
  "lastStatus": 200,
  "createdAt": "2026-03-19T07:00:00Z",
  "updatedAt": "2026-04-27T14:22:11Z",
}
```

`secret` is `null` when no secret is configured and `***redacted` when a secret exists.

### `DeckGoWebhookDelivery`

```jsonc
{
  "id": "wd-001",
  "webhookId": "wh-ops-slack",
  "eventType": "test.ping",
  "payload": "{\"event\":\"test.ping\",\"timestamp\":1777890000,\"data\":{\"test\":true}}",
  "statusCode": 200,
  "responseBody": "{\"ok\":true}",
  "error": null,
  "durationMs": 3,
  "attempt": 0,
  "isRetry": false,
  "parentDeliveryId": null,
  "success": true,
  "nextRetryAt": null,
  "createdAt": "2026-05-04T08:14:32Z",
}
```

## BFF projections

These values are browser projections over fetched DTOs:

| Projection             | Source                                         | Status                              |
| ---------------------- | ---------------------------------------------- | ----------------------------------- |
| Total / enabled KPIs   | `webhooks[]`                                   | supported                           |
| Failing KPI            | enabled webhooks with consecutive failures     | supported                           |
| Success-rate KPI       | selected loaded deliveries                     | degraded when deliveries are empty  |
| Health badge           | `enabled`, `consecutiveFailures`, `lastStatus` | supported                           |
| Last delivery          | selected loaded deliveries                     | supported for selected webhook only |
| Available event chips  | frontend-local list                            | supported as local UI helper        |
| Retry tree             | delivery retry metadata                        | display-only; no retry action       |
| Stats / 24h aggregates | no endpoint                                    | unsupported follow-up               |
| Live delivery push     | no route/event contract                        | unsupported follow-up               |

## Auth and safety

All routes go through the Deck Go BFF and require the configured Deck operator token when auth is enabled. Browser code must not call OpenClaw Gateway or localstore directly.

Receiver URLs must be absolute `http` or `https` URLs with a host. Relative paths and unsupported schemes are rejected by the Go BFF/controld layer.

Secrets are write-only from the operator perspective:

- create/update may send the raw secret
- read/list responses return `***redacted` when a secret exists
- the edit modal starts with an empty secret field and only sends a replacement when the operator enters one
- raw evidence panes sanitize secret values before rendering

## Real-stack verification notes

The bounded L2 test uses a disposable local HTTP receiver, creates a webhook through the BFF, sends a test delivery, verifies persisted delivery history, checks a safe 404 path, deletes the webhook, and asserts the production UI does not make direct browser-side Gateway HTTP/WebSocket calls.

This proves the Deck BFF/localstore/test-delivery chain, not full platform-event dispatch or external receiver reliability.
