## MODIFIED Requirements

### Requirement: Runtime transcript sync uses a shared transcript adapter

The chat panel SHALL ingest transcript updates through one shared transcript adapter across history, snapshot, live events, and reload paths.

#### Scenario: History and live events share one adapter

- **WHEN** the client ingests transcript data from `chat.history`, snapshot hydrate, `session.message`, or `reloadFullContent`
- **THEN** it SHALL pass those messages through the same transcript adapter before mutating session state
- **AND** SHALL NOT maintain separate block normalization logic for each ingress path

#### Scenario: Sessions detail uses the same transcript adapter

- **WHEN** the Sessions panel fetches transcript history for a selected session
- **THEN** it SHALL use the same transcript adapter and message contract as the chat page
- **AND** SHALL NOT collapse structured transcript content into a string-only representation

### Requirement: Reload preserves server-authoritative transcript structure

The client SHALL preserve server-authoritative transcript blocks returned by history reload paths, including tool blocks already attached to assistant messages.

#### Scenario: reloadFullContent keeps authoritative tool blocks

- **WHEN** `reloadFullContent` fetches an assistant history message that already contains authoritative tool blocks
- **THEN** the client SHALL preserve those server-returned tool blocks
- **AND** SHALL NOT discard them solely because an older local assumption expected tool blocks to live in separate history messages
