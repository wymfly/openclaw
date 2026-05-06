## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/channels/README.md` and confirm the v2 package is still the active pending implementation target.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/channels/prototype.html` and record whether the v2 prototype loads without browser errors.
- [x] 1.4 Read the channels v2 `app.jsx`, `data.js`, `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`.
- [x] 1.5 Inspect current production channels files under `deck-go/frontend-new/src/components/panels/channels/**`, `frontend-new/src/api.ts`, and channels-related Go backend routes/adapters.
- [x] 1.6 Capture baseline notes for current production behavior, reusable code, known divergences, and unrelated worktree changes that must be preserved.

## 2. Real Gateway And BFF Capability Audit

- [x] 2.1 Inspect channels-related Gateway generated artifacts and Go generated bindings for `channels.status` and `channels.logout`.
- [x] 2.2 Inspect Gateway source/method definitions and result schemas for channels, usage, config, routing, and any WeCom-adjacent data needed by the prototype.
- [x] 2.3 Inspect real `gateway.describe` from a running real stack when available; if auth/runtime blocks access, record the blocker and continue with source/generated evidence.
- [x] 2.4 Inspect `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-exceptions.contract.json`, `deck-ui.contract.json`, generated docs, and endpoint classification for channels-related rows.
- [x] 2.5 Inspect Go BFF `/channels`, `/channels/{id}/test`, `/channels/{id}/throughput`, `/channels/{id}/logout`, `/channels/{id}` patch, `/config`, and `/routing` behavior.
- [x] 2.6 Build a channels capability matrix covering inventory, selection, account diagnostics, probe, throughput, logout, enable/disable, settings patch, DM policy patch, routing, plugin navigation, WeCom access, and create-channel affordance.
- [x] 2.7 Classify each workflow as `supported`, `degraded`, `unsupported`, or `environment-dependent`, with the product decision for unsupported/degraded behavior.

## 3. Contract Chain Calibration

- [x] 3.1 Compare the v2 handoff mock data and UI assumptions with current `DeckGo*` DTOs and generated types.
- [x] 3.2 Decide whether `accountDiagnostics`, `dmPolicy`, `wecomAccess`, and throughput summaries are Deck BFF projections, frontend selectors, placeholders, or follow-ups.
- [x] 3.3 Compare `frontend-new/src/api.ts` channels wrappers with Deck endpoint classification and Go route behavior.
- [x] 3.4 Inspect Go channels BFF/adapters for normalization, error mapping, config hash/base-hash handling, and unsafe mutation assumptions.
- [x] 3.5 Fix deterministic DTO, endpoint classification, frontend wrapper, or Go adapter drift that is scoped to channels and backed by real Gateway/BFF/source evidence.
- [x] 3.6 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.7 Update channels handoff notes for unsupported prototype expectations that are not implemented.

## 4. Backend Control-Plane Completion

- [x] 4.1 Implement channels-scoped Go route, adapter, DTO, selector, normalization, or error-mapping fixes discovered during calibration.
- [x] 4.2 Ensure throughput behavior is honest: wire real data only if a real source exists; otherwise render and document the empty placeholder.
- [x] 4.3 Ensure config patch, channel patch, and mutation routes preserve current safe hash/base-hash behavior or document any unresolved conflict semantics.
- [x] 4.4 Add or update focused Go tests for each backend adapter/route behavior changed by this proposal.
- [x] 4.5 Verify backend fixes with the narrowest relevant `go test` command before widening.
- [x] 4.6 Record backend gaps that require upstream Gateway schema/method work, disposable channel state, or broad architecture changes as handoff items instead of masking them in UI.

## 5. Production Channels UI Implementation

