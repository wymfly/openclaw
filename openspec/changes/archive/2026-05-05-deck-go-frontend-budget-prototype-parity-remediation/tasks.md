## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/budget/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, backend routes, contract source files, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Budget fixture creation through run-scoped create, patch, evaluate, delete, BFF cleanup, isolated state, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Budget implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `BudgetPanel` against the active v2 prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, filter, selected-detail, threshold-meter, form/dialog, localized text, empty-state, cleanup guard, or interaction drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for budget list, evaluate, create, update/toggle, and delete.
- [x] 2.4 Preserve honest degraded states for unavailable durable recent changes, forecast, history charts, wider scopes/periods, and notification binding.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for list/detail loading, search, status filters, threshold summary, create/edit/toggle/delete flows, validation, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide representative rules, dimensions, scopes, periods, enabled/disabled states, ok/warn/over evaluations, and CRUD dialog states.
- [x] 3.3 Update `budget-visual.spec.ts` to capture prototype-shaped list/detail, filters, create/edit/toggle/delete/validation states, unsupported/degraded states, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `budget-real-gateway.spec.ts` to create, patch, evaluate, and delete run-scoped budget-rule fixtures and attach fixture evidence or skipped-safe circuit-breaker evidence.
- [x] 4.2 Verify real route shapes for runtime readiness, `GET /api/usage/budget`, `GET /api/usage/budget/evaluate`, `POST /api/usage/budget`, `PATCH /api/usage/budget/{id}`, and bounded `DELETE /api/usage/budget/{id}` only for run-scoped rules.
- [x] 4.3 Verify shell navigation into Budget, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, search, status filters, selected detail, create/edit/toggle/delete/validation interactions or disabled/skipped-safe fallback with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Cleanup any run-scoped budget fixture by deleting only rules that include the current run id and refusing non-run-id cleanup targets.

## 5. Verification And Archive

- [x] 5.1 Run focused Budget unit/API tests.
- [x] 5.2 Run Budget mock visual E2E.
- [x] 5.3 Run Budget real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-budget-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.2` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
