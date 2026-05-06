## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/models/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, Gateway RPC methods, or accepted projections.
- [x] 1.3 Record unsupported projections and real E2E fixture strategy in Models implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Rework `ModelsPanel` into a prototype-shaped model list/detail/dialog product flow while preserving current contract calls.
- [x] 2.2 Keep advanced raw config, provider config, fallback, allowlist, catalog apply, and probe actions available without dominating the first viewport.
- [x] 2.3 Update English and Chinese i18n strings for new list/detail/dialog surfaces.
- [x] 2.4 Keep frontend code free of direct Gateway-origin browser calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update unit coverage for list/detail navigation, filters/search, tabs, dialogs, raw config save, catalog apply, and localized chrome.
- [x] 3.2 Update mock Gateway fixture data to provide representative model, provider, catalog, auth, probe, usage, and projected unavailable states.
- [x] 3.3 Update `models-visual.spec.ts` to capture prototype-shaped list, detail, tabs, and dialogs.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `models-real-gateway.spec.ts` to create run-scoped Models fixture data through the isolated real `/models/config` route when safe.
- [x] 4.2 Ensure cleanup refuses non-run-id targets and removes only the run-scoped provider/model/default references.
- [x] 4.3 Verify shell navigation into Models, dark/light, English/Chinese, run-scoped model search/detail/tabs/dialog interaction, and BFF-only browser transport with Playwright.
- [x] 4.4 Record bounded runtime RPC degradation separately from UI/config fixture pass/fail.

## 5. Verification And Archive

- [x] 5.1 Run focused Models unit tests.
- [x] 5.2 Run Models mock visual E2E.
- [x] 5.3 Run Models real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-models-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.2` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
