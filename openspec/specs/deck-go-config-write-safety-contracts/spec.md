# deck-go-config-write-safety-contracts Specification

## Purpose

Define the Deck Go product-level safety contract for config-like writes, including action-level governance, base-hash semantics, conflict handling, idempotency truth, rollback/audit availability, and synchronized verification evidence.

## Requirements

### Requirement: Config-like writes are governed by write-safety metadata

Deck Go SHALL maintain contract metadata for config-like write paths that mutate OpenClaw config or Deck-derived config projections.

#### Scenario: Config-like write is added

- **WHEN** a backend route, frontend facade, or runtime adapter introduces a config-like write
- **THEN** contract governance SHALL require metadata naming the owner module, route/action, Gateway support basis, base-hash requirement, response hash behavior, conflict behavior, idempotency support, rollback/audit status, and verification evidence

#### Scenario: Write metadata is incomplete

- **WHEN** write-safety metadata omits required semantics or evidence
- **THEN** the write-safety governance check SHALL fail with the missing field

### Requirement: Base-hash semantics are explicit

Deck Go SHALL define whether each config-like write requires, forwards, derives, or does not use a base hash.

#### Scenario: Base hash is required

- **WHEN** a write is backed by `config.apply`, `config.patch`, or an upstream method that requires current config state
- **THEN** the frontend facade and backend adapter SHALL pass the current base hash or block the mutation with a contract-shaped error/degraded state

#### Scenario: Base hash changes after success

- **WHEN** a config-like write succeeds and the Gateway or Deck projection returns a next hash
- **THEN** the Deck-facing response SHALL expose a stable next-hash field or documented compatibility alias that the frontend can use for subsequent writes

### Requirement: Conflict behavior preserves operator work

Deck Go SHALL treat stale-hash and config conflict failures as recoverable product states.

#### Scenario: Write conflict is returned

- **WHEN** a config-like write fails because the base hash is stale or the upstream config changed
- **THEN** frontend behavior SHALL preserve local edits, show refresh/retry guidance, and avoid silently overwriting remote state

#### Scenario: Conflict shape is normalized

- **WHEN** backend code can classify a conflict without hiding upstream details
- **THEN** the Deck-facing error or response SHALL include a stable conflict indicator alongside the original error detail

### Requirement: Idempotency and request evidence are explicit

Deck Go SHALL not imply de-duplication or durable request evidence for config-like writes unless it is backed by existing Gateway or Deck code truth.

#### Scenario: Idempotency is supported

- **WHEN** a config-like write path supports idempotency or request identifiers
- **THEN** the request/response contract SHALL name the idempotency key or request ID fields and focused tests SHALL assert pass-through or generation behavior

#### Scenario: Idempotency is not supported

- **WHEN** a config-like write path lacks idempotency support
- **THEN** the governance metadata SHALL mark idempotency as unsupported or deferred instead of exposing product claims that retries are de-duplicated

### Requirement: Rollback and audit claims match code truth

Deck Go SHALL explicitly distinguish supported write-safety behavior from deferred enterprise features.

#### Scenario: Rollback or audit is unavailable

- **WHEN** a config-like write path lacks rollback, apply history, audit entry, import/export, or version restore support
- **THEN** frontend copy, mocks, handoff notes, and governance metadata SHALL mark that behavior unavailable or deferred

#### Scenario: Rollback or audit becomes supported

- **WHEN** a later proposal adds rollback or audit/history code truth
- **THEN** the write-safety metadata SHALL be updated with the source authority and verification evidence before UI claims are enabled

### Requirement: Write-safety evidence stays synchronized

Deck Go SHALL keep write-safety source metadata, generated write-safety report, Deck API DTOs, endpoint/route governance, contract inventory, and head matrix evidence synchronized.

#### Scenario: Contract gate runs

- **WHEN** `cd deck-go && make contract-gate` runs
- **THEN** write-safety governance, generated artifacts, contract inventory, and head matrix SHALL be synchronized
