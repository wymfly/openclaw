## MODIFIED Requirements

### Requirement: Plugins handoff package defines the visual contract

The plugins module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/plugins/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing plugin wrappers, `/api/deck/plugins` BFF route, Gateway `deck.plugins.list` inventory, channel support query, and `DeckGoPlugin*` DTOs as the source truth. Prototype claims that conflict with code truth SHALL be corrected in handoff notes during implementation.

#### Scenario: Handoff package is reviewed

- **WHEN** the plugins handoff package is created or refreshed
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, `api-usage.md`, and implementation notes
- **AND** unsupported or uncertain manifest projection, activation audit projection, install, uninstall, enable, disable, reload, trust, marketplace, package signature, and production activation assurance semantics SHALL be documented as follow-up rather than silently fabricated in the UI
- **AND** the package SHALL document plugin inventory, selected plugin detail, capability scope switching, status/origin/enabled evidence, related channel handoffs, activation evidence, diagnostics, raw payload disclosure, loading/error/empty states, and mock visual states
- **AND** any reference to non-existent BFF routes, undeclared dependencies, or backend features SHALL be reconciled against implementation notes before archive

### Requirement: Plugins production panel follows Deck BFF inventory workflows

The production plugins panel SHALL render and operate from contract-backed Deck plugin inventory data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Plugin inventory is loaded

- **WHEN** `fetchPluginsWithCapability` resolves with contract-shaped data
- **THEN** the panel SHALL show plugin count, enabled count, status summary, scope, selected plugin identity, origin, status, enabled state, version, config path, capability kinds, channel IDs, provider IDs, tool names, Deck action capabilities, activation evidence, diagnostics, and raw payload evidence
- **AND** missing optional fields such as version, config path, capability lists, action capabilities, activation reason, diagnostics, or raw payload fields SHALL render as unavailable, degraded, or unsupported evidence rather than fabricated values

#### Scenario: Plugin scope, filters, and selection are used

- **WHEN** an operator switches between channel-capable and all-plugin inventory, refreshes, searches, filters, selects a plugin, or arrives with a plugin navigation target
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing capability parameter behavior
- **AND** it SHALL preserve the selected plugin when it still exists in the next payload
- **AND** it SHALL choose the navigation target or first plugin when no selected plugin remains
- **AND** filter/search behavior SHALL be browser-side over loaded contract data unless a real server filter exists

#### Scenario: Related channel handoffs are used

- **WHEN** a selected plugin contains channel IDs and channel status context exposes matching visible channel IDs
- **THEN** the panel SHALL show handoff actions to Channels, Channels access controls when supported, and Routing through existing panel-navigation helpers
- **AND** hidden channel IDs SHALL be labeled as not visible instead of receiving unsupported handoff buttons
- **AND** handoff success copy SHALL stay local and SHALL NOT imply the plugin was mutated

### Requirement: Plugins UI aligns with the settled frontend design system

The plugins panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Plugins UI is rendered

- **WHEN** the plugins panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose plugin metrics, scope controls, inventory, selected plugin evidence, diagnostics, related channel handoffs, lifecycle limitation copy, and raw payload access without overlapping text or nested decorative cards
- **AND** long plugin names, IDs, capability lists, channel IDs, config paths, diagnostic messages, and raw payload labels SHALL wrap or truncate in stable constrained regions without shifting the layout
