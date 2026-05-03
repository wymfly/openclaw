## Context

`frontend-new` already contains a functional `PluginsPanel` under the `plugins` panel id. It calls Deck-facing wrappers for plugin inventory and channel context:

- `fetchPluginsWithCapability(capability)` -> `GET /api/deck/plugins` or `GET /api/deck/plugins?capability=all`
- `fetchChannels()` -> `GET /api/channels`

The plugin inventory route is Deck BFF traffic. The backend route proxies Gateway `deck.plugins.list`, with capability filtering treated as a Deck view concern. DTO authority is `deck-go/contracts/source/deck-api.contract.ts`, generated into `DeckGoPluginCapability`, `DeckGoPluginInventoryEntry`, `DeckGoPluginActionCapabilities`, `DeckGoPluginDiagnostic`, and `DeckGoPluginsListResponse`.

The current UI preserves read-only inventory, channel/all scope switching, channel/routing/access handoff buttons, and raw payload disclosure, but it is visually still an old global `deck-ui-plugins*` layout. The gap is visual and verification convergence: the panel is dense, row/detail evidence is not clearly separated, unsupported lifecycle controls are only implied by omission, and there is no focused mock/local visual E2E.

## Goals / Non-Goals

**Goals:**

- Produce a complete Plugins handoff package.
- Rewrite Plugins into a high-fidelity plugin inventory workbench aligned with the current design-system posture.
- Preserve load/error handling, capability scope switching, selected plugin selection, channel visibility warnings, cross-panel handoffs, diagnostics, raw payload disclosure, and localization.
- Add deterministic mock/local visual coverage for ready inventory, selected detail, channel/all scope switching or handoff state, and diagnostic/channel-warning evidence.
- Record Plugins-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, event stream, or Deck-facing DTO contract unless implementation proves deterministic mismatch.
- No browser-side direct Gateway call.
- No install, uninstall, enable, disable, reload, trust, marketplace, package signature, or lifecycle mutation controls.
- No real plugin runtime safety audit, external marketplace trust verification, or production plugin activation guarantee.
- No new dependencies, table libraries, chart libraries, schema editors, date libraries, or plugin manifest parser.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Plugins as a read-only inventory and handoff workbench.**
   The contract exposes inventory and evidence, not lifecycle mutation. The first viewport should make plugin identity, scope, status, related channels, action capabilities, diagnostics, and unsupported lifecycle limits visible without inventing controls.

2. **Preserve the Deck BFF contract boundary.**
   Plugins is explicitly classified as Deck BFF traffic. The rewrite should keep current wrappers and public BFF route path, and should keep channel context fetch as a support query for handoff affordances.

3. **Use module-local inventory, metric, capability, diagnostic, and handoff molecules.**
   Plugins repeats compact workbench patterns from earlier modules but adds plugin-specific capability/action semantics. Promotion to shared patterns waits for a separate design-system proposal with enough Control/Integrations evidence.

4. **Render selected detail separately from inventory rows.**
   Inventory rows should be compact selectors. Deep details, raw payload, diagnostics, related-channel actions, activation evidence, and unsupported lifecycle notes belong in the selected detail sidecar to keep density controlled.

5. **Make mock/local visual seeding deterministic through mock Gateway fixtures.**
   The visual E2E should exercise the real frontend against the bundled mock Gateway for `deck.plugins.list` and `channels.status`. No real plugin runtime or external marketplace is needed for visual convergence.

## Risks / Trade-offs

- **Risk: UI implies lifecycle control that does not exist.** -> Keep lifecycle copy explicit and avoid install/enable/disable/reload buttons.
- **Risk: Plugin capabilities look authoritative beyond the Gateway payload.** -> Render only fields present in `DeckGoPluginInventoryEntry`; missing fields show unavailable evidence.
- **Risk: Cross-panel handoffs imply Channels/Routing support for hidden plugin channel IDs.** -> Show handoff buttons only for channel IDs visible in channel status; label hidden channel IDs as not visible.
- **Risk: Global CSS cleanup affects other old control panels.** -> Remove or narrow only Plugins-specific classes; keep new styling in module-local CSS.
