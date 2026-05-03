## Why

Settings is the next non-chat module after agents, routing, subagents, and logs. It is an important control-plane surface because it shows local deck-go settings, runtime endpoint configuration, version diagnostics, device pairing, device token lifecycle, theme, locale, and notification placeholders. The current panel is functional and already avoids leaking access tokens, but it still uses the old `deck-ui-settings` global shell and has no module handoff package.

This change applies the contract-led high-fidelity workflow to a configuration/security-sensitive module while keeping behavior inside the current BFF contract boundaries.

## What Changes

- Create a complete high-fidelity settings handoff package under `deck-go/frontend-handoff/modules/settings/`.
- Redesign `deck-go/frontend-new/src/components/panels/settings/` and the settings-only runtime helpers it owns (`EndpointSection`, `ReadOnlyField`) into a compact settings operations workbench.
- Preserve the current contract-backed workflows:
  - `GET/PUT /settings`
  - `GET /settings/version`
  - `GET/PUT/POST /runtime/endpoint`
  - `GET /runtime/capabilities`
  - `GET /devices`, `GET /devices/self`
  - device approve/reject/remove/token rotate/token revoke actions
  - device-pair SSE refresh through `/stream`
- Add contract-shaped mock/device data or fill gaps needed for focused mock visual E2E.
- Record settings design-system evidence and local molecules after the first four modules.

## Capabilities

### New Capabilities

- `frontend-settings-hifi-redesign`: Covers the settings handoff package, production UI rewrite, contract-shaped mocks, mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds settings evidence after agents/routing/subagents/logs and records whether configuration/security molecules remain local or need a later pattern proposal.

## Impact

- `deck-go/frontend-handoff/modules/settings/`
- `deck-go/frontend-new/src/components/panels/settings/`
- `deck-go/frontend-new/src/components/runtime/EndpointSection.tsx`
- `deck-go/frontend-new/src/components/runtime/ReadOnlyField.tsx`
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage if fixture gaps are found
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-settings-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
