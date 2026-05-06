## 1. Baseline And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, spec deltas, and `verification.yaml` before editing implementation files.
- [x] 1.2 Inspect `deck-go/frontend-handoff/modules/skills/README.md` and confirm whether the current package is a refreshed prototype, an already implemented hifi package, or stale status metadata.
- [x] 1.3 Smoke-test `deck-go/frontend-handoff/modules/skills/prototype.html` and record whether it loads without browser errors.
- [x] 1.4 Read the Skills handoff `app.jsx`, `data.js`, `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`.
- [x] 1.5 Read the archived `frontend-skills-hifi-contract-redesign` proposal/design/tasks/specs and current `openspec/specs/frontend-skills-hifi-redesign/spec.md`.
- [x] 1.6 Inspect current production Skills files under `deck-go/frontend-new/src/components/panels/skills/**`, `frontend-new/src/api.ts`, `deck-go/test/e2e/skills-visual.spec.ts`, and Skills-related Go backend routes/adapters.
- [x] 1.7 Capture baseline notes for production behavior, reusable code, known divergences, and unrelated worktree changes that must be preserved.

## 2. Real Gateway And BFF Capability Audit

- [x] 2.1 Inspect generated Gateway TS and Go artifacts for `skills.*` and `deck.agents.skills.*`.
- [x] 2.2 Inspect Gateway source/method definitions and result schemas for Skills, ClawHub, and agent skill matrix methods.
- [x] 2.3 Inspect real `gateway.describe` from a running real stack when available; if auth/runtime blocks access, record the blocker and continue with source/generated evidence.
- [x] 2.4 Inspect Deck endpoint classification, exception records, generated docs, and DTO authority for Skills-related rows.
- [x] 2.5 Inspect Go BFF `/skills`, `/skills/{skillKey}`, `/skills/install`, `/skills/hub`, `/deck/agents` skills actions, and runtime adapter behavior.
- [x] 2.6 Build a Skills capability matrix covering inventory, selection, missing requirements, enable/disable, config save, install option, ClawHub bins/search/detail/install/update, matrix read/write, agent navigation, authoring, credentials, and trust.
- [x] 2.7 Classify each workflow as `supported`, `degraded`, `unsupported`, `environment-dependent`, or `mutation-isolation-blocked`, with a product decision for degraded/unsupported behavior.

## 3. Contract Chain Calibration

- [x] 3.1 Compare Skills handoff mock data and UI assumptions with `DeckGoSkill*`, `DeckGoSkillHub*`, `DeckGoAgentSkills*`, and generated Gateway types.
- [x] 3.2 Decide which prototype surfaces are production DTOs, UI selectors, mock-only projections, or follow-ups.
- [x] 3.3 Compare `frontend-new/src/api.ts` Skills wrappers with Deck endpoint classification and Go route behavior.
- [x] 3.4 Inspect Go Skills BFF/adapters for normalization, error mapping, base-hash/config-hash behavior, and unsafe mutation assumptions.
- [x] 3.5 Fix deterministic DTO, endpoint classification, frontend wrapper, Go adapter, mock, or UI drift that is scoped to Skills and backed by real evidence.
- [x] 3.6 Regenerate generated artifacts only when a source contract changes, then run the matching check target.
- [x] 3.7 Update Skills handoff notes for unsupported prototype expectations that are not implemented or not real-verified.

## 4. Production Skills Implementation Pass

- [x] 4.1 Preserve the existing hifi-backed production Skills UI unless real-contract audit finds a deterministic scoped issue.
- [x] 4.2 Ensure safe read states render honestly when real Gateway returns empty, partial, unavailable, or network-sensitive Skills/ClawHub data.
- [x] 4.3 Ensure enable/disable, config save, install option, ClawHub install/update, and matrix write actions remain confirm/error-gated or documented as real-mutation blocked when isolation is absent.
- [x] 4.4 Add or update focused frontend/API/backend tests for any scoped code changes made by this proposal.
- [x] 4.5 Verify implementation fixes with the narrowest relevant test command before widening.
- [x] 4.6 Record backend or product gaps requiring upstream Gateway work, marketplace trust work, credential isolation, disposable state, or broad architecture changes as handoff items.

## 5. Mock Visual And Focused Tests

- [x] 5.1 Run or update focused Skills component/API tests for inventory, filters, selection, config, install, ClawHub, matrix, navigation, error, and empty states.
- [x] 5.2 Run or update the Skills mock visual Playwright E2E in the real `frontend-new` shell and label it as L1 mock visual coverage.
- [x] 5.3 Ensure mock visual E2E fails on unexpected `console.error`, `pageerror`, or API 4xx/5xx from mocked routes.

## 6. L2 Real Gateway Verification With Circuit Breaker

- [x] 6.1 Start or reuse the real stack with `deck-go/scripts/dev/run-stack-real.sh` or the Playwright real-stack helper and record runtime/auth readiness.
- [x] 6.2 Run the Skills real API smoke: runtime health, `gateway.describe`, typed Skills method availability, production `/skills`, and at least one safe read such as `skills.status` or `skills.bins`.
- [x] 6.3 Run the Skills real UI smoke: open the production Skills panel, render real or empty state, exercise a non-destructive interaction, and assert no unexpected API 4xx/5xx or page errors.
- [x] 6.4 Attempt safe reversible mutation verification only when disposable skill/config/agent state or equivalent isolation is available.
- [x] 6.5 For each real scenario, fix deterministic scoped code/contract defects and retry.
- [x] 6.6 Apply the circuit breaker after at most three fresh attempts per real scenario; mark unresolved environment, auth, marketplace, provider, mutation-isolation, or unclear Gateway failures as handoff-blocked with evidence.
- [x] 6.7 Update `verification.yaml` with pass, blocked, or skipped status for every L2 scenario.

## 7. Mandatory Code Review And Handoff Evidence

- [x] 7.1 Review `frontend-new/src/components/panels/skills/**` for raw Gateway/ClawHub/filesystem/package-manager access, unsupported mock-only fields, focus/a11y regressions, unsafe mutation behavior, and design-system drift.
- [x] 7.2 Review Skills API wrappers, Go route/adapters, contract sources/generation output, mocks, and E2E tests for scoped drift or unsafe passthroughs.
- [x] 7.3 Record review findings or an explicit no-finding statement with residual risks.
- [x] 7.4 Update `deck-go/frontend-handoff/modules/skills/implementation-notes.md` with visual divergences, product-contract decisions, backend fixes, real verification results, and handoff-blocked scenarios.
- [x] 7.5 Update any relevant design-system readiness or module status notes required by the implementation.

## 8. Final Verification And Archive Readiness

- [x] 8.1 Run `openspec validate frontend-skills-real-contract-verification --strict`.
- [x] 8.2 Run focused Skills frontend tests.
- [x] 8.3 Run focused Skills/backend adapter tests for touched Go packages.
- [x] 8.4 Run the Skills mock visual E2E.
- [x] 8.5 Run the relevant contract check target if any contract or generated artifact changed.
- [x] 8.6 Run `cd deck-go && make frontend-build`.
- [x] 8.7 Run `git diff --check`.
- [x] 8.8 Confirm all non-L2 tasks are complete and each L2 scenario is either real-verified or handoff-blocked with evidence before marking the change archive-ready.
