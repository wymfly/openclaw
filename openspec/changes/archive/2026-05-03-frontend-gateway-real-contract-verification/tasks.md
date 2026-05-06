## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/gateway/**` and confirm prototype freshness, v2 file structure, status metadata, and prototype-only assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/gateway/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect archived/current `frontend-gateway-hifi-redesign` artifacts and current `openspec/specs/frontend-gateway-hifi-redesign/spec.md`.
- [x] 1.5 Inspect current production Gateway files, frontend API wrappers, endpoint classification, Go BFF/runtime behavior, mock data, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for runtime, Gateway health/status/describe, activity, and monitor payloads.
- [x] 2.2 Inspect endpoint classification for runtime, gateway diagnostic, activity, and monitor routes.
- [x] 2.3 Inspect Go BFF runtime/gateway/activity/monitor routes, runtime facade, Gateway RPC method mapping, projection behavior, auth handling, and not-configured handling.
- [x] 2.4 Inspect frontend wrappers and production panel code for BFF-only access, degradation states, refresh behavior, selected-run state, lifecycle-action absence, and unsupported prototype assumptions.
- [x] 2.5 Build and record the Gateway contract-chain matrix.
- [x] 2.6 Classify Gateway workflows as supported, degraded, unsupported, environment-dependent, empty-valid, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff mock data and UI assumptions with Deck DTOs, Go BFF behavior, runtime/Gateway diagnostics, event-bus projections, and real-stack shape.
- [x] 3.2 Refine the production Gateway panel only where deterministic v2 or real-contract drift is found, keeping unsupported prototype capabilities inactive.
- [x] 3.3 Fix deterministic Gateway-scoped drift in contracts, BFF forwarding, mock data, wrappers, UI, i18n, handoff docs, or tests when backed by evidence.
- [x] 3.4 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.5 Update Gateway handoff notes for unsupported or ambiguous runtime lifecycle, batch console, describe editing, monitor coverage, activity persistence, and schema-rich diagnostics.

## 4. Verification

- [x] 4.1 Run focused Gateway frontend tests.
- [x] 4.2 Run focused Go route/runtime/projection tests.
- [x] 4.3 Add or run Gateway mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Gateway real-stack API/UI E2E for runtime readiness, diagnostic routes, activity/monitor shape, and production render, accepting empty-valid/handoff-blocked monitor detail after bounded attempts.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec validate frontend-gateway-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Gateway panel, API wrapper, Go route/runtime/projection behavior, mock data, contracts, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/gateway/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/gateway/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, or handoff-blocked with evidence.
