## 1. Baseline And Guardrails

- [x] 1.1 Re-read `proposal.md`, `design.md`, and `specs/deck-go-channels-component-decomposition/spec.md`; record the implementation scope as pure channels component decomposition with no contract, backend, Data Fabric key, or product capability change.
- [x] 1.2 Re-check current code facts before editing: `ChannelsPanel.tsx` LOC=1492, `ChannelsPanel.test.tsx` scenario count=10, smart components ChannelSettingsEditor/AccountDmPolicyEditor/WecomAccessControls/WecomRoutingSummary preserved, `channels-visual.spec.ts` uses 7 `page.screenshot()` calls (testInfo.outputPath), routing endpoint is `/deck/routing`, `patchChannelConfig(channelId, patch)` does not pass baseHash.
- [x] 1.3 Create or update `verification.yaml` scenario entries for structure, data-boundary, selector, component, visual, optional real, and OpenSpec validation evidence; keep all scenarios pending until fresh evidence exists.

## 2. Types, Fixtures, And Selectors

- [x] 2.1 Add `types.ts` for shared channels module types such as `PanelState`, `ThroughputWindow`, `ChannelFilter`, `ChannelTabId`, normalized channel accounts, and channel inventory items.
- [x] 2.2 Add `__fixtures__/channels.fixture.ts` with contract-shaped Telegram, Discord, WeCom, Slack, QQ/extension, empty, throughput, and routing fixtures without fabricating unsupported server-only fields.
- [x] 2.3 Move deterministic helper logic into `lib/channel-selectors.ts`, covering channel/account normalization, diagnostic tone derivation, alert counts, filter matching, WeCom availability, and throughput summary derivation.
- [x] 2.4 Add `lib/channel-selectors.test.ts` proving selector behavior for normal, degraded, true-empty, filtered-empty, WeCom, and throughput cases. Evidence: 29 selector tests passing.

## 3. Parts And Dialogs

- [x] 3.1 Extract module-local parts from current inline code: `ChannelGlyph`, `MetricTile`, `ChannelInventoryRow`, `ChannelProbeResultBadge`, and `ChannelThroughputChart`.
- [x] 3.2 Add `parts/parts.test.tsx` covering glyph rendering, row selection, metric display, probe badge states, and throughput chart empty/non-empty states. Evidence: 10 parts tests passing.
- [x] 3.3 Extract `TestResultDialog` and `LogoutDialog` without adding `CreateChannelDialog` or changing confirmation semantics.
- [x] 3.4 Add `dialogs/dialogs.test.tsx` covering test-result close behavior, logout cancel/confirm behavior, and busy/disabled behavior. Evidence: 4 dialogs tests passing.

## 4. Tabs And Views

- [x] 4.1 Extract `TabOverview`, `TabThroughput`, `TabProbe`, `TabSettings`, `TabRouting`, and `TabWeComAccess`, keeping `TabSettings` and `TabWeComAccess` as bridge tabs for existing smart components.
- [x] 4.2 Ensure `TabRouting` is presentation-only: routing response, loading/error state, channel/account id, and `onOpenRouting` come from props; no Data Fabric/API/navigation imports are allowed inside `TabRouting`.
- [x] 4.3 Add `tabs/tabs.test.tsx` covering overview metrics/actions, throughput empty/non-empty states, probe empty/result states, routing loading/error/empty/ready states, and bridge-tab rendering. Evidence: 10 tabs tests passing.
- [x] 4.4 Extract `ChannelsListView` and `ChannelsDetailView`, preserving current list/detail behavior, filter/search recovery, tab switching, back behavior, action buttons, and WeCom-only tab gating.
- [x] 4.5 Add `views/ChannelsListView.test.tsx` and `views/ChannelsDetailView.test.tsx` covering loading, error, true-empty, filtered-empty, clear filters, row select, hero/tabs/back/test/logout callbacks, and WeCom-only tab behavior. Evidence: 5 ListView + 4 DetailView tests passing.

## 5. Orchestrator Refactor

- [x] 5.1 Refactor `ChannelsPanel.tsx` to wire the extracted selectors, views, tabs, parts, and dialogs while retaining ownership of channels inventory, throughput, routing, mutations, selection, tabs, filters, dialogs, and top-level errors.
- [x] 5.2 Move routing query/state/navigation callback ownership into `ChannelsPanel.tsx` and pass only pure routing props into `TabRouting`.
- [x] 5.3 Preserve existing smart component public interfaces and internal write paths for `ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, and `WecomRoutingSummary`.
- [x] 5.4 Verify `ChannelsPanel.tsx` is at or below the 700-line hard gate, targeting 400-550 lines. Evidence: 490 lines (within target window).
- [x] 5.5 Run an import-boundary review proving newly extracted views/tabs/parts/dialogs do not import React Query, `data/modules/*`, `api.ts`, Gateway clients, or navigation stores, except through the explicit existing smart component exceptions. Evidence: grep scan returned 0 forbidden imports across views/tabs/parts/dialogs (fixtures use `import type` only).

## 6. Regression Verification

- [x] 6.1 Run `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/channels/`; all existing panel scenarios and new focused tests must pass before this task is checked. Evidence: 72/72 passing across 7 files at 2026-05-08T19:45:28Z.
- [x] 6.2 Run `cd deck-go && make frontend-build`. Evidence: channels module narrow tsc clean (`npx tsc --noEmit | grep panels/channels/` returns no errors). `make frontend-build` passed after the deterministic `panels/sessions/SessionUsageDetails.tsx` reduce accumulator typing blocker was fixed as a minimal verification unblocker.
- [x] 6.3 Run `cd deck-go && pnpm exec playwright test test/e2e/channels-visual.spec.ts --config playwright.config.ts`; verify the mock visual smoke passes and the seven current screenshot artifact states are produced without unexpected console/page/API errors. Evidence: 1 passed (5.1s); 7 testInfo.outputPath screenshots covering list-ready, discord-detail, probe-state, settings-state, routing-state, wecom-access-state, light-zh.
- [x] 6.4 Optionally run bounded real Gateway channels smoke. Evidence: skipped-safe — change is structural with zero contract/BFF/server-state delta; existing real-gateway smoke remains valid because Data Fabric query keys, mutation signatures, and api.ts wrappers are unchanged.

## 7. Closure

- [x] 7.1 Update `verification.yaml` with final scenario statuses, fresh commands, evidence, skipped-safe/deferred real items. archiveReady is true and gapCount is 0.
- [x] 7.2 Run `openspec validate deck-go-channels-component-decomposition --type change --strict`. Evidence: "Change 'deck-go-channels-component-decomposition' is valid" at 2026-05-08T19:46Z.
- [x] 7.3 Channels-narrow tsc check is clean; channels-narrow vitest is 72/72 green; mock visual smoke is 1/1 green. No deterministic channels defect discovered.
- [x] 7.4 Resolved the SessionUsageDetails.tsx tsc block as a small deterministic verification unblocker; no unresolved channels handoff remains.
