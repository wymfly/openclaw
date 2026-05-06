## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/identity/**` and confirm prototype freshness, v2 file structure, status metadata, and backend assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/identity/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-identity-hifi-redesign` and `frontend-identity-real-contract-verification` specs plus current production Identity implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, UI metadata, Go BFF Identity routes, runtime-scoped Identity routes, Gateway method mapping, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for identity links, peers, config hash, agent identity, bootstrap/runtime data, and any existing projection fields.
- [x] 2.2 Inspect endpoint classification for `/api/deck/identity`, `/api/agents/{agentId}/identity`, runtime-scoped identity routes, and prototype-mentioned unsupported routes.
- [x] 2.3 Inspect Go BFF route mapping, runtime facade, generated Gateway methods, response envelopes, auth/error handling, and mock Gateway shape.
- [x] 2.4 Inspect frontend Identity behavior for BFF-only access, v2 two-pane registry, selected canonical detail, peer rows, baseHash guard, link/unlink flows, unsupported rename/create/delete behavior, empty states, and raw payload.
- [x] 2.5 Build and record the Identity contract-chain matrix.
- [x] 2.6 Classify Identity workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Gateway/BFF route behavior, endpoint classification, UI metadata, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor or tighten the production Identity panel to the v2 canonical registry where contract-backed, preserving useful existing link/unlink, hash guard, error, and raw payload behavior.
- [x] 3.3 Keep rename/create/delete canonical, peer activity enrichment, recent mutation audit, and profile/API-key/session workflows inactive, degraded, or documented unless current Gateway/BFF support is verified.
- [x] 3.4 Fix deterministic Identity-scoped drift in contracts, BFF behavior, wrappers, mock data, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Identity handoff notes for route truth, method-name truth, baseHash safety, unsupported prototype mutations, projection state, real-stack variation, and source-of-truth assumptions.

## 4. Verification

- [x] 4.1 Run focused Identity frontend tests.
- [x] 4.2 Run focused Go BFF/runtime route tests for Identity list/link/unlink and agent identity.
- [x] 4.3 Add or run Identity mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Identity real-stack API/UI E2E for safe read paths, safe mutation when baseHash is available, empty/degraded handling, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec change validate frontend-identity-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Identity panel, API facade, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/identity/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/identity/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.
