# API usage

Endpoints, payloads, projection notes. Source of truth: `deck-go/contracts/source/deck-api.contract.ts` (`DeckGoWebhook` / `DeckGoWebhookDelivery` / `DeckGoWebhooksResponse` / `DeckGoWebhookDeliveriesResponse`).

## Endpoint table

| Verb     | Path                                               | Request                                                 | Response                                                                        |
| -------- | -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET`    | `/api/webhooks`                                    | —                                                       | `DeckGoWebhooksResponse`                                                        |
| `POST`   | `/api/webhooks`                                    | `DeckGoWebhookCreateRequest`                            | `{ webhook: DeckGoWebhook }`                                                    |
| `PATCH`  | `/api/webhooks/{id}`                               | `DeckGoWebhookUpdateRequest`                            | `{ webhook: DeckGoWebhook }`                                                    |
| `DELETE` | `/api/webhooks/{id}`                               | —                                                       | `{ ok: true }`                                                                  |
| `GET`    | `/api/webhooks/{id}/deliveries?limit=N`            | —                                                       | `DeckGoWebhookDeliveriesResponse`                                               |
| `POST`   | `/api/webhooks/{id}/test`                          | `{ eventType?: string, payload?: Record<string, any> }` | `{ delivery: DeckGoWebhookDelivery }`                                           |
| `POST`   | `/api/webhooks/{id}/deliveries/{deliveryId}/retry` | —                                                       | `{ delivery: DeckGoWebhookDelivery }` (new attempt with `parentDeliveryId` set) |

## Frontend wrapper signatures

```typescript
// frontend-new/src/api/webhooks.ts
export async function fetchWebhooks(): Promise<DeckGoWebhook[]>;
export async function fetchWebhookDeliveries(
  webhookId: string,
  limit?: number,
): Promise<DeckGoWebhookDelivery[]>;
export async function createWebhook(input: WebhookInput): Promise<DeckGoWebhook>;
export async function updateWebhook(
  id: string,
  patch: Partial<WebhookInput>,
): Promise<DeckGoWebhook>;
export async function deleteWebhook(id: string): Promise<void>;
export async function testWebhook(
  id: string,
  payload?: TestPayload,
): Promise<DeckGoWebhookDelivery>;
export async function retryDelivery(
  webhookId: string,
  deliveryId: string,
): Promise<DeckGoWebhookDelivery>;
```

## Payload envelopes

### `DeckGoWebhookCreateRequest`

```jsonc
{
  "name": "Ops Slack alerts",
  "url": "https://hooks.slack.com/services/T01.../B02.../zZz",
  "secret": "<optional shared secret string>",
  "events": ["alert.fired", "alert.cleared", "approval.pending"],
  "enabled": true,
}
```

### `DeckGoWebhookUpdateRequest`

All fields optional — only provided fields are patched.

```jsonc
{
  "name": "...",
  "url": "...",
  "secret": "...", // null to clear
  "events": ["..."], // full replacement, not delta
  "enabled": true,
}
```

### `DeckGoWebhook` (response shape)

```jsonc
{
  "id": "wh-ops-slack",
  "name": "Ops Slack alerts",
  "url": "https://hooks.slack.com/services/...",
  "secret": "***ops-slack-redacted", // redacted on read; real value sent only on create/update
  "events": ["alert.fired", "alert.cleared"],
  "enabled": true,
  "consecutiveFailures": 0,
  "lastFiredAt": "2026-05-04T08:14:32.103Z",
  "lastStatus": 200,
  "createdAt": "2026-03-19T07:00:00.000Z",
  "updatedAt": "2026-04-27T14:22:11.000Z",
}
```

### `DeckGoWebhookDelivery`

```jsonc
{
  "id": "dlv-001",
  "webhookId": "wh-ops-slack",
  "eventType": "alert.fired",
  "payload": "{\"event\":\"alert.fired\",\"ts\":1714824472103,...}", // serialized JSON
  "statusCode": 200, // null on network errors
  "responseBody": "{\"ok\":true}", // null when no body / network error
  "error": null, // string on failure
  "durationMs": 245,
  "attempt": 1,
  "isRetry": false,
  "parentDeliveryId": null, // the dlv id this is a retry of
  "success": true,
  "nextRetryAt": null, // ISO string when scheduled
  "createdAt": "2026-05-04T08:14:32.103Z",
}
```

## Mutation envelopes

### Test delivery

```jsonc
// Request
POST /api/webhooks/{id}/test
{
  "eventType": "alert.fired",            // optional; defaults to first subscribed event
  "payload": { "test": true }            // optional override; backend wraps in event envelope
}

