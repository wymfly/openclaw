## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/threads/prototype.html` is the active visual target and map its workflows to current Threads/Gateway/BFF contract truth.
- [x] 1.2 Map every Threads prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through list/filter route shapes, BFF-only cleanup, empty-valid rows, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Threads implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `ThreadsPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, dense inventory, selected detail, filters, copy feedback, raw payload, localized text, fixture, API facade, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrapper for `GET /api/deck/threads` and local detail/copy/navigation behavior.
- [x] 2.4 Preserve honest empty-valid, skipped-safe, or accepted-exception states for empty real bindings, mutation gaps, activity gaps, audit gaps, transcript gaps, and branch gaps.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for list, filters, selection, relation detail, copy, navigation affordances, localized copy, raw payload, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped dense thread bindings across channel kinds, target kinds, stale rows, labels, and bound-by variants.
- [x] 3.3 Update `threads-visual.spec.ts` to capture dense workbench, selected detail, filter states, copy feedback, raw payload, localized theme variants, and unsupported accepted exceptions.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Threads real E2E to verify runtime readiness, route shapes, real rows or empty-valid fallback, and unsupported/skipped-safe outcomes.
- [x] 4.2 Verify real route shapes for list, filtered list, invalid/unsupported mutation absence, and empty-valid payloads.
- [x] 4.3 Verify shell navigation into Threads, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, selected-thread or empty fallback, copy/raw/detail interactions, and filter behavior with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record skipped-safe mutation/activity/audit evidence instead of fabricating real thread data when the fresh stack lacks a disposable target.

## 5. Verification And Archive

- [x] 5.1 Run focused Threads unit/API tests.
- [x] 5.2 Run Threads mock visual E2E.
- [x] 5.3 Run Threads real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-threads-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.11` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
