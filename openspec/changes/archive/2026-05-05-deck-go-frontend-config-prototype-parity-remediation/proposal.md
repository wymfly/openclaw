## Why

The Config module already has a v2 high-fidelity handoff prototype and an
earlier real-contract implementation pass, but the remediation head matrix still
classifies it as mock functional only and parity-unreviewed. Under the
strengthened head standard, Config must prove the active prototype was actually
matched, and its real Gateway evidence must validate the product flow rather
than relying on a direct panel URL plus API smoke.

Config is also a high-risk control surface because it edits `openclaw.json`
through optimistic concurrency. The child proposal must therefore preserve the
existing BFF-only contract chain and safe write gating while adding stronger
mock parity and real E2E evidence.

## What Changes

- Reconcile the active Config prototype at
  `deck-go/frontend-handoff/modules/config/prototype.html` with current
  contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `frontend-handoff/modules/config/api-usage.md`;
  - the Go BFF Config routes and frontend API wrappers.
- Audit the current `frontend-new` Config implementation against the v2
  three-pane editor prototype, fixing deterministic visual, interaction,
  i18n, fixture, or API drift when Gateway/deck-go contract truth supports it.
- Preserve supported product capabilities:
  - `GET /api/config` snapshot load;
  - `POST /api/config/schema-lookup` lazy section lookup;
  - `POST /api/config/apply` gated by writable raw text and `baseHash`;
  - local diff preview, reset, conflict handling, and sensitive-field reveal.
- Keep unsupported prototype projections explicit:
  - durable apply history;
  - scaffold/create defaults;
  - import/export;
  - rollback/version restore;
  - schema lookup batching;
  - first-class field-level validation DTOs.
- Strengthen mock visual evidence with prototype/current screenshots,
  structured section editing, raw/diff/history or accepted fallback states,
  sensitive reveal, apply confirmation, localized theme variant coverage, and a
  structured pass or accepted-exception verdict.
- Strengthen real Gateway E2E with shell navigation into Config, both
  theme/locale axes, safe child-surface interactions, BFF-only browser transport
  checks, unexpected error checks, direct route-shape checks, and a bounded
  run-scoped fixture attempt against isolated real config state.
- Update Config handoff implementation notes, the remediation matrix, and head
  task `5.7` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-config-prototype-parity-remediation`: Defines the Config-specific
  prototype parity remediation, contract-calibration rules, safe real fixture
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Config row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/config/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/config/ConfigPanel.test.tsx`;
  - `deck-go/test/e2e/config-visual.spec.ts`;
  - `deck-go/test/e2e/config-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`;
  - shared E2E helpers only if deterministic evidence helpers are required.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or contract drift found
    during verification may be fixed in this child when Gateway truth supports
    the fix.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/config/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.7`.
