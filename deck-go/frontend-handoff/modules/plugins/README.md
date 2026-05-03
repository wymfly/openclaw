# Plugins Module Handoff

Status: implemented-awaiting-archive

## Contract Truth

- Deck DTO authority: `deck-go/contracts/source/deck-api.contract.ts`
  - `DeckGoPluginCapability`
  - `DeckGoPluginInventoryEntry`
  - `DeckGoPluginActionCapabilities`
  - `DeckGoPluginDiagnostic`
  - `DeckGoPluginsListResponse`
- Browser API facade: `deck-go/frontend-new/src/api.ts`
  - `fetchPluginsWithCapability(capability)`
  - `fetchChannels()`
- Public BFF routes:
  - `GET /api/deck/plugins`
  - `GET /api/deck/plugins?capability=all`
  - `GET /api/channels` for channel handoff context
- Runtime source: Gateway `deck.plugins.list` plus channel status context through the deck-go backend.

## Product Intent

Plugins is a read-only inventory workbench for plugin identity, status,
capabilities, diagnostics, and cross-panel handoffs. It is not an installer,
marketplace, trust manager, package verifier, or lifecycle mutation console.

## Workflow Constraints

- Browser code must use the existing frontend API wrappers only.
- Capability scope changes reload inventory through the same BFF route.
- Related channel handoff buttons only appear for channel IDs visible in channel
  status context.
- Hidden channel IDs are labeled as not visible instead of receiving unsupported
  handoff buttons.
- Mock/local visual evidence does not prove real plugin lifecycle behavior,
  marketplace trust, package signatures, or production activation assurance.

## Files

- `prototype.html` - high-fidelity static reference for the Plugins workbench.
- `components.md` - production component breakdown and prop contracts.
- `states.md` - state model and edge cases.
- `interactions.md` - keyboard, focus, scope, handoff, and accessibility rules.
- `api-usage.md` - endpoint and DTO usage notes.

## Open Questions

- Plugin install/uninstall/enable/disable/reload contracts are not exposed.
- Plugin trust, package signature, and marketplace semantics are not exposed.
- Real runtime activation guarantees require separate backend/Gateway evidence.
