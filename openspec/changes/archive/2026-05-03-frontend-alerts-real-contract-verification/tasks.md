## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/alerts/**` and confirm prototype freshness, v2 file structure, status metadata, and prototype-only assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/alerts/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect archived `frontend-alerts-hifi-contract-redesign` artifacts and current `openspec/specs/frontend-alerts-hifi-redesign/spec.md`.
- [x] 1.5 Inspect current production Alerts files, frontend API wrappers, endpoint classification, Go BFF routes, localstore behavior, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for alert actions, rules, list response, and mutation response.
- [x] 2.2 Inspect endpoint classification and generated docs for `/api/alerts` CRUD behavior.
- [x] 2.3 Inspect Go BFF input validation, adapter behavior, localstore JSON shape, and auth handling for alert routes.
- [x] 2.4 Inspect frontend wrappers and production panel code for BFF-only access and unsupported mock-only assumptions.
- [x] 2.5 Build and record the Alerts contract-chain matrix.
- [x] 2.6 Classify Alerts workflows as supported, degraded, unsupported, environment-dependent, or real-empty-valid.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare v2 handoff mock data and UI assumptions with Deck DTOs, Go localstore behavior, and real-stack shape.
- [x] 3.2 Rebuild or refactor the production Alerts panel toward the v2 alert rules workbench while keeping only contract-backed capabilities active.
- [x] 3.3 Fix deterministic Alerts-scoped drift in contracts, routes/localstore, wrappers, UI, mocks, i18n, or tests when backed by evidence.
- [x] 3.4 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.5 Update Alerts handoff notes for unsupported or mock-only fires, audit, test-fire, evaluator, condition DSL, and webhook-binding assumptions.

## 4. Verification

- [x] 4.1 Run focused Alerts frontend tests.
- [x] 4.2 Run focused Go alert route/localstore tests.
- [x] 4.3 Add or run Alerts mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Alerts real-stack API/UI E2E for safe CRUD scenarios with cleanup.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-alerts-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Alerts panel, API wrappers, Go routes/localstore, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/alerts/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/alerts/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, real-empty-valid, or handoff-blocked with evidence.
