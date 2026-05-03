## Why

Channels is the next non-chat configuration module after agents/routing/subagents/logs/settings/sessions. It already exercises a broad Deck BFF contract surface for channel status, account diagnostics, probe testing, throughput, logout, generic channel patching, WeCom access controls, and routing handoff, but it still renders through the old `deck-ui-channels` global shell.

This change applies the contract-led high-fidelity workflow to the channels module so visual design converges with the settled design system while preserving deterministic BFF/API behavior. Uncertain WeCom or Gateway semantics should be documented as handoff follow-up rather than invented in the frontend.

## What Changes

- Create a complete high-fidelity channels handoff package under `deck-go/frontend-handoff/modules/channels/`.
- Redesign `deck-go/frontend-new/src/components/panels/channels/` into a compact channel operations workbench:
  - channel inventory/status/account diagnostics
  - selected channel runtime metadata and plugin handoff
  - channel probe result and logout/enable actions
  - throughput trend summary
  - generic channel settings and account DM policy patch flows
  - WeCom access controls and routing summary
  - raw payload/action evidence for operator inspection
- Preserve current behavior for:
  - `GET /channels`
  - `POST /channels/{channelId}/logout`
  - `POST /channels/{channelId}/test`
  - `GET /channels/{channelId}/throughput`
  - `PATCH /channels/{channelId}`
  - WeCom config read/patch through `fetchDeckConfig` / `patchDeckConfig`
  - WeCom routing summary through `fetchRoutingBindings`
  - plugin/routing navigation helpers
- Add contract-shaped mock channel data if visual E2E gaps are found.
- Add focused mock visual E2E for the ready workbench and at least one interaction state such as probe result, throughput window, channel toggle confirmation, WeCom access, or JSON patch result.
- Update cross-module readiness evidence with channels-specific local molecules and promotion candidates.

## Capabilities

### New Capabilities

- `frontend-channels-hifi-redesign`: Covers the channels handoff package, production UI rewrite, contract-shaped mocks, mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds channels implementation evidence after agents/routing/subagents/logs/settings/sessions and records whether channel-specific diagnostics/settings/access molecules remain local or need a later pattern proposal.

## Impact

- `deck-go/frontend-handoff/modules/channels/`
- `deck-go/frontend-new/src/components/panels/channels/`
- `deck-go/frontend-new/src/theme.css` channels global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage if fixture gaps are found
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-channels-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
