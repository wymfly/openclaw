## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/gateway/prototype.html` is the active visual target and map its workflows to current Gateway/runtime/monitor contract truth.
- [x] 1.2 Map every Gateway prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through health/status/describe, read-only `gateway.describe` batch, activity/monitor projections, BFF-only cleanup-free data, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Gateway implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `GatewayPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, runtime state, describe explorer, batch console, activity/projection, localized text, fixture, API facade, batch-gating, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for runtime summary, capabilities, Gateway health/status/describe/batch, activity, monitor runs, and monitor stats.
- [x] 2.4 Preserve honest projected, empty-valid, degraded, or skipped-safe states for unsupported throughput streaming, durable audit, remote batch, lifecycle controls, mutating batch, and non-empty monitor history.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for runtime/health/status metrics, channel and heartbeat rails, describe search/filter/detail, batch console, safe batch result, activity/projection tabs, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped Gateway health/status/describe, batch, activity, monitor, and empty states.
- [x] 3.3 Update `gateway-visual.spec.ts` to capture prototype-shaped workbench, describe explorer, batch console, activity/projection states, remote/locked or skipped-safe states where available, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Gateway real E2E to verify health/status/describe, read-only batch, activity, monitor runs, monitor stats, and selected monitor detail when available.
- [x] 4.2 Verify real route shapes for runtime readiness, capabilities, health, status, describe, read-only `gateway.describe` batch, activity/monitor projections, skipped-safe mutating batch, and no lifecycle controls.
- [x] 4.3 Verify shell navigation into Gateway, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, describe search/scope/detail, Batch console, Activity/projection tabs, and read-only batch or disabled fallback with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record empty-valid monitor/activity projection evidence instead of fabricating real data when the fresh stack has no runs.

## 5. Verification And Archive

- [x] 5.1 Run focused Gateway unit/API tests.
- [x] 5.2 Run Gateway mock visual E2E.
- [x] 5.3 Run Gateway real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-gateway-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.5` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
