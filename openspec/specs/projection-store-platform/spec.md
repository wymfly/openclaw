# projection-store-platform Specification

## Purpose

TBD - created by archiving change deck-projection-platform. Update Purpose after archive.

## Requirements

### Requirement: ProjectionStore SHALL provide a generic domain-keyed API

The ProjectionStore SHALL expose typed generic methods for reading, writing, and clearing projections by domain and key, replacing chat-specific methods.

#### Scenario: Module reads a projection by domain and key

- **WHEN** a server-side consumer calls `getProjection<T>(domain, key)`
- **THEN** the store SHALL return the deserialized value of type `T` stored at `projection:{domain}:{key}`, or `null` if no value exists

#### Scenario: Module writes a projection by domain and key

- **WHEN** a server-side consumer calls `setProjection<T>(domain, key, data)`
- **THEN** the store SHALL serialize `data` as JSON and persist it at `projection:{domain}:{key}` in the SQLite settings table

#### Scenario: Module clears a projection by domain and key

- **WHEN** a server-side consumer calls `clearProjection(domain, key)`
- **THEN** the store SHALL remove the entry at `projection:{domain}:{key}` from the SQLite settings table

### Requirement: Approval projection SHALL be stored independently from chat projection

The approval projection SHALL be written to its own domain key (`projection:approval:{sessionKey}`), not embedded inside the chat projection blob.

#### Scenario: Approval bridge writes to the approval domain

- **WHEN** the approval bridge receives a Gateway `exec.approval.requested` event with a `sessionKey`
- **THEN** the bridge SHALL call `setProjection("approval", sessionKey, approvalData)` instead of embedding `activeApproval` in the chat projection blob

#### Scenario: Approval bridge clears the approval domain on resolution

- **WHEN** the approval bridge receives a Gateway `exec.approval.resolved` event
- **THEN** the bridge SHALL call `clearProjection("approval", sessionKey)` for the associated session

#### Scenario: Chat snapshot reads approval from the approval domain

- **WHEN** the `/api/chat/snapshot` endpoint assembles a snapshot response
- **THEN** it SHALL read `activeApproval` from `getProjection("approval", sessionKey)` instead of from the chat projection blob
- **AND** the response shape to the frontend SHALL remain unchanged

### Requirement: Approval projection SHALL remain server-write-only

Approval projection SHALL NOT be writable from browser-facing HTTP endpoints. Only the server-side approval bridge has write authority.

#### Scenario: No HTTP endpoint exposes approval projection writes

- **WHEN** a browser client attempts to write to the approval projection
- **THEN** no HTTP endpoint SHALL accept such a request — approval state is derived exclusively from Gateway events via the approval bridge

### Requirement: Legacy chat projections containing activeApproval SHALL be migrated transparently

Existing chat projection blobs that contain an `activeApproval` field SHALL be migrated to the approval domain on first access.

#### Scenario: Migration on first read

- **WHEN** `getProjection("approval", key)` returns null
- **AND** `getProjection("chat", key)` contains a non-null `activeApproval` field
- **THEN** the store SHALL atomically (within a SQLite transaction) copy `activeApproval` to `projection:approval:{key}` and remove it from the chat projection blob

#### Scenario: Migration does not overwrite concurrent A2UI updates

- **WHEN** the migration transaction reads the chat blob to extract `activeApproval`
- **AND** a concurrent write updates `a2uiState` in the same chat blob
- **THEN** the transaction SHALL use a read-then-write within the same SQLite transaction to prevent the concurrent `a2uiState` update from being lost

### Requirement: Chat projection callers SHALL migrate to the generic API

Existing callers of `getChatSessionProjection()` and `setChatSessionProjection()` SHALL be refactored to use `getProjection("chat", key)` and `setProjection("chat", key, data)`.

#### Scenario: Chat-specific methods become thin wrappers

- **WHEN** `getChatSessionProjection(sessionKey)` is called during the transition period
- **THEN** it SHALL delegate to `getProjection("chat", sessionKey)` internally

#### Scenario: All direct callers are migrated

- **WHEN** all callers have been migrated to the generic API
- **THEN** the chat-specific methods SHALL be removed
