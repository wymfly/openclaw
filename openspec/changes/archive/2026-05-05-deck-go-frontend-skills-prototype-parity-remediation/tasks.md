## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/skills/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, Gateway RPC methods, or accepted projections.
- [x] 1.3 Record unsupported projections and real E2E fixture strategy in Skills implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Rework `SkillsPanel` into a prototype-shaped Installed/Hub list and skill detail product flow while preserving current contract calls.
- [x] 2.2 Keep configure, install, hub update, and agent skill matrix capabilities reachable without dominating the first viewport.
- [x] 2.3 Add Overview, Setup, Triggers, Bins, Files, and Audit detail tabs with explicit unavailable/projected states when contract data is missing.
- [x] 2.4 Update English and Chinese i18n strings for new list/detail/dialog surfaces.
- [x] 2.5 Keep frontend code free of direct Gateway, ClawHub, package-manager, filesystem calls, and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update unit coverage for Installed/Hub mode switching, search/filter/source filters, detail navigation, six tabs, dialogs, config save, hub actions, matrix visibility, and localized chrome.
- [x] 3.2 Update mock Gateway fixture data to provide representative installed skills, hub results, bins, details, setup, projected triggers/files/audit states, agent matrix data, and unavailable states.
- [x] 3.3 Update `skills-visual.spec.ts` to capture prototype-shaped list, detail, tabs, and dialogs.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `skills-real-gateway.spec.ts` to attempt safe run-scoped Skills fixture data through isolated workspace/config setup when provably safe.
- [x] 4.2 Ensure cleanup refuses non-run-id targets for any created workspace/config fixture.
- [x] 4.3 Verify shell navigation into Skills, dark/light, English/Chinese, installed search, detail tabs, Hub dialog/detail interaction when safe, and BFF-only browser transport with Playwright.
- [x] 4.4 Record skipped-safe or degraded write paths separately from read/UI pass/fail.

## 5. Verification And Archive

- [x] 5.1 Run focused Skills unit tests.
- [x] 5.2 Run Skills mock visual E2E.
- [x] 5.3 Run Skills real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-skills-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.3` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
