## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/subagents/prototype.html` is the active visual target and map its workflows to current Subagents/Gateway/BFF/config contract truth.
- [x] 1.2 Map every Subagents prototype workflow to current frontend API wrappers, Deck BFF routes, Gateway methods, source contracts, generated DTOs, mock fixtures, mutation evidence, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Gateway evidence through list, lineage, config get, invalid kill/steer, disposable run/config fixture attempts, BFF-only cleanup, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Subagents implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `SubagentsPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, dense run inventory, selected detail, permissions mode, dialog, lineage, raw/outcome, audit, localized text, fixture, API facade, mutation-evidence, or route drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for runs, lineage, kill, steer, per-agent subagent config get/set, and global defaults.
- [x] 2.4 Preserve honest empty-valid, degraded, hash-missing, not-found, skipped-safe, or accepted-exception states for empty runs, no lineage, no audit route, unsupported status taxonomy, and live-session mutations.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for runs, filters, selection, lineage, tabs, raw/outcome, permissions, permission save, steer, kill, navigation affordances, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide prototype-shaped dense runs, lineage, permissions, global defaults, steer/kill responses, and config-hash states.
- [x] 3.3 Update `subagents-visual.spec.ts` to capture dense workbench, selected run, lineage, permissions mode, permission edit, raw/outcome, audit degraded state, steer/kill dialogs, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Subagents real E2E to verify runtime readiness, route shapes, safe disposable run/config fixture or skipped-safe outcomes, and unsupported/degraded outcomes.
- [x] 4.2 Verify real route shapes for list, lineage, agents list, subagents.get, invalid kill, invalid steer, and hash/config-write safety.
- [x] 4.3 Verify shell navigation into Subagents, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, selected-run or empty/degraded fallback, permissions mode, detail tabs, dialogs, and raw/audit states with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Record empty-valid Subagents or skipped-safe mutation evidence instead of fabricating real active runs when the fresh stack lacks a disposable target.

## 5. Verification And Archive

- [x] 5.1 Run focused Subagents unit/API tests.
- [x] 5.2 Run Subagents mock visual E2E.
- [x] 5.3 Run Subagents real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-subagents-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.10` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
