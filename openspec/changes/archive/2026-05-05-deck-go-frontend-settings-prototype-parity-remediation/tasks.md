## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/settings/prototype.html` is the active visual target and older Settings prototypes are reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, backend routes, contract source files, or accepted projections.
- [x] 1.3 Investigate safe real Settings fixture creation through isolated `PUT /api/settings`, original-state restore, and run-scoped paired-device data.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Settings implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Rework `SettingsPanel` into a prototype-shaped topbar, searchable section rail, and right-side group renderer while preserving current contract calls.
- [x] 2.2 Add identity/access, runtime, appearance, notifications, paired devices, and version sections with read-only or unavailable states where current contracts require them.
- [x] 2.3 Add draft state, dirty counts, reset, save confirmation, save result, endpoint test, and safe dialog behavior.
- [x] 2.4 Preserve bundled read-only runtime semantics and remote endpoint editing through existing runtime endpoint wrappers.
- [x] 2.5 Update English and Chinese i18n strings for the new section, field, dialog, and unavailable-state surfaces.
- [x] 2.6 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update unit coverage for section rail search/switching, draft edit/reset/save, runtime endpoint safety, device dialog flow, no-match state, and localized chrome.
- [x] 3.2 Update mock fixture expectations if needed to provide representative settings, endpoint, version, pending devices, paired devices, and token-dialog states.
- [x] 3.3 Update `settings-visual.spec.ts` to capture prototype-shaped ready state, section interactions, save or confirm dialogs, token dialog, and localized light variant.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `settings-real-gateway.spec.ts` to create a safe run-scoped Settings fixture through isolated BFF/config state and attach evidence.
- [x] 4.2 Ensure cleanup restores the original safe Settings snapshot or refuses non-run-id cleanup targets.
- [x] 4.3 Verify shell navigation into Settings, dark/light, English/Chinese, section search, child section interactions, safe save/reset flow, and available dialogs or skipped-safe fallbacks with Playwright.
- [x] 4.4 Verify unsafe settings fields are rejected and destructive access-token/device-token mutations are recorded as skipped-safe, not executed.
- [x] 4.5 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.

## 5. Verification And Archive

- [x] 5.1 Run focused Settings unit tests.
- [x] 5.2 Run Settings mock visual E2E.
- [x] 5.3 Run Settings real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-settings-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.5` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
