## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/budget/**` and confirm prototype freshness, v2 file structure, status metadata, and prototype-only assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/budget/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect archived/current `frontend-budget-hifi-redesign` artifacts and current `openspec/specs/frontend-budget-hifi-redesign/spec.md`.
- [x] 1.5 Inspect current production Budget files, frontend API wrappers, endpoint classification, Go BFF forwarding/localstore behavior, mock data, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for budget rules and evaluations.
- [x] 2.2 Inspect endpoint classification for `/usage/budget`, `/usage/budget/{id}`, and `/usage/budget/evaluate`.
- [x] 2.3 Inspect Go BFF localstore CRUD, usage-cost evaluation, event bus publication, validation, delete semantics, and auth handling.
- [x] 2.4 Inspect frontend wrappers and production panel code for BFF-only access, validation, mutation refresh, selected-rule state, unsupported mock-only assumptions, and open enum handling.
- [x] 2.5 Build and record the Budget contract-chain matrix.
- [x] 2.6 Classify Budget workflows as supported, degraded, unsupported, environment-dependent, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare v2 handoff mock data and UI assumptions with Deck DTOs, Go BFF behavior, localstore/evaluation semantics, and real-stack shape.
- [x] 3.2 Refine the production Budget panel toward the v2 two-pane rules/evaluations workbench while keeping only contract-backed capabilities active.
- [x] 3.3 Fix deterministic Budget-scoped drift in contracts, BFF forwarding, mock data, wrappers, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.4 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.5 Update Budget handoff notes for unsupported or ambiguous forecast, per-rule history, recentChanges audit, notification routing, billing enforcement, org/team scope, chart-lib, and form-lib assumptions.

## 4. Verification

- [x] 4.1 Run focused Budget frontend tests.
- [x] 4.2 Run focused Go route/localstore/evaluation tests.
- [x] 4.3 Add or run Budget mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Budget real-stack API/UI E2E for read-only and safe test-rule mutation scenarios, accepting handoff-blocked writes after bounded attempts.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-budget-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Budget panel, API wrapper, Go route/localstore/evaluation behavior, mock data, contracts, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/budget/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/budget/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed or handoff-blocked with evidence.
