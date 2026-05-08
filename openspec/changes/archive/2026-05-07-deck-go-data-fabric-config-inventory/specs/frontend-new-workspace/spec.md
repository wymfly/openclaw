## ADDED Requirements

### Requirement: Config and inventory panels SHALL follow the Data Fabric protocol

`deck-go/frontend-new` config and inventory panels SHALL use Data Fabric for
backend/Gateway server state and preserve local UI interaction state outside the
server-state cache.

#### Scenario: Scoped panels avoid naked server fetch lifecycles

- **WHEN** `skills`, `models`, `channels`, `routing`, `nodes`, `settings`,
  `plugins`, `docs`, `memory`, or `config` panels are touched for server-state
  migration
- **THEN** they SHALL import their module Data Fabric hooks or option factories
- **AND** they SHALL NOT add new raw `deckFetch`, raw Gateway client, or
  component-local `useEffect(fetch*)` lifecycles for the migrated data

#### Scenario: Visual and product UI remain stable

- **WHEN** scoped panels are migrated
- **THEN** their existing panel layout, labels, navigation, local draft behavior,
  and dialogs SHALL remain functionally equivalent unless an implementation
  mismatch is discovered and corrected in the OpenSpec artifacts
