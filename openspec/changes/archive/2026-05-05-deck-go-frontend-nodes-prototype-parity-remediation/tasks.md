## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/nodes/prototype.html` is the active visual target and map its workflows to current Nodes/Gateway/BFF contract truth.
- [x] 1.2 Map every Nodes prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, dynamic-surface declarations, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through inventory, detail, pairing list, bounded route-shape checks, BFF-only cleanup, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Nodes implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `NodesPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, rail, selected detail, lifecycle, pairing, invoke, pending-work, localized text, fixture, API facade, mutation-evidence, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for node inventory, detail, rename, invoke, pending work, and pairing actions.
- [x] 2.4 Preserve honest dynamic-envelope, empty-valid, degraded, or skipped-safe states for command payloads, pending-work payloads, absent real nodes, and non-disposable device mutations.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for inventory, selection, pending pairing, orphan pairing, rename, approve/reject/request/verify confirmation, invoke JSON validation/result, pending enqueue, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped nodes, pairing requests, command payloads, pending-work results, and dynamic-envelope states.
- [x] 3.3 Update `nodes-visual.spec.ts` to capture prototype-shaped workbench, selected node, repair/orphan pairing, invoke result, pending-work result, confirmation gates, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Nodes real E2E to verify runtime readiness, node list/detail/pair list route shapes, bounded mutation route-shape outcomes, and unsupported/skipped-safe outcomes.
- [x] 4.2 Verify real route shapes for inventory, pairing list, describe, invoke, pending enqueue, pair request, approve, reject, and verify.
- [x] 4.3 Verify shell navigation into Nodes, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, selected-node or empty/degraded fallback, pairing surfaces, invoke/pending confirmation gates, and dynamic-envelope output behavior with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record empty-valid nodes or skipped-safe mutation evidence instead of fabricating real device data when the fresh stack lacks reversible node/pairing state.

## 5. Verification And Archive

- [x] 5.1 Run focused Nodes unit/API tests.
- [x] 5.2 Run Nodes mock visual E2E.
- [x] 5.3 Run Nodes real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-nodes-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.8` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
