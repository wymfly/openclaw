## ADDED Requirements

### Requirement: Mutations create audit entries

deck-go SHALL record product-level audit entries for authenticated control-side mutation requests.

#### Scenario: Authenticated mutation completes

- **WHEN** an authenticated `/api` request uses `POST`, `PUT`, `PATCH`, or `DELETE`
- **THEN** deck-go SHALL append an audit entry with request id, actor, method, path, action, target, status code, success flag, duration, and timestamp

#### Scenario: Read request completes

- **WHEN** an authenticated `/api` request uses `GET`
- **THEN** deck-go SHALL NOT append a mutation audit entry for that read

### Requirement: Audit history has explicit retention

deck-go SHALL expose the retention mode and limit for audit history.

#### Scenario: Audit log exceeds capacity

- **WHEN** more audit entries are recorded than the configured max entries
- **THEN** deck-go SHALL evict the oldest entries and keep the newest entries up to the max-entry retention limit

#### Scenario: Audit events are listed

- **WHEN** a client reads audit history
- **THEN** the response SHALL include retention metadata naming the retention mode and max entries

### Requirement: Audit history is a Deck BFF contract

deck-go SHALL expose audit history through a typed Deck-facing BFF route and frontend facade.

#### Scenario: Client lists audit events

- **WHEN** the frontend or tests call `GET /api/audit/events`
- **THEN** deck-go SHALL return a typed response containing audit entries and retention metadata

#### Scenario: Route governance runs

- **WHEN** contract governance checks run
- **THEN** endpoint classification, route governance, Deck API DTOs, generated artifacts, and facade references SHALL stay synchronized for audit history

### Requirement: Audit entries do not record request bodies

deck-go SHALL avoid storing request or response bodies in the generic audit entry.

#### Scenario: Mutation request has a body

- **WHEN** a mutation request contains config, token, secret, credential, or other request body fields
- **THEN** the generic audit entry SHALL record request metadata and result only, not the raw body

### Requirement: Head proposal matrix tracks audit completion

deck-go SHALL keep the head contract-chain proposal matrix synchronized with the audit/history child proposal lifecycle.

#### Scenario: Audit child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the head matrix SHALL mark `deck-go-control-audit-history-contract` as `archived`
