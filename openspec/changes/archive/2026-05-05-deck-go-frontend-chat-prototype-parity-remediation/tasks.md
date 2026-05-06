## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/chat/prototype.html` is the active visual target and document that it is reverse-derived from production.
- [x] 1.2 Map every prototype workflow to current chat wrappers, BFF routes, backend routes, stream contracts, contract source files, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Chat fixture creation through run-scoped session create/send/history/delete, BFF cleanup, isolated state, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Chat implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `ChatPanel` and child surfaces against the active handoff prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, sidebar, transcript, composer, right-drawer, approval, canvas, artifact, localized text, empty-state, cleanup guard, or interaction drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for sessions, history, send, steer, abort, compaction, command discovery, projection, canvas, media, approval, and stream subscription.
- [x] 2.4 Preserve honest degraded states for unavailable real approval expiration, durable a2ui typing, artifact projection, SSE replay, or model-response completion evidence.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for session list/detail loading, transcript block rendering, composer flows, keyboard traversal, filters/search, approval dialog, right drawer, artifact/canvas, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide rich and empty sessions, tool/thinking/result blocks, approvals, artifacts, canvas, compaction, and command palette states.
- [x] 3.3 Update `chat-visual.spec.ts` to capture prototype-shaped rich/empty workbench, keyboard flow, composer/menu states, approval/artifact/canvas states, unsupported/degraded states, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Add or update Chat real Gateway E2E to create or send a run-scoped session, inspect list/history/snapshot, and delete only run-scoped sessions.
- [x] 4.2 Verify real route shapes for runtime readiness, session list/history/snapshot, create or send, command discovery, stream reachability, and bounded cleanup.
- [x] 4.3 Verify shell navigation into Chat, all four dark/English, dark/Chinese, light/English, and light/Chinese variants, session sidebar, transcript, composer, search/filter, right-drawer/artifact/canvas/approval/compaction interactions or disabled/skipped-safe fallback with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Cleanup any run-scoped Chat fixture by deleting only sessions that include the current run id and refusing non-run-id cleanup targets.

## 5. Verification And Archive

- [x] 5.1 Run focused Chat unit/API tests.
- [x] 5.2 Run Chat mock visual E2E.
- [x] 5.3 Run Chat real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-chat-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `6.3` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
