## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/cron/prototype.html` is the active visual target and map its workflows to current Cron contract truth.
- [x] 1.2 Map every Cron prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Cron fixture creation through run-scoped disabled or far-future job create/update/delete, BFF cleanup, isolated state, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Cron implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `CronPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, job list/detail, scheduler status, history/payload/scheduler tabs, create/edit builder, delete confirmation, localized text, fixture, API facade, mutation-evidence, or cleanup guard drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for Cron list, status, runs, create, update, run, and delete.
- [x] 2.4 Preserve honest degraded or skipped-safe states for unsupported preview, durable audit, notification binding, retry policy, bulk action, or run-now evidence.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for job list/detail loading, search/filter/sort, scheduler status, create/edit builder, enable/disable, run-now affordance, delete confirmation, history/payload/scheduler tabs, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped Cron jobs, status, run history, mutation responses, and empty states.
- [x] 3.3 Update `cron-visual.spec.ts` to capture prototype-shaped workbench, selected-job detail, tab states, builder/edit/delete/run-now states, empty or error states, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Cron real Gateway E2E to create, update, verify, and delete a run-scoped disabled or far-future Cron fixture when the real Gateway supports it.
- [x] 4.2 Verify real route shapes for runtime readiness, Cron list, status, runs, create/update/delete when safe, skipped-safe run-now policy, and bounded cleanup.
- [x] 4.3 Verify shell navigation into Cron, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, search/filter/sort, selected detail tabs, builder/edit/delete dialogs, and skipped-safe run-now fallback with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Cleanup any run-scoped Cron fixture by deleting only jobs that include the current run id and refusing non-run-id cleanup targets.

## 5. Verification And Archive

- [x] 5.1 Run focused Cron unit/API tests.
- [x] 5.2 Run Cron mock visual E2E.
- [x] 5.3 Run Cron real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run mutation-evidence sync/check/test if Cron fixture-safe mutation status changes.
- [x] 5.6 Run `openspec validate deck-go-frontend-cron-prototype-parity-remediation --strict`.
- [x] 5.7 Update the head matrix and mark head task `6.4` complete only after verified evidence is recorded.
- [x] 5.8 Archive this child proposal after tasks complete.
