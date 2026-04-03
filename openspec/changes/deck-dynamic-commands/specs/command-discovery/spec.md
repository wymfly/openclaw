## ADDED Requirements

### Requirement: Gateway discover RPC

The Gateway SHALL expose a `deck.commands.discover` RPC method that returns all available chat commands (built-in, skill, plugin) for the current agent, with metadata sufficient for the Deck command palette to display and execute them.

#### Scenario: Discover returns built-in commands

- **WHEN** Deck calls `gw.deckCommandsDiscover({ agentId: "main" })`
- **THEN** the response SHALL include built-in commands from the auto-reply registry with name, description, args hint, argChoices (if any), and category

#### Scenario: Discover returns skill commands

- **WHEN** the current agent has skills installed in its workspace
- **THEN** the discover response SHALL include skill commands with `source: "skill"` and `skillName` field

#### Scenario: Discover returns version hash

- **WHEN** Deck calls `deck.commands.discover`
- **THEN** the response SHALL include a `version` string that is a hash of the current command list, changing only when available commands change

#### Scenario: Discover with no skills or plugins

- **WHEN** the agent has no skills installed and no plugins registered
- **THEN** the response SHALL contain only built-in commands and the result SHALL still be valid

### Requirement: SSE command change notification

The Gateway SHALL push a `commands.changed` event through the existing SSE channel when the available command set changes (skill loaded/unloaded, plugin registered/unregistered).

#### Scenario: Skill loaded triggers notification

- **WHEN** a new skill is installed via `skills.install`
- **THEN** the Gateway SHALL emit a `commands.changed` SSE event containing the new version hash

#### Scenario: Client re-discovers on change

- **WHEN** the Deck receives a `commands.changed` SSE event with a version different from its cached version
- **THEN** the Deck SHALL call `deck.commands.discover` to refresh its command list

#### Scenario: Same version suppresses re-discover

- **WHEN** the Deck receives a `commands.changed` SSE event with the same version as its cache
- **THEN** the Deck SHALL NOT call `deck.commands.discover`

### Requirement: Discovery hook for React components

The Deck SHALL provide a `useCommandDiscovery()` React hook that manages the discover RPC lifecycle, SSE listener, and registry synchronization.

#### Scenario: Initial discovery on mount

- **WHEN** the hook mounts in a component
- **THEN** it SHALL call `deck.commands.discover` and register discovered commands into the CommandRegistry

#### Scenario: SSE-driven refresh

- **WHEN** the hook receives a `commands.changed` SSE event
- **THEN** it SHALL compare versions and re-discover if changed, updating the registry

#### Scenario: Cleanup on unmount

- **WHEN** the component using the hook unmounts
- **THEN** the hook SHALL unregister all previously discovered remote commands from the registry

### Requirement: Protocol SDK integration

The `deck.commands.discover` RPC SHALL be included in the Protocol SDK generation pipeline, producing typed params/result interfaces and a typed client method `gw.deckCommandsDiscover()`.

#### Scenario: TypeBox schema defined

- **WHEN** `pnpm protocol:gen:ts` is run
- **THEN** the generated types SHALL include `DeckCommandsDiscoverParams` and `DeckCommandsDiscoverResult` interfaces

#### Scenario: Gateway allowlist updated

- **WHEN** the Deck server proxies requests to Gateway
- **THEN** `deck.commands.discover` SHALL be included in `gateway-allowlist.ts`
