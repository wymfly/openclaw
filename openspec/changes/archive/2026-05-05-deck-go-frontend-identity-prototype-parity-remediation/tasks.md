## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/identity/prototype.html` is the active visual target and map its workflows to current Identity/Gateway/BFF contract truth.
- [x] 1.2 Map every Identity prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through identity list, optional run-scoped link/unlink, agent identity, BFF-only cleanup, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Identity implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `IdentityPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, canonical rail, selected detail, link dialog, unsupported-state, localized text, fixture, API facade, mutation-evidence, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for identity list, link, unlink, and agent identity.
- [x] 2.4 Preserve honest projected, empty-valid, degraded, or skipped-safe states for create/rename/delete, peer activity, recent mutation audit, missing `configHash`, and unsafe real mutations.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for canonical inventory, search/selection, peer rows, raw payload, baseHash state, link dialog, link mutation, unsupported actions, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped Identity canonicals, peers, baseHash, link/unlink, agent identity, and empty states.
- [x] 3.3 Update `identity-visual.spec.ts` to capture prototype-shaped workbench, raw payload, link dialog, linked state, unsupported actions, empty/projection states, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Identity real E2E to verify runtime readiness, identity list, optional run-scoped link/unlink, agent identity, and unsupported/skipped-safe outcomes.
- [x] 4.2 Verify real route shapes for identity list, `configHash`, link/unlink fixture attempt and cleanup when available, agent identity, and no unsupported create/rename/delete contract.
- [x] 4.3 Verify shell navigation into Identity, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, canonical search/selection, raw payload, Link dialog, safe mutation or disabled fallback, unsupported actions, and projection/empty states with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record empty-valid identity or skipped-safe mutation evidence instead of fabricating real data when the fresh stack lacks reversible state.

## 5. Verification And Archive

- [x] 5.1 Run focused Identity unit/API tests.
- [x] 5.2 Run Identity mock visual E2E.
- [x] 5.3 Run Identity real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-identity-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.6` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
