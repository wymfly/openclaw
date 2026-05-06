## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/agents/README.md` and confirm the revised v2 package is still the active pending implementation target.
- [x] 1.3 Open or smoke-test `deck-go/frontend-handoff/modules/agents/prototype.html` and record whether the v2 prototype loads without browser errors.
- [x] 1.4 Inspect current production agents files under `deck-go/frontend-new/src/components/panels/agents/**`, `frontend-new/src/api.ts`, agents store code, and agents-related Go backend routes/adapters.
- [x] 1.5 Capture baseline notes for current production behavior, reusable code, known divergences, and any user or unrelated worktree changes that must be preserved.

## 2. Real Gateway Capability Audit

- [x] 2.1 Inspect agents-related Gateway generated artifacts and Go generated bindings for `agents.*` and `deck.agents.*`.
- [x] 2.2 Inspect real `gateway.describe` from a running real stack when available; if auth/runtime blocks access, record the blocker and continue with source/generated evidence.
- [x] 2.3 Inspect `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-exceptions.contract.json`, `deck-ui.contract.json`, and `docs/gateway-untyped-exceptions.md` for agents-related rows.
- [x] 2.4 Build an agents capability matrix covering list, detail, create, update, delete, skills, subagents, event streams, previews, files, and status streams.
- [x] 2.5 Classify each workflow as `supported`, `degraded`, `unsupported`, or `environment-dependent`, with the product decision for unsupported/degraded behavior.

## 3. Contract Chain Calibration

- [x] 3.1 Compare the v2 handoff mock data and UI assumptions with current `DeckGo*` DTOs and generated types.
- [x] 3.2 Compare `frontend-new/src/api.ts` agents wrappers with Deck endpoint classification and Go route behavior.
- [x] 3.3 Inspect Go agents BFF/adapters for normalization, error mapping, hash/base revision handling, and raw passthrough risks.
- [x] 3.4 Fix deterministic DTO, endpoint classification, frontend wrapper, or Go adapter drift that is scoped to agents and backed by real Gateway/source evidence.
- [x] 3.5 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.6 Update agents handoff notes for unsupported prototype expectations that are not implemented.

## 4. Backend Control-Plane Completion

- [x] 4.1 Implement agents-scoped Go route, adapter, DTO, normalization, or error-mapping fixes discovered during calibration.
- [x] 4.2 Add or update focused Go tests for each backend adapter/route behavior changed by this proposal.
- [x] 4.3 Ensure backend behavior distinguishes supported, degraded, unsupported, and Gateway/error states in a frontend-consumable way.
- [x] 4.4 Verify backend fixes with the narrowest relevant `go test` command before widening.
- [x] 4.5 Record backend gaps that require upstream Gateway schema/method work or broad architecture changes as handoff items instead of masking them in UI.

## 5. Production Agents UI Implementation

- [x] 5.1 Translate the revised v2 list/workbench layout into `frontend-new` while preserving the active shell, route/panel registry, and design-system token usage.
- [x] 5.2 Implement list search/filter/sort only within currently supported capability; avoid UI that implies unsupported server-side query or pagination.
- [x] 5.3 Implement selected-agent detail navigation, overview edit state, dirty/save/conflict feedback, and product copy aligned with real contract semantics.
- [x] 5.4 Implement skills, subagents, event streams, files, tool-policy preview, and system-prompt preview sections using typed API wrappers and documented fallbacks.
- [x] 5.5 Implement create and delete flows using backend-supported fields only; destructive actions must keep explicit confirmation.
- [x] 5.6 Ensure missing optional real Gateway fields render as unavailable or neutral UI rather than invented zeros or mock-only claims.
- [x] 5.7 Preserve chat, routing, subagents, and other panel behavior outside agents unless a small integration fix is directly required.

## 6. Mock Visual And Focused Tests

- [x] 6.1 Update or add agents mock fixtures shaped like current Deck-facing DTOs.
- [x] 6.2 Add or update focused unit tests for agents state helpers, section selection, create validation, patch building, save/delete behavior, and error formatting.
- [x] 6.3 Add or update focused component/a11y tests for ready, empty, loading, error, create, delete, and section states.
- [x] 6.4 Add or update agents mock visual Playwright E2E in the real `frontend-new` shell and label it as L1 mock visual coverage.
- [x] 6.5 Ensure mock visual E2E fails on unexpected `console.error`, `pageerror`, or API 4xx/5xx from mocked routes.

## 7. L2 Real Gateway Verification With Circuit Breaker

- [x] 7.1 Start or reuse the real stack with `deck-go/scripts/dev/run-stack-real.sh` or the Playwright real-stack helper and record runtime/auth readiness.
- [x] 7.2 Run the agents real API smoke: runtime health, `gateway.describe`, `agents.list`, Deck agents detail for an existing agent, and at least one safe section read.
- [x] 7.3 Run the agents real UI smoke: open the production agents panel, render real agent data, select an agent, switch at least one section, and assert no API 4xx/5xx or page errors.
- [x] 7.4 Attempt safe reversible mutation verification only when disposable agent state or equivalent isolation is available.
- [x] 7.5 For each real scenario, fix deterministic scoped code/contract defects and retry.
- [x] 7.6 Apply the circuit breaker after at most three fresh attempts per real scenario; mark unresolved environment, auth, provider, or unclear Gateway failures as handoff-blocked with evidence.
- [x] 7.7 Update `verification.yaml` with pass, blocked, or skipped status for every L2 scenario.

## 8. Mandatory Code Review And Handoff Evidence

- [x] 8.1 Review `frontend-new/src/components/panels/agents/**` for raw endpoint/method strings, unsupported mock-only fields, focus/a11y regressions, and design-system drift.
- [x] 8.2 Review agents API wrappers, Go route/adapters, and contract sources/generation output for scoped drift or unsafe passthroughs.
- [x] 8.3 Record review findings or an explicit no-finding statement with residual risks.
- [x] 8.4 Update `deck-go/frontend-handoff/modules/agents/implementation-notes.md` with visual divergences, product-contract decisions, backend fixes, local molecules, real verification results, and handoff-blocked scenarios.
- [x] 8.5 Update any relevant design-system readiness or module status notes required by the implementation.

## 9. Final Verification And Archive Readiness

- [x] 9.1 Run `openspec validate frontend-agents-real-contract-verification --strict`.
- [x] 9.2 Run focused agents frontend tests.
- [x] 9.3 Run focused agents/backend adapter tests for touched Go packages.
- [x] 9.4 Run the agents mock visual E2E.
- [x] 9.5 Run the relevant contract check target if any contract or generated artifact changed.
- [x] 9.6 Run `cd deck-go && make frontend-build`.
- [x] 9.7 Run `git diff --check`.
- [x] 9.8 Confirm all non-L2 tasks are complete and each L2 scenario is either real-verified or handoff-blocked with evidence before marking the change archive-ready.
