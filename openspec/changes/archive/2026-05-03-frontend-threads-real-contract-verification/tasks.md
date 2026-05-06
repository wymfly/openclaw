## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/threads/**` and confirm prototype freshness, v2 file structure, status metadata, and prototype-only assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/threads/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect archived `frontend-threads-hifi-contract-redesign` artifacts and current `openspec/specs/frontend-threads-hifi-redesign/spec.md`.
- [x] 1.5 Inspect current production Threads files, frontend API wrappers, endpoint classification, Go BFF forwarding/projection, mock Gateway behavior, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for thread entries and list response.
- [x] 2.2 Inspect endpoint classification and generated docs for `/api/deck/threads`.
- [x] 2.3 Inspect Go BFF query forwarding, Gateway typed client/projection behavior, auth handling, and real empty-state behavior.
- [x] 2.4 Inspect frontend wrappers and production panel code for BFF-only access and unsupported mock-only assumptions.
- [x] 2.5 Build and record the Threads contract-chain matrix.
- [x] 2.6 Classify Threads workflows as supported, degraded, unsupported, environment-dependent, or real-empty-valid.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare v2 handoff mock data and UI assumptions with Deck DTOs, Go BFF behavior, Gateway projection, and real-stack shape.
- [x] 3.2 Refine the production Threads panel toward the v2 binding registry workbench while keeping only contract-backed capabilities active.
- [x] 3.3 Fix deterministic Threads-scoped drift in contracts, BFF forwarding/projection, mock Gateway data, wrappers, UI, i18n, or tests when backed by evidence.
- [x] 3.4 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.5 Update Threads handoff notes for unsupported or mock-only mutation, recent-activity, audit, transcript, branch, status, and non-Discord assumptions.

## 4. Verification

- [x] 4.1 Run focused Threads frontend tests.
- [x] 4.2 Run focused Go route/projection tests.
- [x] 4.3 Add or run Threads mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Threads real-stack API/UI E2E for read-only scenarios, accepting real-empty-valid when no thread bindings exist.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-threads-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Threads panel, API wrapper, Go forwarding/projection, mock data, contracts, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/threads/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/threads/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, real-empty-valid, or handoff-blocked with evidence.
