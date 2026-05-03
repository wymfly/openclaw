## Context

`frontend-new` already contains a functional `WebhooksPanel` under the `webhooks` panel id. It calls Deck-facing wrappers for webhook inventory and operations:

- `fetchWebhooks()` -> `GET /api/webhooks`
- `fetchWebhookDeliveries(id)` -> `GET /api/webhooks/{id}/deliveries`
- `createWebhook`, `updateWebhook`, `deleteWebhook`, and `testWebhook` -> admin/BFF mutation routes under `/api/webhooks`

The Go BFF routes are served by the `webhookAdapter` over localstore-backed webhook and delivery records. This module is not a browser-to-Gateway RPC surface. Deck-facing DTO authority is `DeckGoWebhook`, `DeckGoWebhookDelivery`, `DeckGoWebhooksResponse`, and `DeckGoWebhookDeliveriesResponse`.

The current panel covers inventory, selected webhook detail, create/update, test delivery, delete confirmation, delivery history, and raw payload details. The main gap is visual convergence: it still uses global `deck-ui-webhooks*` styling in `theme.css`, has a dense card-inherited layout, and does not yet have focused mock visual E2E seeded through the real BFF/localstore route.

## Goals / Non-Goals

**Goals:**

- Produce a complete Webhooks handoff package.
- Rewrite Webhooks into a high-fidelity receiver operations workbench aligned with the current design-system posture.
- Preserve load/error handling, selection fallback, create/update/test/delete behavior, guarded delete confirmation, delivery-history loading, and current BFF wrapper usage.
- Add focused mock visual coverage by seeding webhook data through the normal backend route and, where useful, using a temporary receiver for test-delivery evidence.
- Record Webhooks-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, real upstream protocol change, or browser-side direct Gateway call.
- No webhook retry policy redesign, signature policy redesign, receiver health daemon, delivery replay engine, or event schema registry.
- No new dependencies, table libraries, date libraries, or chart libraries.
- No canonical design-system atom/pattern promotion inside this module change.
- No guarantee that real external receiver behavior is fully covered; mock visual coverage may use a local receiver and is not full production delivery assurance.

## Decisions

1. **Treat Webhooks as a receiver operations workbench, not an event schema builder.**
   The panel should expose configured receivers, delivery evidence, selected receiver configuration, and existing action controls. Event schema authoring or retry policy design would expand product scope and belongs in a separate proposal.

2. **Preserve the admin/BFF/localstore contract boundary.**
   The frontend already respects the browser/backend boundary. The rewrite should keep the same wrapper calls and not introduce direct Gateway RPC or localstore access from browser code.

3. **Use module-local receiver/delivery molecules.**
   Inventory rows, status tiles, delivery rows, event subscription chips, receiver form sections, and raw action detail overlap with prior workbench patterns, but Webhooks adds receiver and delivery semantics. Promotion to design-system patterns waits for a separate proposal.

4. **Seed mock visual E2E through public Deck routes.**
   Unlike Gateway-backed panels, Webhooks can be seeded through `POST /api/webhooks` in the E2E setup. A local HTTP receiver can be used for deterministic `testWebhook` delivery evidence without mutating production code.

5. **Keep raw payload evidence visible but secondary.**
   Selected webhook payload, delivery payload, and last action results stay inspectable through `JsonDetails`, while the primary viewport prioritizes receiver status, event coverage, failure state, and delivery evidence.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses create/update/test/delete behavior.** -> Keep focused unit tests for load/select/create/update/test/delete/confirm behavior and add visual E2E for ready plus interaction states.
- **Risk: E2E seed data bypasses realistic receiver failure behavior.** -> Seed via normal BFF routes and use a local receiver for deterministic delivery; label evidence as mock/local visual coverage.
- **Risk: Event subscription controls become too dense.** -> Use compact chip/button groups with stable wrapping; do not add a full event schema explorer.
- **Risk: Global CSS cleanup affects adjacent Automate panels.** -> Remove only `deck-ui-webhooks*` styling from `theme.css`; leave `approvals` and `skills` shared group rules intact until their own module passes.
