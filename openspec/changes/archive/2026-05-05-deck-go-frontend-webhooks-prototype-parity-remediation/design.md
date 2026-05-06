## Context

Webhooks is Deck's outbound event delivery control surface. The current browser
contract chain is:

`WebhooksPanel` -> `frontend-new/src/api.ts` Webhooks wrappers ->
`/api/webhooks*` Deck BFF routes -> Go localstore/controlled webhook
dispatcher.

The Deck-facing DTO authority is `contracts/source/deck-api.contract.ts`.
Webhooks currently exposes receiver CRUD, persisted delivery history, manual
test delivery, read-side secret redaction, and URL validation. The active visual
target is `frontend-handoff/modules/webhooks/prototype.html`. Production
already has a two-pane CRUD workbench, but the head matrix has not verified
strict prototype parity or the strengthened real BFF product-flow evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Webhooks prototype and reconcile it with current Deck BFF,
  DTO, frontend wrapper, and localstore truth.
- Audit production Webhooks code, handoff files, fixtures, and real E2E against
  the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper, or
  documentation drift when supported by code truth.
- Preserve BFF-only browser access for inventory, CRUD, deliveries, and test
  delivery.
- Exercise disposable run-scoped real webhook fixtures through a local HTTP
  receiver and cleanup guard.
- Upgrade mock visual and real BFF E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Webhooks implementation notes, the remediation matrix, and head task
  `6.13`.

**Non-Goals:**

- Do not add retry mutation endpoints.
- Do not add stats, event catalog, audit timeline, or live push endpoints.
- Do not verify real platform event dispatch beyond manual `test.ping`.
- Do not add new dependencies.
- Do not replace the production module wholesale with prototype files.

## Decisions

### D1: Webhooks remains a Deck-local BFF/localstore control surface

The prototype is the visual and interaction reference, but Webhooks contract
truth is not Gateway RPC. Production must use Deck BFF wrappers and must not
call Gateway or localstore directly from browser code.

### D2: Unsupported operational views remain explicit gaps

Retry, stats, event catalog, audit timeline, live push, and real platform
event dispatch are useful product directions, but no verified Deck contract
currently backs them. Production may show them as gap evidence, but archive
evidence must not claim them as supported features.

### D3: Real evidence must create and clean up run-scoped fixtures

Unlike read-only modules, Webhooks has safe disposable BFF mutations. The real
E2E should create one or more run-scoped webhooks against a local HTTP receiver,
send manual test delivery, inspect delivery history, and delete only the
run-scoped fixtures it created.

### D4: Browser transport remains BFF-only

Webhooks browser code may call relative `/api/webhooks*` routes through the
frontend API facade, but it must not call the Gateway port directly.

## Risks / Trade-offs

- **Risk: prototype implies full event-bus delivery.** -> Keep manual
  `test.ping` as the verified contract and record platform-event dispatch as
  skipped-safe.
- **Risk: test receiver availability affects real E2E.** -> Start an isolated
  local HTTP receiver inside the test and record receiver request counts.
- **Risk: cleanup could delete user webhooks.** -> Use helper cleanup that
  deletes only run-scoped fixtures and keep fixture IDs/names in evidence.
- **Risk: local event catalog looks canonical.** -> Keep event chips
  frontend-local until a backend catalog contract exists.

## Migration Plan

1. Audit prototype files, production Webhooks code, contract sources, BFF
   routes, visual spec, and real E2E.
2. Patch deterministic Webhooks UI, i18n, API facade, fixture, or documentation
   drift.
3. Upgrade mock visual E2E to capture receiver inventory, selected detail,
   filters, builder, delete confirmation, test delivery, delivery expansion,
   and all required localized theme variants.
4. Upgrade real BFF E2E to verify route shapes, run-scoped CRUD/test/delete,
   shell navigation, all localized theme variants, safe child interactions,
   BFF-only transport, unexpected-error evidence, and unsupported-gap policy.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Webhooks should expose retry mutation and retry queue management.
- Whether the event catalog should come from the backend/event bus.
- Whether delivery stats and audit timeline should be separate BFF resources.
- Whether live delivery push should use SSE or the existing Deck websocket
  stream.
