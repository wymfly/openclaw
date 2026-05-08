## ADDED Requirements

### Requirement: Live workbench panels SHALL follow the Data Fabric protocol

`deck-go/frontend-new` live and historical workbench panels SHALL use Data
Fabric for backend/Gateway server state and preserve local UI interaction state
outside the server-state cache.

#### Scenario: Scoped live panels avoid naked server fetch lifecycles

- **WHEN** `sessions`, `approvals`, `activity`, `gateway`, `usage`, `logs`,
  `alerts`, `budget`, `cron`, `threads`, or `webhooks` panels are touched for
  server-state migration
- **THEN** they SHALL import their module Data Fabric hooks or option factories
- **AND** they SHALL NOT add new raw `deckFetch`, raw Gateway client, or
  component-local `useEffect(fetch*)` lifecycles for migrated data

#### Scenario: Visual and product UI remain stable

- **WHEN** scoped live workbench panels are migrated
- **THEN** their existing panel layout, labels, navigation, local draft behavior,
  dialogs, and skipped-safe write affordances SHALL remain functionally
  equivalent unless an implementation mismatch is discovered and corrected in
  the OpenSpec artifacts
