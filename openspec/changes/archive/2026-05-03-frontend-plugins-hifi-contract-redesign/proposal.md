## Why

Plugins is an existing Control panel backed by Deck's plugin inventory contract, but it still uses the old `deck-ui-plugins` global shell and reads like a dense raw inventory instead of a contract-led operator workbench. The module needs to join the high-fidelity rollout so operators can inspect plugin identity, origin, status, capabilities, related channel handoffs, activation evidence, diagnostics, and explicit lifecycle limitations without implying unsupported install/enable controls.

## What Changes

- Create a complete high-fidelity Plugins handoff package under `deck-go/frontend-handoff/modules/plugins/`.
- Redesign `deck-go/frontend-new/src/components/panels/plugins/` into a compact plugin inventory workbench:
  - plugin inventory rail with status, origin, enabled state, capability kinds, and related channel summary
  - selected plugin detail with identity, version, config path, capabilities, channel/provider/tool evidence, Deck action capability evidence, activation reason, diagnostics, and raw payload disclosure
  - capability scope switch for current `channel` and `all` inventory modes
  - cross-panel handoff actions to Channels, Channels access controls, and Routing only when the contract data supports them
  - deterministic loading, empty, error, ready, selection, scope switch, channel visibility warning, diagnostic, and handoff states
- Preserve the current frontend API wrapper behavior for `fetchPluginsWithCapability(capability)` and `fetchChannels()`; browser code continues to call the Go BFF routes only.
- Confirm deterministic mock/local visual E2E data for `GET /deck/plugins?capability=*` and channel status handoff context; fix only deterministic mock/local drift needed for visual coverage.
- Move obsolete global `deck-ui-plugins*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready plugin workspace, selected plugin detail, scope switch or handoff state, and diagnostic/channel-warning evidence where feasible.
- Update cross-module readiness evidence with Plugins-specific findings and inventory/detail/diagnostic/handoff molecule candidates.

## Capabilities

### New Capabilities

- `frontend-plugins-hifi-redesign`: Covers the Plugins handoff package, production UI rewrite, mock/local visual verification, and contract/drift findings for plugin inventory, capability scope, selected detail, diagnostics, channel handoffs, and lifecycle limitations.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Plugins implementation evidence and classifies whether plugin metric tiles, inventory rows, detail evidence surfaces, diagnostic surfaces, related-channel handoff strips, and raw payload disclosure remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/plugins/`
- `deck-go/frontend-new/src/components/panels/plugins/`
- `deck-go/frontend-new/src/theme.css` Plugins global styling removal or narrowing
- `deck-go/test/e2e/` focused Plugins mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-plugins-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
