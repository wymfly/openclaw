## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/routing/prototype.html` is the active visual target and map its workflows to current Routing/Gateway/BFF/config contract truth.
- [x] 1.2 Map every Routing prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, mutation evidence, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through list, validate, simulate, add/remove fixture, BFF-only cleanup, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Routing implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `RoutingPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, queue, selected detail, draft, simulator, activity, config hash, localized text, fixture, API facade, mutation-evidence, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for routing list, validate, add, remove, simulate, DM scope patch, and activity.
- [x] 2.4 Preserve honest empty-valid, degraded, hash-mismatch, skipped-safe, or accepted-exception states for empty routing config, activity gaps, reorder workaround, and persistent config mutations.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for list, filters, selection, draft add/validate, remove, move, DM scope patch, simulate, activity, navigation affordances, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped bindings, conflicts, activity, simulation tiers, hash mutation, and config-scope states.
- [x] 3.3 Update `routing-visual.spec.ts` to capture prototype-shaped workbench, selected binding, add draft, remove confirmation, DM scope confirmation, simulation result, activity, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Routing real E2E to verify runtime readiness, route shapes, safe run-scoped add/remove fixture or skipped-safe outcomes, and unsupported/degraded outcomes.
- [x] 4.2 Verify real route shapes for list, validate, simulate, add, remove, invalid/hash mismatch, and config-scope patch safety.
- [x] 4.3 Verify shell navigation into Routing, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, selected-binding or empty/degraded fallback, add/remove/scope confirmation gates, simulator, activity, and hash evidence with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record empty-valid routing or skipped-safe mutation evidence instead of fabricating real config data when the fresh stack lacks reversible routing state.

## 5. Verification And Archive

- [x] 5.1 Run focused Routing unit/API tests.
- [x] 5.2 Run Routing mock visual E2E.
- [x] 5.3 Run Routing real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-routing-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.9` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
