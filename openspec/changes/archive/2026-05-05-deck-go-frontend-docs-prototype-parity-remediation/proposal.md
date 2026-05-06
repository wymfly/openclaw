## Why

The Docs module has an active v2 high-fidelity handoff prototype and a
production `frontend-new` implementation, but the remediation head matrix still
classifies it as mock-functional only and parity-unreviewed. Under the
strengthened head standard, Docs must prove that the production panel matches
the active prototype product flow and that its real Gateway/BFF evidence covers
the operator workflow, not just route-shape smoke.

Docs is also a useful sample for Gateway-derived product design because it is
not a raw Gateway RPC mirror. The BFF extracts durable reader artifacts from
real chat history and exposes a product-level docs registry contract. This child
proposal must keep that product contract clear while validating safe run-scoped
real data creation, deletion cleanup, theme/locale variants, and BFF-only
browser transport.

## What Changes

- Reconcile the active Docs prototype at
  `deck-go/frontend-handoff/modules/docs/prototype.html` with current contract
  truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `frontend-handoff/modules/docs/api-usage.md`;
  - Go BFF Docs routes and frontend API wrappers.
- Audit current `frontend-new` Docs implementation against the v2 document
  reader prototype, fixing deterministic visual, interaction, i18n, fixture, or
  API drift when deck-go contract truth supports it.
- Preserve supported product capabilities:
  - `GET /api/docs` list/search/category filter;
  - `GET /api/docs/{id}` detail;
  - `POST /api/docs/extract` from an active session;
  - `DELETE /api/docs/{id}` with confirmation and 404-as-missing tolerance;
  - local keyword filtering, related docs, outline, copy-id, and source
    navigation affordances.
- Keep unsupported or deferred projections explicit:
  - server-side full-text search/indexing;
  - inline editing;
  - soft archive/bin;
  - internal markdown link routing;
  - durable audit feed;
  - richer markdown dependency/highlighting.
- Strengthen mock visual evidence with prototype/current screenshots, search
  overlay, keyword filtering, extraction popover, delete confirmation, localized
  theme variants, and a structured pass or accepted-exception verdict.
- Strengthen real Gateway E2E with safe run-scoped chat/doc extraction data,
  route-shape checks, delete cleanup guard, shell navigation into Docs, dark and
  light modes, English and Chinese locales, child-surface interactions, BFF-only
  browser transport checks, and unexpected error checks.
- Update Docs implementation notes, the remediation matrix, and head task
  `5.8` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-docs-prototype-parity-remediation`: Defines Docs-specific
  prototype parity remediation, product-contract calibration, real fixture
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Docs row verdict and evidence
  status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/docs/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/docs/DocsPanel.test.tsx`;
  - `deck-go/test/e2e/docs-visual.spec.ts`;
  - `deck-go/test/e2e/docs-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`;
  - shared E2E helpers only if deterministic fixture/evidence helpers are
    required.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or contract drift found
    during verification may be fixed in this child when current Gateway/deck-go
    truth supports the fix.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/docs/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.8`.
