## Why

The Webhooks module has an active v2 handoff prototype and an existing
`frontend-new` implementation, but the head remediation matrix still classifies
it as mock-functional with prototype parity unreviewed. Existing evidence
proves basic BFF/localstore CRUD, test delivery, and delivery-history behavior,
yet it predates the strengthened head standard: prototype-current visual
parity, Deck shell navigation from another module, all four theme/locale
variants, safe child-surface interaction, representative real route evidence,
BFF-only browser transport, unexpected-error checks, run-scoped real fixture
creation, cleanup safety, and structured accepted exceptions.

Webhooks is Deck's outbound event delivery control surface. It is not an
OpenClaw Gateway RPC surface; the current contract truth is Deck Go BFF plus
localstore: `/api/webhooks`, `/api/webhooks/{id}`, deliveries, and test
delivery. The active prototype includes useful product ideas such as receiver
health, filters, selected detail, builder modal, guarded delete, delivery
expansion, retry/audit/stats/live-push areas, and event catalog chips. Current
Deck truth supports CRUD, manual `test.ping`, delivery history, read-side
secret redaction, URL validation, local filtering, and explicit gap display.
It does not support retry mutation, global stats, backend event catalog, audit
timeline, live push, or real platform event dispatch.

## What Changes

- Reconcile the active Webhooks prototype at
  `deck-go/frontend-handoff/modules/webhooks/prototype.html` with contract truth
  from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `frontend-handoff/modules/webhooks/api-usage.md`;
  - Go BFF/localstore routes and frontend Webhooks API wrappers.
- Audit the current `frontend-new` Webhooks implementation against the active
  receiver workbench prototype, fixing deterministic visual, interaction, i18n,
  fixture, route-wrapper, or documentation drift when code truth supports it.
- Preserve supported product capabilities:
  - receiver inventory and local filters/search;
  - selected receiver overview, deliveries, settings, and gaps tabs;
  - create/edit/delete through guarded BFF mutations;
  - manual test delivery and persisted delivery history;
  - delivery row expansion, payload/response/error evidence, redacted secrets,
    and absolute HTTP(S) URL validation.
- Preserve unsupported prototype assumptions as explicit exceptions:
  - retry mutation;
  - global stats route;
  - backend event catalog;
  - audit timeline;
  - live `webhook.delivery` push;
  - real platform-event dispatch beyond manual `test.ping`.
- Strengthen mock visual evidence with prototype-shaped seeded receivers,
  selected detail, builder, delete confirmation, test delivery, delivery
  expansion, localized theme variants, and accepted exceptions.
- Strengthen real BFF E2E with disposable run-scoped receiver creation,
  CRUD/test/delivery/delete cleanup, Chat -> Webhooks shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, BFF-only browser transport
  checks, unexpected-error checks, and skipped-safe unsupported follow-ups.
- Update Webhooks implementation notes, the remediation matrix, and head task
  `6.13` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-webhooks-prototype-parity-remediation`: Defines Webhooks-specific
  prototype parity remediation, contract-truth calibration, real evidence
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Webhooks row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/webhooks/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/webhooks/WebhooksPanel.test.tsx`;
  - `deck-go/test/e2e/webhooks-visual.spec.ts`;
  - `deck-go/test/e2e/webhooks-real-gateway.spec.ts`.
- Backend/contracts:
  - no intended DTO expansion;
  - retry, stats, event catalog, audit timeline, live push, and platform-event
    dispatch remain deferred until Deck contracts exist.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/webhooks/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.13`.