// Response — synchronous, includes the actual HTTP attempt result
{
  "delivery": { /* DeckGoWebhookDelivery, with success/statusCode/durationMs */ }
}
```

### Manual retry

```jsonc
POST /api/webhooks/{id}/deliveries/{deliveryId}/retry

// Response — the new attempt
{
  "delivery": {
    "id": "dlv-007",
    "isRetry": true,
    "attempt": 2,
    "parentDeliveryId": "dlv-006",
    /* ...same shape as DeckGoWebhookDelivery... */
  }
}
```

## Live event push (recommended)

If the Go backend pushes per-delivery WS events, subscribe on panel mount:

```jsonc
// Server → client over the existing Deck WS connection
{
  "type": "webhook.delivery",
  "data": {
    /* DeckGoWebhookDelivery */
  },
}
```

The frontend handler:

1. If `data.webhookId` matches the currently selected webhook → prepend to deliveries list
2. Update parent webhook's `lastFiredAt` / `lastStatus` / `consecutiveFailures` (success resets to 0; failure increments)
3. Re-render health badge if the failure count crossed a threshold

If the backend does **not** push, fall back to:

- Refresh deliveries on tab focus
- Refresh deliveries every 15s while the deliveries tab is mounted
- Document the gap in `api-discrepancy.md`

## BFF projections (frontend-only state)

These are **not** in the DTO and must be computed in the BFF or browser:

| Projection                              | Source                                                             | Where computed                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Topbar `total` count                    | `webhooks.length`                                                  | Browser (cheap)                                                                                 |
| Topbar `enabled` count                  | `webhooks.filter(w => w.enabled).length`                           | Browser                                                                                         |
| Topbar `failing` count                  | `webhooks.filter(w => w.consecutiveFailures >= 3).length`          | Browser                                                                                         |
| Topbar `deliveries24h`                  | aggregate over last-24h deliveries                                 | **BFF** — `/api/webhooks/stats?window=24h` (proposed)                                           |
| Topbar `successRate24h`                 | `success/total` over last-24h                                      | **BFF**                                                                                         |
| Topbar `avgDurationMs`                  | p50 over last-24h                                                  | **BFF**                                                                                         |
| `WebhookHealthBadge` tone               | derived from `enabled` + `consecutiveFailures`                     | Browser                                                                                         |
| Last delivery per webhook (in list row) | reduce over deliveries by `webhookId`                              | Browser (with current data shape — could also be a server-side `lastDelivery` field on the DTO) |
| Available event catalog                 | hardcoded list of 19 events for now                                | **TODO** — `/api/events/catalog` (does not exist yet, see `api-discrepancy.md`)                 |
| Audit timeline                          | aggregated lifecycle events (created/updated/disabled/test/delete) | **BFF** — currently rendered from prototype-only synthetic data                                 |

## Filter / query (client-side)

Filtering and search are pure client-side (no server round-trip). The API does not support `?filter=enabled` or `?q=slack` — fetch all webhooks once, filter locally. Acceptable because webhook count is bounded (≤ low-hundreds in practice).

## Cache + invalidation

- `webhooks` list — stale-while-revalidate, 30s
- `deliveries` per webhook — refetch on tab mount + every 15s while visible (or replace with WS push if available)
- After mutation (create/update/delete/test/retry) — invalidate both caches for the affected id

## Auth + scope

All endpoints require Deck operator scope. Webhook secrets are write-only on the wire (creates/updates send the real secret; reads return a redacted placeholder like `***name-redacted`). Browser code must never log secret values, even when revealed in `<SecretReveal>`.

## Error handling

| Backend error             | Frontend surface                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `400` `validation_failed` | Inline field error in builder; modal stays open                                              |
| `404` webhook not found   | Drop selection, fall back to first row, toast `Webhook not found — it may have been deleted` |
| `409` duplicate URL       | Inline error on URL field: `A webhook with this URL already exists`                          |
| `429` rate limit          | Toast: `Too many requests — try again in a moment`; button stays disabled briefly            |
| `5xx` server              | Toast: `Couldn't save webhook — server error`; modal stays open                              |
| Network failure           | Same as 5xx; preserve draft                                                                  |

## Contract drift gates

Every change to `DeckGoWebhook` / `DeckGoWebhookDelivery` MUST run `cd deck-go && make contract-gate` before merge. New event types in the catalog do not require a contract bump (the `events` field is `string[]`), but the catalog endpoint, when it lands, will need its own DTO.
