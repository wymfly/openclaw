## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/settings/**` and confirm prototype freshness, v2 file structure, status metadata, and backend assumptions.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/settings/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Inspect current `frontend-settings-hifi-redesign` and `frontend-settings-real-contract-verification` specs plus current production Settings implementation.
- [x] 1.5 Inspect frontend API wrappers, endpoint classification, UI metadata, Go BFF Settings/runtime/device routes, mock fixtures, and related tests.

## 2. Contract And Capability Audit

- [x] 2.1 Inspect Deck DTO authority for settings, settings save, connection test, version, bootstrap, runtime gateway, runtime capabilities, runtime endpoint, endpoint put/test, paired devices, and device token actions.
- [x] 2.2 Inspect endpoint classification and UI metadata for settings, bootstrap, runtime, endpoint, version, devices, and prototype-mentioned projected routes.
- [x] 2.3 Inspect Go BFF/admin/server routes, runtime facade, response envelopes, auth/error handling, and mock Gateway shape.
- [x] 2.4 Inspect frontend Settings behavior for BFF-only access, v2 workbench, read/save payload, runtime endpoint read-only behavior, endpoint test/update, device actions, stream handling, token dialog, empty/error states, and raw payload handling.
- [x] 2.5 Build and record the Settings contract-chain matrix.
- [x] 2.6 Classify Settings workflows as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked.

## 3. Production Implementation And Scoped Fixes

- [x] 3.1 Compare refreshed handoff assumptions with Deck DTOs, BFF route behavior, endpoint classification, UI metadata, dependency constraints, and real-stack shape.
- [x] 3.2 Refactor or tighten the production Settings panel only where contract-backed drift is found, preserving useful existing v2 workbench behavior and token/runtime safety.
- [x] 3.3 Keep token rotation endpoint, recent-save audit, keybindings, privacy, bundled `.env` mutation, and rich paired-device fields inactive, degraded, or documented unless current support is verified.
- [x] 3.4 Fix deterministic Settings-scoped drift in contracts, BFF behavior, wrappers, mock data, UI, i18n, handoff docs, metadata, or tests when backed by evidence.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update Settings handoff notes for route truth, runtime-mode truth, token/device safety, unsupported projections, real-stack variation, and source-of-truth assumptions.

## 4. Verification

- [x] 4.1 Run focused Settings frontend tests.
- [x] 4.2 Run focused Go BFF/runtime route tests for Settings, runtime endpoint, bootstrap/runtime, devices, and version.
- [x] 4.3 Add or run Settings mock visual E2E and label it L1 mock/local visual coverage.
- [x] 4.4 Add or run Settings real-stack API/UI E2E for safe read paths, expected immutable endpoint handling, empty/degraded handling, and BFF-only browser access.
- [x] 4.5 Apply the circuit breaker after at most three fresh attempts for any real scenario without a scoped deterministic fix.
- [x] 4.6 Run `openspec change validate frontend-settings-real-contract-verification --strict`.
- [x] 4.7 Run relevant contract checks if contracts or generated artifacts changed.
- [x] 4.8 Run `cd deck-go && make frontend-build`.
- [x] 4.9 Run `git diff --check`.

## 5. Review And Archive Readiness

- [x] 5.1 Perform code-level review of Settings panel, API facade, Go route/runtime behavior, contracts, mocks, and real evidence.
- [x] 5.2 Update `deck-go/frontend-handoff/modules/settings/implementation-notes.md` with findings, fixes, matrix, evidence, and residual risks.
- [x] 5.3 Update `deck-go/frontend-handoff/modules/settings/README.md` status when implementation and real-contract verification are complete.
- [x] 5.4 Update `verification.yaml` for every L1/L2 scenario and mark archive-ready only when all non-L2 tasks are complete and L2 scenarios are passed, empty-valid, degraded, skipped-safe, or handoff-blocked with evidence.
