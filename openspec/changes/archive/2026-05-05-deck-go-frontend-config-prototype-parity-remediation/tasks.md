## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/config/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, backend routes, contract source files, or accepted prototype-only projections.
- [x] 1.3 Investigate safe real Config fixture creation through Deck BFF, Gateway RPC, isolated `openclaw.json`, or isolated workspace setup before accepting read-only/empty-state evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Config implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `ConfigPanel` against the active v2 prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic layout, pane, dialog, localized text, empty-state, read/write guard, or interaction drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for config snapshot, apply, and schema lookup.
- [x] 2.4 Preserve honest degraded states for `raw: null`, missing `baseHash`, prototype-only history, scaffold, import/export, rollback, and schema batching.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for section navigation, schema lookup, structured edits, raw JSON validation, sensitive reveal, reset, apply confirmation, conflict/read-only handling, localized copy, and empty/error states.
- [x] 3.2 Update mock fixture expectations if needed to provide representative top-level sections, leaf field types, secret fields, enums, arrays, and apply results.
- [x] 3.3 Update `config-visual.spec.ts` to capture prototype-shaped workbench, right-pane modes, sensitive reveal, apply confirmation, and localized theme variants.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `config-real-gateway.spec.ts` to attempt safe no-op or run-scoped Config fixture creation and attach fixture evidence or skipped-safe circuit-breaker evidence.
- [x] 4.2 Verify real route shapes for runtime readiness, `GET /api/config`, `POST /api/config/schema-lookup`, and bounded `POST /api/config/apply` only when writable raw/baseHash are available.
- [x] 4.3 Verify shell navigation into Config, dark/light, English/Chinese, section navigation, schema/form surfaces, right-pane/raw/read-only states, and dialogs or skipped-safe fallbacks with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Cleanup any run-scoped fixture by restoring the original safe snapshot or refusing non-run-id cleanup targets.

## 5. Verification And Archive

- [x] 5.1 Run focused Config unit/API tests.
- [x] 5.2 Run Config mock visual E2E.
- [x] 5.3 Run Config real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-config-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.7` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
