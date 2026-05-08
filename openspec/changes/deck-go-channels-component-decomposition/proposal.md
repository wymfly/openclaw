## Why

`deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx` has grown into a 1492-line mega-panel that mixes server-state orchestration, list/detail rendering, tab bodies, routing lookup, selectors, local parts, and dialogs. The channels module already has a v2 handoff skeleton and real contract calibration; decomposing the production panel now makes the next channels program steps reviewable without changing Gateway, BFF, contract, or Data Fabric behavior.

## What Changes

- Split `ChannelsPanel.tsx` into a thin orchestrator plus module-local `views/`, `tabs/`, `parts/`, `dialogs/`, `lib/`, `types.ts`, and fixtures under `deck-go/frontend-new/src/components/panels/channels/`.
- Move pure selector/helper logic such as channel/account normalization, diagnostic classification, filter matching, alert counts, and throughput summary reading into focused library code with tests.
- Extract pure presentation surfaces for list view, detail view, tabs, local metric/glyph/chart/badge parts, and test/logout dialogs.
- Keep `ChannelsPanel.tsx` as the single owner of top-level query/mutation/state wiring, selection, tab state, filters, routing fetch state, and navigation callbacks.
- Convert the current inline routing island into a pure `TabRouting` presentation component; routing query state and routing navigation callbacks remain in the orchestrator.
- Preserve the existing smart exceptions and their public behavior: `ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, and `WecomRoutingSummary`.
- Preserve current behavior and current visual target. This change is a maintainability decomposition, not a channel capability expansion or redesign.
- Do not implement `CreateChannelDialog`, channel creation, new Gateway RPCs, BFF routes, Data Fabric query keys, new shared design-system atoms, or Playwright pixel-diff infrastructure.

## Capabilities

### New Capabilities

- `deck-go-channels-component-decomposition`: Maintains the production channels panel as a decomposed, contract-preserving frontend module with explicit component/data boundaries, focused tests, and current visual smoke evidence.

### Modified Capabilities

- None. Existing channels high-fidelity, real-contract, and data-state capabilities remain behavior authorities; this change adds a structural maintainability capability without changing their product requirements.

## Impact

- Affected production frontend files:
  - `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.test.tsx`
  - new module-local files under `deck-go/frontend-new/src/components/panels/channels/{lib,views,tabs,parts,dialogs,__fixtures__}/`
- Existing smart component files remain in place and may be imported by bridge tabs without public interface changes:
  - `deck-go/frontend-new/src/components/panels/channels/ChannelSettingsEditor.tsx`
  - `deck-go/frontend-new/src/components/panels/channels/AccountDmPolicyEditor.tsx`
  - `deck-go/frontend-new/src/components/panels/channels/WecomAccessControls.tsx`
  - `deck-go/frontend-new/src/components/panels/channels/WecomRoutingSummary.tsx`
- Affected verification:
  - focused channels component/unit tests
  - `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/channels/`
  - `cd deck-go && make frontend-build`
  - `cd deck-go && pnpm exec playwright test test/e2e/channels-visual.spec.ts --config playwright.config.ts`
  - optional bounded real Gateway channels smoke when available
- Not affected:
  - Gateway protocol and OpenClaw upstream behavior
  - Deck Go backend routes/adapters
  - generated contract artifacts
  - Data Fabric query/mutation keys or wrapper signatures
  - shared design-system packages
