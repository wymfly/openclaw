## Context

The channels module is currently implemented mostly inside `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx`. That file is 1492 lines and includes several responsibilities:

- channel inventory fetching, throughput fetching, routing fetching, and mutations;
- list/detail state, selected channel state, active tab state, filters, action state, and dialogs;
- selector/helper logic for account normalization, diagnostics, filter matching, counts, and throughput summaries;
- local presentation pieces such as glyphs, metric tiles, probe result badges, throughput charts, tab bodies, and dialogs;
- an inline routing panel that currently owns query/navigation behavior.

The product behavior is already governed by existing channels specs, contracts, and handoff artifacts. This change is not a new product capability. It is the first subproject in the channels program and creates stable component seams for later work such as WeCom pageization, per-channel UI registry, onboarding, and real throughput analytics.

The design authority order for this change is:

1. current `deck-go/frontend-new/src/components/panels/channels/` production code truth;
2. `deck-go/frontend-handoff/modules/channels/components.md` v2 production skeleton;
3. `deck-go/frontend-handoff/modules/channels/implementation-notes.md` contract calibration and accepted divergences;
4. legacy `dashboard/src/components/panels/channels/` only as historical reference, never as naming or structure authority.

Current contract facts that must stay true:

- frontend wrappers remain `fetchChannels`, `testChannel`, `logoutChannel`, `fetchChannelThroughput`, `patchChannelConfig`, `fetchDeckConfig`, `patchDeckConfig`, and `fetchRoutingBindings`;
- channels routing uses `/deck/routing`, not `/routing`;
- config patch uses `POST /config/patch`;
- `channels.config.patch` is `baseHashMode: backend-derived`; frontend `patchChannelConfig(channelId, patch)` does not pass `baseHash`;
- current mock visual smoke is `test/e2e/channels-visual.spec.ts`, which records seven screenshot artifacts via `page.screenshot()` and is not pixel-diff baseline infrastructure.

## Goals / Non-Goals

**Goals:**

- Decompose `ChannelsPanel.tsx` into a thin orchestrator and focused module-local components.
- Preserve the current product behavior, visual target, and contract-backed workflow semantics.
- Make selector/helper logic separately testable.
- Make list/detail/tabs/parts/dialogs separately renderable and testable with contract-shaped fixtures.
- Keep Data Fabric, API wrapper, Gateway, and navigation access out of newly extracted pure presentation components.
- Lift the current routing query/navigation responsibility into the orchestrator and expose a pure `TabRouting` component.
- Keep existing smart component exceptions explicit so implementation does not invent fake dumb props.
- Add focused tests and verification gates that prove behavior did not regress.

**Non-Goals:**

- No Gateway RPC, Deck BFF route, contract source, generated artifact, or Data Fabric key/signature change.
- No channel creation workflow or `CreateChannelDialog`; current contract lacks a first-class create-channel endpoint.
- No WeCom multi-page redesign, per-channel UI registry, onboarding wizard, or real throughput analytics.
- No public interface changes for `ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, or `WecomRoutingSummary`.
- No extraction of `RetryStrategyEditor` or `AllowFromEditor` into generic top-level parts.
- No new shared design-system atom/pattern and no module-local replacement for existing canonical atoms.
- No Playwright `toHaveScreenshot()` or pixel-diff visual baseline work.
- No handoff reverse sign-off status upgrade.

## Decisions

### 1. Use v2 skeleton plus production seams as the physical structure

The target structure is:

```text
panels/channels/
├── ChannelsPanel.tsx
├── ChannelsPanel.test.tsx
├── channels-panel.css
├── types.ts
├── lib/
│   ├── channel-selectors.ts
│   └── channel-selectors.test.ts
├── views/
│   ├── ChannelsListView.tsx
│   ├── ChannelsListView.test.tsx
│   ├── ChannelsDetailView.tsx
│   └── ChannelsDetailView.test.tsx
├── tabs/
│   ├── TabOverview.tsx
│   ├── TabThroughput.tsx
│   ├── TabProbe.tsx
│   ├── TabSettings.tsx
│   ├── TabRouting.tsx
│   ├── TabWeComAccess.tsx
│   └── tabs.test.tsx
├── parts/
│   ├── ChannelGlyph.tsx
│   ├── ChannelInventoryRow.tsx
│   ├── ChannelProbeResultBadge.tsx
│   ├── ChannelThroughputChart.tsx
│   ├── MetricTile.tsx
│   └── parts.test.tsx
├── dialogs/
│   ├── TestResultDialog.tsx
│   ├── LogoutDialog.tsx
│   └── dialogs.test.tsx
└── __fixtures__/
    └── channels.fixture.ts
