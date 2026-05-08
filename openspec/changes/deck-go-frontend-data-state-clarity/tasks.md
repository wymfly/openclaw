## 1. Baseline Audit

- [x] 1.1 Create a tracked audit note under `deck-go/frontend-handoff/audit/` covering all data-backed `frontend-new` panels, with columns for data source, query hook/query option, filter groups, selected filter policy, empty/error/loading/degraded states, and required fix. Evidence must cite current code paths.
- [x] 1.2 Mark `openspec/follow-ups/2026-05-08-frontend-filter-empty-state-audit.md` as promoted to this change, preserving the original facts and noting any corrected module scope.
- [x] 1.3 Identify panels that need no code changes because they already distinguish true-empty and filtered-empty with recovery; record the reason in the audit note instead of editing them.

## 2. Shared State Semantics

- [x] 2.1 Define the implementation convention for `first-load`, `refreshing`, `error-empty`, `error-stale`, `true-empty`, `filtered-empty`, `ready`, and `degraded` in code or a tracked frontend note; do not introduce a shared helper unless it demonstrably reduces repetition across changed modules.
- [x] 2.2 For every changed filter group, choose one of `derived options`, `counted stable options`, or `disabled zero-count options`; record the choice in the audit note and reflect it in tests.
- [x] 2.3 Ensure shared/list helper changes, if any, reuse existing `components/shared/lists` or design-system atoms rather than adding a new dependency or a parallel component library.

## 3. High-Risk Panel Fixes

- [x] 3.1 Preserve and extend the Plugins reference behavior: payload-derived capability filters must not expose impossible values for the current scope, and filtered-empty must offer recovery. Evidence: focused Plugins component test.
- [x] 3.2 Fix Skills list state: source/status filters must be payload-aware or counted, stale filters must not hide real skills silently, and empty states must distinguish no installed skills from filtered matches. Evidence: focused Skills component test.
- [x] 3.3 Fix Models list state: model filters must show counts or equivalent state, filtered-empty must show active criteria and clear recovery, and real configured models must not be hidden without explanation. Evidence: focused Models component test.
- [x] 3.4 Fix Channels list state: payload-specific filters such as WeCom must not be selectable when impossible, stable filters must be count-aware, and filtered-empty must be recoverable. Evidence: focused Channels component test.
- [x] 3.5 Fix Subagents list state across runs and permissions modes: no run history, no agents, and filtered-empty must be separate user-visible states. Evidence: focused Subagents component test.
- [x] 3.6 Fix Approvals queue state: no pending approvals, source-kind mismatch, and search-hidden approvals must render distinct copy and preserve a valid selected detail. Evidence: focused Approvals component test.
- [x] 3.7 Fix Budget, Alerts, Cron, and Webhooks config-list states: true-empty configuration and filtered-empty configuration must be visibly distinct, with clear-filter recovery where filters/search exist. Evidence: focused tests for every edited module.

## 4. Regression Tests And Browser Evidence

- [x] 4.1 Add or update component tests for all edited panels. Each test must assert visible user state, not only query success.
- [x] 4.2 Add a bounded mock browser smoke checklist or script for the affected panel set. It must navigate to each affected panel, apply at least one filter/search path, assert no indefinite loading, and assert clear recovery for filtered-empty where applicable.
- [x] 4.3 Run a real-stack smoke against the isolated real environment if available. Record API status, visible state, and row/empty reason for each affected panel. If real setup fails twice without new narrowing evidence, record circuit-breaker handoff instead of blocking deterministic closure.

## 5. Documentation And OpenSpec Closure

- [x] 5.1 Update the audit note with final per-panel status: `fixed`, `already-ok`, `empty-valid`, `degraded`, `deferred-uncertain`, or `follow-up-needed`.
- [x] 5.2 Update this change's `verification.yaml` with fresh scenario evidence before marking tasks complete.
- [x] 5.3 Run `openspec validate deck-go-frontend-data-state-clarity --strict` and do not check this task until validation passes.
- [x] 5.4 Run the narrow changed test set and `cd deck-go && make frontend-build`; do not check this task until both pass or an unrelated blocker is recorded with evidence.
- [x] 5.5 If implementation discovers a Gateway/BFF contract mismatch rather than a frontend list-state bug, create or update a follow-up in `openspec/follow-ups/` and keep this change scoped to frontend state clarity.
