## Context

Webhooks already have production code, a hifi spec, and BFF/localstore routes. The new v2 handoff refreshes the product target into a denser operator workspace for outbound event delivery: list health, subscriptions, test delivery, failures, delivery evidence, and guarded CRUD operations in one surface.

The current contract chain is:

1. `frontend-new/src/api.ts` wrappers for `GET/POST/PATCH/DELETE /api/webhooks`, `GET /api/webhooks/{id}/deliveries`, and `POST /api/webhooks/{id}/test`
2. Deck-facing DTOs `DeckGoWebhook`, `DeckGoWebhookDelivery`, `DeckGoWebhooksResponse`, and `DeckGoWebhookDeliveriesResponse`
3. Endpoint classification in `contracts/source/deck-endpoints.contract.json`
4. Go BFF webhook routes in `backend/internal/server/webhooks.go` and controllable admin adapter behavior in `backend/internal/controld/admin.go`
5. `backend/internal/localstore` webhook and delivery persistence
6. Actual outbound HTTP receiver behavior from `deliverWebhook` / `deliverWebhookNow`

## Goals / Non-Goals

**Goals:**

- Align production Webhooks with the fresh v2 handoff where the prototype is backed by the true BFF contract.
- Preserve browser-to-BFF-only access and avoid direct Gateway/localstore access from frontend code.
- Verify inventory, filters, selection, detail tabs, subscriptions, create/edit, delete confirmation, test delivery, delivery history, delivery expansion, empty/error states, and no direct Gateway calls.
- Fix clear Webhooks drift directly, including response envelope mismatches, stale tests, handoff claims for absent retry/live-event routes, and secret-display safety.
- Record capability gaps in `frontend-handoff/modules/webhooks/implementation-notes.md`.

**Non-Goals:**

- Add unapproved routes for `/api/webhooks/{id}/deliveries/{deliveryId}/retry`, `/api/webhooks/stats`, `/api/events/catalog`, audit timelines, WS/SSE live push, or trace spans unless already supported by code truth.
- Add new UI dependencies or persistence layers without explicit approval.
- Claim mock receiver delivery proves production external receiver reliability.
- Implement real platform-event webhook firing beyond current BFF test-delivery behavior.
- Expose raw secret values from read-side DTOs in browser logs or detail payloads.

## Decisions

1. **BFF/localstore truth wins over prototype claims.** The v2 prototype is the visual/product target, but route truth is the current `/api/webhooks*` BFF surface.

2. **Retry and live delivery push are follow-ups unless code proves support.** The handoff mentions retry and WS/SSE delivery push; current endpoint classification lists no retry route and no event catalog/stats endpoint.

3. **Real E2E uses disposable local receivers.** Safe real-stack testing can create a webhook pointing at a test HTTP server, send a test delivery, inspect delivery history, and delete it. External production receivers are not required.

4. **Secret handling stays conservative.** Reads may return redacted/nullable secret evidence; production UI must not imply the raw secret can be recovered after create/update.

5. **Circuit breaker applies to real-stack delivery variation.** If local receiver networking, auth, or environment state blocks a real scenario after bounded attempts, record it as degraded, skipped-safe, empty-valid, or handoff-blocked and continue after static review plus L1 evidence.

## Risks / Trade-offs

- **Prototype includes backend features that may not exist** -> Render as unsupported/degraded and document instead of inventing routes.
- **Webhook test delivery is side-effecting** -> Real E2E must use a disposable local receiver and clean up created webhooks.
- **Current backend response envelopes may differ from handoff examples** -> Fix wrappers/tests around code truth or update BFF only when contract source supports it.
- **Localstore state can leak between tests** -> Use isolated E2E data dirs and generated webhook names.
- **Secret display is security-sensitive** -> Avoid raw secret rendering in detail/raw evidence unless code truth proves it is redacted or write-only safe.