```

Rationale: this matches the current deck-go handoff skeleton and the natural blocks already present in production code. Legacy dashboard names are rejected as the primary structure because `deck-go/AGENTS.md` explicitly says not to copy legacy dashboard implementation details for parity.

### 2. Keep `ChannelsPanel.tsx` as the orchestrator

`ChannelsPanel.tsx` remains responsible for:

- `channelsListQueryOptions`, `channelThroughputQueryOptions`, and `routingBindingsQueryOptions`;
- `useTestChannelMutation`, `useLogoutChannelMutation`, and `usePatchChannelConfigMutation`;
- selected channel, active tab, filters, throughput window, dialog, and action state;
- refresh behavior, mutation calls, and top-level error handling;
- routing navigation callbacks and plugin navigation callbacks.

Newly extracted `views/`, `tabs/`, `parts/`, and `dialogs/` receive data and callbacks by props. They must not import React Query, Data Fabric modules, `api.ts`, Gateway clients, or navigation stores. Existing smart components are the only intentional exception.

### 3. Preserve smart component exceptions

`ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, and `WecomRoutingSummary` stay in place. `TabSettings` and `TabWeComAccess` may act as bridge tabs that compose these existing smart components.

Rationale: current code truth shows these files own internal mutation/draft state. Forcing them into dumb props in this change would expand scope and risk changing product behavior. Their future internal decomposition is a follow-up, not part of this #1 change.

### 4. Move routing query and navigation out of `TabRouting`

The current inline `ChannelRoutingPanel` is smart. After decomposition, routing data loading and `navigateToRouting` remain in `ChannelsPanel.tsx`, while `TabRouting` only renders routing loading/error/empty/ready state and exposes `onOpenRouting`.

Rationale: this preserves the new-component boundary rule and prevents a second smart island from forming inside the tabs directory.

### 5. Extract selectors before broad rendering movement

Selector/helper code should move to `lib/channel-selectors.ts` before or alongside rendering extraction. The target helper coverage includes channel/account normalization, diagnostic classification, alert counts, filter matching, WeCom filter availability, and throughput summary derivation.

Rationale: selector extraction gives a stable fixture model for view/tabs tests and reduces the risk of behavior drift while moving JSX.

### 6. Keep visual and product behavior stable

No visual redesign is planned. Class names and CSS may move only as needed for component extraction. Existing mock visual smoke should still produce the seven current screenshot artifacts. This change must not claim pixel-level diff coverage because that infrastructure does not exist today.

### 7. Treat real Gateway verification as bounded and safe

Real Gateway channels verification is useful but not mandatory for this structural change. Safe read/UI smoke may be run when the real stack is available. Unsafe provider mutation flows such as logout or config patch require disposable/reversible state; otherwise they should be marked skipped-safe/deferred in verification evidence.

## Risks / Trade-offs

- Dashboard drift risk -> mitigated by explicitly using v2 handoff skeleton plus production code truth as authority.
- Smart/dumb boundary drift -> mitigated by import review for new views/tabs/parts/dialogs and explicit smart component exceptions.
- Behavior regression during JSX movement -> mitigated by preserving existing `ChannelsPanel.test.tsx` scenarios and adding focused tests for extracted pieces.
- Routing functionality split incorrectly -> mitigated by requiring routing query/state/navigation to stay in `ChannelsPanel.tsx` and testing `TabRouting` as pure UI.
- Over-claiming visual fidelity -> mitigated by requiring current visual smoke artifacts only, with pixel-diff infrastructure left as follow-up.
- Mistaken baseHash semantics -> mitigated by preserving `patchChannelConfig(channelId, patch)` and documenting `channels.config.patch` as backend-derived baseHash.
- File churn in a dirty workspace -> implementation must touch only channels module files and related tests/evidence for this change, preserving unrelated user/agent changes.

## Migration Plan

1. Build shared channel types and selector fixtures first.
2. Move helper logic into `lib/channel-selectors.ts` with focused tests.
3. Extract module-local parts and dialogs with tests.
4. Extract tabs, keeping bridge tabs for existing smart components.
5. Extract list/detail views and wire them through `ChannelsPanel.tsx`.
6. Reduce `ChannelsPanel.tsx` to orchestrator responsibilities and keep it under the reviewability gate.
7. Run focused tests, frontend build, mock visual smoke, and optional real safe smoke.

Rollback is frontend-only: revert the extracted files and restore the previous `ChannelsPanel.tsx` implementation. No contract/backend/generated artifact rollback is expected because those surfaces are out of scope.

## Open Questions

- None blocking proposal creation.
- Follow-up candidates are explicitly outside this change: WeCom pageization, per-channel registry, onboarding wizard, real throughput analytics, `CreateChannelDialog`, smart editor internal decomposition, canonical modal, and pixel-diff baseline infrastructure.
