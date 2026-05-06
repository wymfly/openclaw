## ADDED Requirements

### Requirement: Docs and Memory product claims SHALL map to contract truth

Deck Go SHALL ensure visible Docs and Memory workflows map to current Gateway
support, Deck BFF routes, Deck-facing DTOs, frontend facades, list-query
metadata, mutation evidence, and evidence status.

#### Scenario: Supported or degraded workflow is exposed

- **WHEN** the UI exposes Docs list/detail/local search/extract/delete or Memory
  browse/read/search/health/dream workflows
- **THEN** the workflow SHALL have a Deck BFF route, Deck-facing DTO or explicit
  degraded response, frontend facade, panel surface, and evidence status

#### Scenario: Capability is not implemented

- **WHEN** product design wants LanceDB semantic search, docs editing, docs
  soft-delete/archive, full Markdown/GFM dependency fidelity, destructive memory
  mutation automation, or per-agent memory-dream semantics
- **THEN** the capability SHALL remain unsupported, degraded, deferred, or
  skipped-safe until contracts and fixtures support it

### Requirement: Docs writes SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence for production-visible Docs
extract and delete workflows.

#### Scenario: Docs extraction runs

- **WHEN** the frontend calls `/api/docs/extract`
- **THEN** the response SHALL use `DeckGoDocsExtractResponse`
- **AND** mutation evidence for `docs.extract` SHALL mark `extracted` presence as
  the success indicator

#### Scenario: Docs delete runs

- **WHEN** the frontend deletes a doc through `/api/docs/{docId}`
- **THEN** the frontend boundary SHALL use a named Docs delete response DTO
- **AND** mutation evidence for `docs.delete` SHALL use the route `docId` as the
  target id

### Requirement: Memory search degraded route SHALL write one explicit response

Deck Go SHALL keep Memory search unavailable semantics explicit and avoid
duplicate response writes.

#### Scenario: GET memory search is unavailable

- **WHEN** `/api/memory/search?q=...` is called before a LanceDB adapter exists
- **THEN** the route SHALL return one explicit unavailable response
- **AND** it SHALL NOT call the shared response writer twice

### Requirement: Memory mutating dream actions SHALL remain skipped-safe

Deck Go SHALL keep mutating Memory dreams actions out of fixture-safe evidence
until disposable memory fixtures and action-specific semantics exist.

#### Scenario: Mutating memory dream action is requested

- **WHEN** the UI exposes backfill, reset, reset-short-term, repair, or dedupe
  dream actions
- **THEN** those workflows SHALL remain confirmation-gated and skipped-safe or
  deferred for automated real E2E

### Requirement: Docs / Memory completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
module handoff notes, and head verification evidence synchronized with this
module completion result.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** Docs and Memory matrix rows SHALL mark the follow-up as archived
- **AND** remaining semantic-search, docs policy, and memory mutation limits
  SHALL stay visible in matrix gaps and implementation notes
