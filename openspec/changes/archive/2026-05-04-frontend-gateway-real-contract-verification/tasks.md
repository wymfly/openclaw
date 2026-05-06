## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/gateway/**` and confirm prototype freshness, v2 file structure, status metadata, and backend assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/gateway/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-gateway-hifi-redesign` and `frontend-gateway-real-contract-verification` specs plus current production Gateway implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, UI metadata, Go BFF Gateway routes, typed runtime batch route, Gateway method mapping, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for Gateway health/status/describe/batch, runtime, activity, and monitor payloads.
- [x] 2.2 Inspect endpoint classification for `/api/gateway/*`, `/api/v1/runtimes/{runtimeId}/gateway/*`, activity, monitor, and prototype-mentioned stale routes.
- [x] 2.3 Inspect Go BFF route mapping, runtime facade, typed Gateway batch dispatch, response envelopes, auth/error handling, and mock Gateway shape.
- [x] 2.4 Inspect frontend Gateway behavior for BFF-only access, v2 topbar/hero/rails/throughput/tabs, describe explorer, batch console, activity projection, remote gating, and unsupported prototype behavior.
- [x] 2.5 Build and record the Gateway contract-chain matrix.
- [x] 2.6 Classify Gateway workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Gateway/BFF route behavior, endpoint classification, UI metadata, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor or tighten the production Gateway panel to the v2 control-plane workbench where contract-backed, preserving useful existing runtime, diagnostics, activity, and monitor evidence.
- [x] 3.3 Add or expose a safe frontend Gateway batch wrapper that uses the real runtime-scoped BFF route and keeps arbitrary mutating calls out of this panel.
- [x] 3.4 Fix deterministic Gateway-scoped drift in contracts, BFF behavior, wrappers, mock data, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.5 Keep unsupported prototype capabilities inactive, degraded, or documented rather than adding speculative routes/dependencies.
- [x] 3.6 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.7 Update Gateway handoff notes for route truth, method-name truth, batch safety, activity/throughput projection state, real-stack variation, and source-of-truth assumptions.

## 4. Verification

- [x] 4.1 Run focused Gateway frontend tests.
- [x] 4.2 Run focused Go BFF/runtime route tests for Gateway diagnostics and typed batch forwarding.
- [x] 4.3 Add or run Gateway mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Gateway real-stack API/UI E2E for safe read paths, safe read-only batch, empty/degraded handling, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec change validate frontend-gateway-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Gateway panel, API facade, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/gateway/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/gateway/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.
