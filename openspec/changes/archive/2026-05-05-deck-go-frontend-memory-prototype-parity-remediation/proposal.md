## Why

The Memory module has an active v2 handoff prototype and a production
`frontend-new` implementation, but the head remediation matrix still lacks
strict prototype-parity and strengthened real Gateway evidence. Current tests
cover a useful memory workbench, yet they do not satisfy the governing head
standard: Deck shell navigation from another module, all four theme/locale
variants, safe child-tab interactions, representative real route evidence,
BFF-only browser transport, and structured accepted exceptions for Gateway
capability gaps.

Memory is the deck-go memory-store control plane. It is not a generic file
editor and must stay grounded in the current BFF contract: browse/read,
semantic search with degraded LanceDB semantics, health, and dream diary
read/maintenance actions.

## What Changes

- Reconcile the active Memory prototype at
  `deck-go/frontend-handoff/modules/memory/prototype.html` with contract truth
  from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `frontend-handoff/modules/memory/api-usage.md`;
  - Go BFF memory routes and frontend API wrappers.
- Audit the current `frontend-new` Memory implementation against the active
  four-tab memory-store prototype, fixing deterministic visual, interaction,
  i18n, fixture, route-wrapper, mutation-evidence, or documentation drift when
  code truth supports it.
- Preserve supported product capabilities:
  - Browse directory;
  - Read memory file;
  - Search through canonical `POST /api/memory/search` with degraded LanceDB
    fallback;
  - Health status;
  - Dream diary read and safe maintenance action affordances;
  - Explicit skipped-safe handling for destructive dream actions.
- Strengthen mock visual evidence with prototype/current screenshots, Browse,
  Search, Health, Dreams, file read, degraded search, safe dreams action,
  destructive-action confirmation, localized theme variants, and accepted
  exceptions.
- Strengthen real Gateway E2E with Chat -> Memory shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, safe real browse/read/search
  and dreams read evidence, skipped-safe destructive actions, BFF-only browser
  transport checks, unexpected error checks, and environment circuit-break
  evidence when memory data is empty or unavailable.
- Update Memory implementation notes, the remediation matrix, and head task
  `6.7` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-memory-prototype-parity-remediation`: Defines Memory-specific
  prototype parity remediation, contract-truth calibration, real evidence
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Memory row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/memory/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/memory/MemoryPanel.test.tsx`;
  - `deck-go/test/e2e/memory-visual.spec.ts`;
  - `deck-go/test/e2e/memory-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs` only if prototype-shaped memory
    fixture behavior is incomplete.
- Contracts:
  - no intended DTO expansion;
  - destructive dream actions remain skipped-safe unless disposable memory roots
    and cleanup proof exist.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/memory/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.7`.
