## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/usage/**` and confirm prototype freshness, v2 file structure, status metadata, and dependency assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/usage/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-usage-hifi-redesign` spec and current production Usage implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, Go BFF/runtime behavior, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for usage cost, provider status, sessions, logs, timeseries, context weight, and bootstrap payloads.
- [x] 2.2 Inspect endpoint classification for canonical `/usage/*` routes and legacy `/models/usage/*` aliases.
- [x] 2.3 Inspect Go BFF route mapping, OpenClaw runtime adapters, Gateway method mapping, auth handling, and not-configured handling.
- [x] 2.4 Inspect frontend panel behavior for BFF-only access, range refresh, provider selection, search/filter/sort, session detail lazy loading, cross-panel navigation, empty/error states, and read-only behavior.
- [x] 2.5 Build and record the Usage contract-chain matrix.
- [x] 2.6 Classify Usage workflows as supported, degraded, unsupported, environment-dependent, empty-valid, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Go BFF behavior, Gateway method support, dependency constraints, and real-stack shape.
- [x] 3.2 Switch Usage production wrappers and tests to canonical `/api/usage/cost` and `/api/usage/providers` while preserving legacy `/api/models/usage/*` aliases.
- [x] 3.3 Refine the production Usage panel only where deterministic v2 or real-contract drift is found, keeping unsupported prototype capabilities inactive or degraded.
- [x] 3.4 Fix deterministic Usage-scoped drift in contracts, BFF forwarding, mock data, wrappers, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Usage handoff notes for unresolved billing, quota policy, tenant accounting, forecast, chart dependency, timeseries granularity, and context-weight trust assumptions.

## 4. Verification

- [x] 4.1 Run focused Usage frontend tests.
- [x] 4.2 Run focused Go route/runtime tests for usage and legacy aliases.
- [x] 4.3 Add or run Usage mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Usage real-stack API/UI E2E for bootstrap, canonical usage routes, optional detail routes, production render, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-usage-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Usage panel, API wrapper, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/usage/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/usage/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, or handoff-blocked with evidence.
