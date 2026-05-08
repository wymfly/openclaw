## 1. Baseline And Guardrails

- [ ] 1.1 Re-read `proposal.md`, `design.md`, and `specs/deck-go-channels-component-decomposition/spec.md`; record the implementation scope as pure channels component decomposition with no contract, backend, Data Fabric key, or product capability change.
- [ ] 1.2 Re-check current code facts before editing: `ChannelsPanel.tsx` LOC, current `ChannelsPanel.test.tsx` scenario count, existing smart component public props, current `channels-visual.spec.ts` screenshot artifact list, and current routing/config wrapper paths.
- [ ] 1.3 Create or update `verification.yaml` scenario entries for structure, data-boundary, selector, component, visual, optional real, and OpenSpec validation evidence; keep all scenarios pending until fresh evidence exists.

## 2. Types, Fixtures, And Selectors

- [ ] 2.1 Add `types.ts` for shared channels module types such as `PanelState`, `ThroughputWindow`, `ChannelFilter`, `ChannelTabId`, normalized channel accounts, and channel inventory items.
- [ ] 2.2 Add `__fixtures__/channels.fixture.ts` with contract-shaped Telegram, Discord, WeCom, Slack, QQ/extension, empty, throughput, and routing fixtures without fabricating unsupported server-only fields.
- [ ] 2.3 Move deterministic helper logic into `lib/channel-selectors.ts`, covering channel/account normalization, diagnostic tone derivation, alert counts, filter matching, WeCom availability, and throughput summary derivation.
- [ ] 2.4 Add `lib/channel-selectors.test.ts` proving selector behavior for normal, degraded, true-empty, filtered-empty, WeCom, and throughput cases.

## 3. Parts And Dialogs

- [ ] 3.1 Extract module-local parts from current inline code: `ChannelGlyph`, `MetricTile`, `ChannelInventoryRow`, `ChannelProbeResultBadge`, and `ChannelThroughputChart`.
- [ ] 3.2 Add `parts/parts.test.tsx` covering glyph rendering, row selection, metric display, probe badge states, and throughput chart empty/non-empty states.
- [ ] 3.3 Extract `TestResultDialog` and `LogoutDialog` without adding `CreateChannelDialog` or changing confirmation semantics.
- [ ] 3.4 Add `dialogs/dialogs.test.tsx` covering test-result close behavior, logout cancel/confirm behavior, and busy/disabled behavior.

## 4. Tabs And Views

- [ ] 4.1 Extract `TabOverview`, `TabThroughput`, `TabProbe`, `TabSettings`, `TabRouting`, and `TabWeComAccess`, keeping `TabSettings` and `TabWeComAccess` as bridge tabs for existing smart components.
- [ ] 4.2 Ensure `TabRouting` is presentation-only: routing response, loading/error state, channel/account id, and `onOpenRouting` come from props; no Data Fabric/API/navigation imports are allowed inside `TabRouting`.
- [ ] 4.3 Add `tabs/tabs.test.tsx` covering overview metrics/actions, throughput empty/non-empty states, probe empty/result states, routing loading/error/empty/ready states, and bridge-tab rendering.
- [ ] 4.4 Extract `ChannelsListView` and `ChannelsDetailView`, preserving current list/detail behavior, filter/search recovery, tab switching, back behavior, action buttons, and WeCom-only tab gating.
- [ ] 4.5 Add `views/ChannelsListView.test.tsx` and `views/ChannelsDetailView.test.tsx` covering loading, error, true-empty, filtered-empty, clear filters, row select, hero/tabs/back/test/logout callbacks, and WeCom-only tab behavior.

## 5. Orchestrator Refactor

- [ ] 5.1 Refactor `ChannelsPanel.tsx` to wire the extracted selectors, views, tabs, parts, and dialogs while retaining ownership of channels inventory, throughput, routing, mutations, selection, tabs, filters, dialogs, and top-level errors.
- [ ] 5.2 Move routing query/state/navigation callback ownership into `ChannelsPanel.tsx` and pass only pure routing props into `TabRouting`.
- [ ] 5.3 Preserve existing smart component public interfaces and internal write paths for `ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, and `WecomRoutingSummary`.
- [ ] 5.4 Verify `ChannelsPanel.tsx` is at or below the 700-line hard gate, targeting 400-550 lines; if not, record the exact reason and follow-up before marking this task complete.
- [ ] 5.5 Run an import-boundary review proving newly extracted views/tabs/parts/dialogs do not import React Query, `data/modules/*`, `api.ts`, Gateway clients, or navigation stores, except through the explicit existing smart component exceptions.

## 6. Regression Verification

- [ ] 6.1 Run `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/channels/`; all existing panel scenarios and new focused tests must pass before this task is checked.
- [ ] 6.2 Run `cd deck-go && make frontend-build`; record fresh output in `verification.yaml` before this task is checked.
- [ ] 6.3 Run `cd deck-go && pnpm exec playwright test test/e2e/channels-visual.spec.ts --config playwright.config.ts`; verify the mock visual smoke passes and the seven current screenshot artifact states are produced without unexpected console/page/API errors.
- [ ] 6.4 Optionally run bounded real Gateway channels smoke with `DECK_GO_REAL_GATEWAY_E2E=1` or the matching deck-go real-module target when the real stack is available; safe read/UI paths may pass, unsafe mutation paths must be skipped-safe/deferred unless disposable state exists.

## 7. Closure

- [ ] 7.1 Update `verification.yaml` with final scenario statuses, fresh commands, evidence, skipped-safe/deferred real items, and `archiveReady` only when deterministic gates have passed.
- [ ] 7.2 Run `openspec validate deck-go-channels-component-decomposition --type change --strict`; do not check this task until validation passes.
- [ ] 7.3 Run or document any additional narrow verification required by touched files; if a deterministic code defect is discovered, fix it before closure.
- [ ] 7.4 If implementation reveals a product, contract, backend, visual-baseline, or design-system decision outside this change, record it under `openspec/follow-ups/` or current handoff notes rather than silently expanding scope.
