## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/usage/prototype.html` is the active visual target and map its workflows to current Usage/Gateway/BFF contract truth.
- [x] 1.2 Map every Usage prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through cost/provider/session/log/timeseries route shapes, BFF-only checks, empty-valid rows, or skipped-safe circuit breaker before accepting sparse evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Usage implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `UsagePanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, cost trend, provider quota, session inventory, detail tabs, local controls, localized text, fixture, API facade, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for `GET /api/usage/cost`, `GET /api/usage/providers`, `GET /api/usage/sessions`, `GET /api/usage/sessions/logs`, and `GET /api/usage/timeseries`.
- [x] 2.4 Preserve honest empty-valid, skipped-safe, or accepted-exception states for sparse real data, billing accuracy, forecasts, tenant accounting, quota mutation, and dependency-gated chart fidelity.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for cost KPIs, range switching, provider quota, search/filter/sort, session expansion, logs/timeseries/context tabs, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped dense Usage data across cost days, providers, sessions, models, agents, channels, logs, and timeseries.
- [x] 3.3 Update `usage-visual.spec.ts` to capture cost cockpit, trend states, provider quota, session table, detail tabs, localized theme variants, and unsupported accepted exceptions.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Usage real E2E to verify runtime readiness, route shapes, real rows or empty-valid fallback, and unsupported/skipped-safe outcomes.
- [x] 4.2 Verify real route shapes for cost, providers, sessions, logs/timeseries when a session key exists, and legacy read-only aliases.
- [x] 4.3 Verify shell navigation into Usage, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, selected-session or empty fallback, provider selection, and filter behavior with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record skipped-safe billing accuracy, tenant accounting, forecast, and quota-mutation evidence instead of fabricating unsupported Usage semantics.

## 5. Verification And Archive

- [x] 5.1 Run focused Usage unit/API tests.
- [x] 5.2 Run Usage mock visual E2E.
- [x] 5.3 Run Usage real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-usage-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.12` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
