## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/plugins/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, Gateway RPC methods, or accepted projections.
- [x] 1.3 Investigate whether representative real plugin inventory data can be safely seeded through isolated `openclaw.json`, isolated workspace plugin files, Gateway RPC, or Deck BFF.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Plugins implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Rework `PluginsPanel` into a prototype-shaped list/detail inventory flow while preserving current contract calls.
- [x] 2.2 Add Overview, Capabilities, Diagnostics, Activation, Manifest, and Audit detail tabs with explicit unavailable/projected states where contract data is missing.
- [x] 2.3 Add diagnostic detail, manifest preview, and raw inventory dialogs or equivalent read-only dialog surfaces.
- [x] 2.4 Preserve channel/routing/access handoffs where current contracts support them without implying plugin lifecycle mutations.
- [x] 2.5 Update English and Chinese i18n strings for new list/detail/dialog surfaces.
- [x] 2.6 Keep frontend code free of direct Gateway/plugin-runtime calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update unit coverage for list load, search/filter/scope switching, row-to-detail navigation, every detail tab, dialogs, channel handoffs, empty/no-match state, and localized chrome.
- [x] 3.2 Update mock Gateway fixture data if needed to provide representative populated list, diagnostics, channel handoff, all-scope, and empty/no-match states.
- [x] 3.3 Update `plugins-visual.spec.ts` to capture prototype-shaped list, detail, tabs, dialogs, scope switch, and localized variant.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `plugins-real-gateway.spec.ts` to attempt safe run-scoped plugin fixture data or record skipped-safe evidence with reason and attempted method.
- [x] 4.2 Ensure cleanup refuses non-run-id targets for any created config/workspace fixture.
- [x] 4.3 Verify shell navigation into Plugins, dark/light, English/Chinese, list filters, scope switching, detail tabs or empty-valid fallback, available dialogs, and BFF-only browser transport with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.

## 5. Verification And Archive

- [x] 5.1 Run focused Plugins unit tests.
- [x] 5.2 Run Plugins mock visual E2E.
- [x] 5.3 Run Plugins real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-plugins-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.4` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
