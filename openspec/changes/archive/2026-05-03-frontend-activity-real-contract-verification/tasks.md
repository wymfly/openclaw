## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/activity/**` and confirm prototype freshness, contract assumptions, and status metadata.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/activity/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect archived `frontend-activity-hifi-contract-redesign` artifacts and current `openspec/specs/frontend-activity-hifi-redesign/spec.md`.
- [x] 1.5 Inspect current production Activity files, frontend API wrappers, stream helpers, mock visual E2E, Go BFF routes, projection code, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for Activity, Monitor, and `activity.event` SSE payloads.
- [x] 2.2 Inspect endpoint classification and stream contract docs for Activity/Monitor routes and SSE payloads.
- [x] 2.3 Inspect Go BFF route/projection behavior for `/activity`, `/monitor/runs`, `/monitor/runs/{runId}`, and `/monitor/stats`.
- [x] 2.4 Inspect frontend wrappers and production panel code for BFF-only access and stream normalization.
- [x] 2.5 Build and record the Activity contract-chain matrix.
- [x] 2.6 Classify Activity workflows as supported, degraded, unsupported, environment-dependent, or real-empty-valid.

## 3. Scoped Fixes

- [x] 3.1 Compare handoff mock data and UI assumptions with Deck DTOs, Go projection behavior, and real-stack shape.
- [x] 3.2 Fix deterministic Activity-scoped drift in contracts, routes/projections, wrappers, stream normalization, UI, mocks, or tests when backed by evidence.
- [x] 3.3 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.4 Update Activity handoff notes for unsupported or mock-only assumptions.

## 4. Verification

- [x] 4.1 Run focused Activity frontend tests.
- [x] 4.2 Run focused Go route/projection tests.
- [x] 4.3 Run Activity mock visual E2E and label it L1 mock visual coverage.
- [x] 4.4 Add or run Activity real-stack API/UI E2E for safe read-only scenarios.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-activity-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Activity panel, API wrappers, stream normalization, Go routes/projections, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/activity/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, real-empty-valid, or handoff-blocked with evidence.
