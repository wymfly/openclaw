## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/memory/**` and confirm prototype freshness, v2 file structure, status metadata, and dependency assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/memory/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-memory-hifi-redesign` spec and current production Memory implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, Go BFF/runtime behavior, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for memory browse, health, search, and dream result payloads.
- [x] 2.2 Inspect endpoint classification for canonical Memory routes and compatibility aliases.
- [x] 2.3 Inspect Go BFF route mapping, OpenClaw runtime adapters, Gateway method mapping, auth handling, workspace resolution, and not-configured/degraded handling.
- [x] 2.4 Inspect frontend panel behavior for BFF-only access, four-tab navigation, lazy browse/read, search warning states, health rendering, dream action confirmation, Markdown rendering, empty/error states, and no unsupported mutation behavior.
- [x] 2.5 Build and record the Memory contract-chain matrix.
- [x] 2.6 Classify Memory workflows as supported, degraded, unsupported, environment-dependent, empty-valid, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Go BFF behavior, Gateway method support, dependency constraints, and real-stack shape.
- [x] 3.2 Add canonical `POST /api/memory/search` in active and admin BFF route trees, keep `GET /api/memory/search` as a compatibility alias, and update focused backend tests.
- [x] 3.3 Switch the production `searchMemory` wrapper and tests to canonical POST search while preserving degraded 501 normalization.
- [x] 3.4 Refactor the production Memory panel to the v2 four-tab workspace and inline destructive confirmation model, keeping unsupported prototype capabilities inactive or degraded.
- [x] 3.5 Fix deterministic Memory-scoped drift in contracts, BFF forwarding, mock data, wrappers, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.6 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.7 Update Memory handoff notes for unresolved LanceDB, Markdown dependency, dream progress, audit, editing, search history, and ACL assumptions.

## 4. Verification

- [x] 4.1 Run focused Memory frontend tests.
- [x] 4.2 Run focused Go route/runtime tests for memory routes and compatibility aliases.
- [x] 4.3 Add or run Memory mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Memory real-stack API/UI E2E for browse, canonical search, legacy search, health, safe dreams read, production render, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-memory-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Memory panel, API wrapper, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/memory/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/memory/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.
