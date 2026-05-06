## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/memory/prototype.html` is the active visual target and map its workflows to current Memory/Gateway/BFF contract truth.
- [x] 1.2 Map every Memory prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through browse/read/search/health/dreams read, BFF-only cleanup, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Memory implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `MemoryPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, tab, browse tree, viewer, search, health, dreams, localized text, fixture, API facade, mutation-evidence, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for memory browse/read/search/health/dreams.
- [x] 2.4 Preserve honest degraded, empty-valid, or skipped-safe states for LanceDB search absence, missing memory files, per-agent dreams gaps, and destructive dream actions.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for Browse, directory expansion, file read, Search, degraded search, Health, Dreams, dream action result, destructive confirmation, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped memory tree, file content, health, search, dreams, and degraded states.
- [x] 3.3 Update `memory-visual.spec.ts` to capture prototype-shaped workbench, file read, degraded search, health, dreams, destructive confirmation, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Memory real E2E to verify runtime readiness, browse/read/search/health/dreams read, and unsupported/skipped-safe outcomes.
- [x] 4.2 Verify real route shapes for browse/read availability or absence, canonical POST search, compatibility GET search, health, dream read, and skipped-safe destructive actions.
- [x] 4.3 Verify shell navigation into Memory, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, Browse, Search, Health, Dreams, safe read or degraded fallback, confirmation-gated dream actions, and empty/degraded states with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record empty-valid memory or skipped-safe mutation evidence instead of fabricating real data when the fresh stack lacks reversible state.

## 5. Verification And Archive

- [x] 5.1 Run focused Memory unit/API tests.
- [x] 5.2 Run Memory mock visual E2E.
- [x] 5.3 Run Memory real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-memory-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.7` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
