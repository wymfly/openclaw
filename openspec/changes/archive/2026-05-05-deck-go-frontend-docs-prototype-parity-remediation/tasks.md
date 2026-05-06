## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/docs/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, backend routes, contract source files, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Docs fixture creation through run-scoped chat seed, `POST /api/docs/extract`, BFF deletion cleanup, isolated workspace, or skipped-safe circuit breaker before accepting empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Docs implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `DocsPanel` against the active v2 prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, reader, search, keyword, extract/delete, localized text, empty-state, cleanup guard, or interaction drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for docs list, detail, extract, and delete.
- [x] 2.4 Preserve honest degraded states for unavailable active session, empty extraction, 404 detail/delete, server-side search, inline edit, soft archive, audit feed, internal markdown routing, and richer markdown rendering.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for list/detail loading, search overlay, keyword filtering, category navigation, related docs, outline, source navigation, extract popover, delete confirmation, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide representative docs, categories, related docs, markdown content, active session extraction, and delete states.
- [x] 3.3 Update `docs-visual.spec.ts` to capture prototype-shaped reader, search overlay, keyword filter, extract popover, delete confirmation, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `docs-real-gateway.spec.ts` to attempt run-scoped chat-to-doc extraction and attach fixture evidence or skipped-safe circuit-breaker evidence.
- [x] 4.2 Verify real route shapes for runtime readiness, `GET /api/docs`, `GET /api/docs/{id}` or documented 404 fallback, `POST /api/docs/extract`, and bounded `DELETE /api/docs/{id}` only for run-scoped docs.
- [x] 4.3 Verify shell navigation into Docs, dark/light, English/Chinese, category navigation, search, keyword/outline/related/source surfaces, extract popover or disabled fallback, and delete confirmation/skipped-safe fallback with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Cleanup any run-scoped doc fixture by deleting only docs that include the current run id and refusing non-run-id cleanup targets.

## 5. Verification And Archive

- [x] 5.1 Run focused Docs unit/API tests.
- [x] 5.2 Run Docs mock visual E2E.
- [x] 5.3 Run Docs real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-docs-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.8` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
