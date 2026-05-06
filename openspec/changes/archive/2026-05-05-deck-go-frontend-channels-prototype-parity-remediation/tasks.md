## 1. Contract And Prototype Audit

- [x] 1.1 Confirm `frontend-handoff/modules/channels/prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- [x] 1.2 Map every prototype workflow to current wrappers, BFF routes, backend routes, contract source files, mutation-evidence rows, or accepted projections.
- [x] 1.3 Investigate safe real Channels fixture creation through Deck BFF, Gateway RPC, isolated `openclaw.json`, or workspace setup before accepting empty-state-only evidence.
- [x] 1.4 Record unsupported projections and real E2E fixture strategy in Channels implementation notes.

## 2. Production UI Remediation

- [x] 2.1 Compare current `ChannelsPanel` against the active v2 prototype and identify deterministic mismatches.
- [x] 2.2 Fix deterministic list/detail layout, tab, dialog, localized text, empty-state, or interaction drift that is supported by contract truth.
- [x] 2.3 Preserve existing BFF wrappers for inventory, probe, throughput, logout, channel patch, routing, and WeCom access.
- [x] 2.4 Preserve honest degraded states for throughput, create-channel, account diagnostics, WeCom projections, and unsafe provider mutations.
- [x] 2.5 Keep frontend code free of direct Gateway calls and inline styles.

## 3. Mock Evidence

- [x] 3.1 Update or confirm unit coverage for list search/filter, row selection, detail back navigation, tabs, settings save, routing handoff, WeCom access, disabled create, localized copy, and empty state.
- [x] 3.2 Update mock fixture expectations if needed to provide representative Telegram, Discord, WeCom, Slack, and plugin channel states.
- [x] 3.3 Update `channels-visual.spec.ts` to capture prototype-shaped list, detail, probe/settings/routing/WeCom states, dialogs or disabled create state, and localized light variant.
- [x] 3.4 Generate prototype-vs-current parity report and record pass or structured accepted exceptions.

## 4. Real Gateway Evidence

- [x] 4.1 Update `channels-real-gateway.spec.ts` to attempt safe run-scoped Channels fixture creation and attach fixture evidence or skipped-safe circuit-breaker evidence.
- [x] 4.2 Verify real route shapes for runtime readiness, `GET /api/channels`, `GET /api/channels/{id}/throughput`, direct typed `channels.status`, and skipped-safe mutation classifications.
- [x] 4.3 Verify shell navigation into Channels, dark/light, English/Chinese, search/filter, row/detail or empty fallback, tab interactions, and available dialogs or skipped-safe fallbacks with Playwright.
- [x] 4.4 Record unexpected console, page, BFF API, direct Gateway request, and direct Gateway websocket errors.
- [x] 4.5 Cleanup any run-scoped fixture by restoring the original safe snapshot or refusing non-run-id cleanup targets.

## 5. Verification And Archive

- [x] 5.1 Run focused Channels unit/API tests.
- [x] 5.2 Run Channels mock visual E2E.
- [x] 5.3 Run Channels real Gateway E2E with `DECK_GO_REAL_GATEWAY_E2E=1`, or circuit-break after bounded evidence.
- [x] 5.4 Run `make frontend-build`.
- [x] 5.5 Run `openspec validate deck-go-frontend-channels-prototype-parity-remediation --strict`.
- [x] 5.6 Update the head matrix and mark head task `5.6` complete only after verified evidence is recorded.
- [x] 5.7 Archive this child proposal after tasks complete.