- [x] 5.1 Translate the revised v2 list-to-detail workbench into `frontend-new` while preserving the active shell, panel registry, and design-system token usage.
- [x] 5.2 Implement channel inventory search/filter and list/detail navigation within currently supported capability; avoid UI that implies unsupported server-side query or pagination.
- [x] 5.3 Implement selected-channel hero, tabs, overview metrics, account diagnostics, and missing-field empty states using contract-calibrated selectors or BFF projections.
- [x] 5.4 Implement throughput tab/window behavior with real empty-state honesty and no invented production traffic data.
- [x] 5.5 Implement probe result, test action, and safe probe error formatting through the existing API facade.
- [x] 5.6 Implement settings patch and DM policy controls only where the route/contract is supported, with validation and clear disabled/degraded states otherwise.
- [x] 5.7 Implement routing tab and plugin navigation handoffs without changing routing/plugin module behavior outside channels.
- [x] 5.8 Implement WeCom access display/save behavior only to the extent supported by current config/routing contracts; document unsupported account-level mutations.
- [x] 5.9 Implement create-channel and logout affordances with confirmation gates and disabled/handoff states when safe production support is absent.
- [x] 5.10 Ensure missing optional real Gateway fields render as unavailable or neutral UI rather than invented zeros or mock-only claims.
- [x] 5.11 Preserve other panels and shell behavior outside channels unless a small integration fix is directly required.

## 6. Mock Visual And Focused Tests

- [x] 6.1 Update or add channels mock fixtures shaped like current Deck-facing DTOs and documented BFF/selector decisions.
- [x] 6.2 Add or update focused API wrapper tests for channels inventory, probe, throughput, logout, patch, config, routing, and error handling.
- [x] 6.3 Add or update focused component/a11y tests for ready, empty, loading, error, list/detail navigation, tabs, probe, settings, routing, WeCom, create, and logout states.
- [x] 6.4 Add or update channels mock visual Playwright E2E in the real `frontend-new` shell and label it as L1 mock visual coverage.
- [x] 6.5 Ensure mock visual E2E fails on unexpected `console.error`, `pageerror`, or API 4xx/5xx from mocked routes.

## 7. L2 Real Gateway Verification With Circuit Breaker

- [x] 7.1 Start or reuse the real stack with `deck-go/scripts/dev/run-stack-real.sh` or the Playwright real-stack helper and record runtime/auth readiness.
- [x] 7.2 Run the channels real API smoke: runtime health, `gateway.describe`, typed channels method availability, `/channels`, and at least one safe read such as throughput or documented empty-state.
- [x] 7.3 Run the channels real UI smoke: open the production channels panel, render real or empty channel state, exercise a non-destructive interaction, and assert no API 4xx/5xx or page errors.
- [x] 7.4 Attempt safe reversible mutation verification only when disposable channel/config state or equivalent isolation is available.
- [x] 7.5 For each real scenario, fix deterministic scoped code/contract defects and retry.
- [x] 7.6 Apply the circuit breaker after at most three fresh attempts per real scenario; mark unresolved environment, auth, provider, mutation-isolation, or unclear Gateway failures as handoff-blocked with evidence.
- [x] 7.7 Update `verification.yaml` with pass, blocked, or skipped status for every L2 scenario.

## 8. Mandatory Code Review And Handoff Evidence

- [x] 8.1 Review `frontend-new/src/components/panels/channels/**` for raw Gateway access, unsupported mock-only fields, focus/a11y regressions, unsafe mutation behavior, and design-system drift.
- [x] 8.2 Review channels API wrappers, Go route/adapters, contract sources/generation output, mocks, and E2E tests for scoped drift or unsafe passthroughs.
- [x] 8.3 Record review findings or an explicit no-finding statement with residual risks.
- [x] 8.4 Update `deck-go/frontend-handoff/modules/channels/implementation-notes.md` or equivalent notes with visual divergences, product-contract decisions, backend fixes, local molecules, real verification results, and handoff-blocked scenarios.
- [x] 8.5 Update any relevant design-system readiness or module status notes required by the implementation.
- [x] 8.6 Record the deferred `models` v2 finding: smoke-passing handoff exists, but pricing/audit BFF projections require a separate proposal and contract calibration.

## 9. Final Verification And Archive Readiness

- [x] 9.1 Run `openspec validate frontend-channels-real-contract-verification --strict`.
- [x] 9.2 Run focused channels frontend tests.
- [x] 9.3 Run focused channels/backend adapter tests for touched Go packages.
- [x] 9.4 Run the channels mock visual E2E.
- [x] 9.5 Run the relevant contract check target if any contract or generated artifact changed.
- [x] 9.6 Run `cd deck-go && make frontend-build`.
- [x] 9.7 Run `git diff --check`.
- [x] 9.8 Confirm all non-L2 tasks are complete and each L2 scenario is either real-verified or handoff-blocked with evidence before marking the change archive-ready.
