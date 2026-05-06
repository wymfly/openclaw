## Why

The Chat module is the primary Deck control surface and already has the richest
implementation, but the remediation matrix still records only mock-functional
evidence and no strict prototype parity verdict. Under the strengthened head
standard, Chat must prove its reverse-derived handoff prototype and production
workbench are aligned where current deck-go contracts support them, and must
verify real Gateway behavior with fixture-backed product-flow evidence.

Chat is also the module where Gateway sessions, streaming, approvals, canvas,
attachments, command discovery, and compaction meet. This change keeps Gateway
truth and Deck product contracts explicit while tightening mock visual and real
E2E coverage.

## What Changes

- Reconcile the active Chat prototype at
  `deck-go/frontend-handoff/modules/chat/prototype.html` with current contract
  truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-streams.contract.json`;
  - `frontend-handoff/modules/chat/api-usage.md`;
  - Go BFF Chat/session/stream/canvas routes and frontend chat API wrappers.
- Treat the handoff prototype as reverse-derived from production engineering,
  not as a replacement template. Production code and contracts remain code
  truth when prototype details conflict with real Gateway behavior.
- Audit current `frontend-new` Chat implementation against the handoff
  workbench, fixing deterministic visual, interaction, i18n, fixture, route, or
  API drift when deck-go contract truth supports it.
- Preserve supported product capabilities:
  - session list, create, delete, reset, clear, patch, preview, snapshot, and
    history;
  - message send, steer, abort, command discovery, compaction, projection, media
    download, canvas bridge, approval prompt handling, and SSE subscriptions;
  - transcript block rendering, composer controls, sidebar navigation, right
    drawer, artifact/canvas surfaces, search, block filters, and keyboard flows.
- Keep unsupported or deferred projections explicit:
  - exact upstream SSE replay guarantees that are not fully observable in the
    current real stack;
  - durable canvas/a2ui shape typing gaps;
  - approval expiration or always-approve side effects when no safe disposable
    approval fixture exists;
  - destructive session mutations unless scoped to a run-created session.
- Strengthen mock visual evidence with prototype/current screenshots, rich and
  empty states, keyboard walkthrough, composer/dialog/right-panel states,
  localized theme variants, and a structured pass or accepted-exception verdict.
- Strengthen real Gateway E2E with run-scoped session creation through the Deck
  BFF/Gateway chain, route-shape checks, Chat shell navigation, dark/English,
  dark/Chinese, light/English, and light/Chinese variants, safe child-surface
  interactions, BFF-only browser transport checks, unexpected error checks, and
  cleanup guards for only run-scoped sessions.
- Update Chat implementation notes, the remediation matrix, and head task `6.3`
  after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-chat-prototype-parity-remediation`: Defines Chat-specific prototype
  parity remediation, product-contract calibration, real fixture policy,
  accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Chat row verdict and evidence
  status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/chat/`;
  - `deck-go/frontend-new/src/stores/chat*.ts` only if deterministic state drift
    is discovered;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/test/e2e/chat-visual.spec.ts`;
  - `deck-go/test/e2e/chat-real-gateway.spec.ts`;
  - `deck-go/test/e2e/real-gateway.spec.ts` only if shared real smoke needs a
    focused extraction;
  - `deck-go/test/e2e/helpers.ts` only if deterministic run-scoped fixture or
    evidence helpers require focused repair.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or contract drift found
    during verification may be fixed in this child when current deck-go truth
    supports the fix.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/chat/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.3`.
