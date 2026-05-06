## ADDED Requirements

### Requirement: Chat and Sessions product claims SHALL map to contract truth

Deck Go SHALL ensure visible chat and sessions product workflows map to typed
Gateway/Deck DTOs, BFF routes, frontend facades, stream/list/mutation metadata,
and evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the Chat or Sessions UI exposes a read, stream, or write workflow
- **THEN** the workflow SHALL have a frontend API wrapper, Deck-facing DTO or
  generated Gateway method, and matrix evidence status

#### Scenario: Workflow is unsafe for automated real writes

- **WHEN** a chat/session workflow can mutate operator session history or active
  runtime state and disposable cleanup is not proven
- **THEN** the workflow SHALL be marked skipped-safe, deferred, degraded, or
  handoff-blocked for L2 mutation execution

### Requirement: Chat and session mutations SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence metadata for
production-visible chat/session write actions.

#### Scenario: Chat write action is recorded

- **WHEN** session create, chat send, chat abort, chat steer, projection persist,
  or chat compaction actions are exposed through frontend facades
- **THEN** `deck-mutations.contract.json` SHALL name the action id, route,
  response DTO, success indicator, audit coverage, idempotency, conflict
  behavior, and fixture safety status

#### Scenario: Session write action is recorded

- **WHEN** session reset, clear, delete, patch, compact, branch, or restore is
  exposed through frontend facades
- **THEN** mutation evidence metadata SHALL describe target id extraction and
  safety status without requiring destructive real execution

#### Scenario: Mutation evidence metadata is generated

- **WHEN** mutation evidence sync/check runs
- **THEN** generated Markdown and TypeScript metadata SHALL include the
  chat/session action rows

### Requirement: Chat and Sessions facades SHALL keep raw routes centralized

Chat and Sessions panel code SHALL use frontend API facades rather than
assembling raw BFF paths or mutation action identifiers in production
components.

#### Scenario: Panel performs mutation

- **WHEN** the Chat or Sessions panel performs a session or chat mutation
- **THEN** production component code SHALL call the API facade
- **AND** route/action-specific mutation interpretation SHALL remain in
  `frontend-new/src/api.ts`, generated metadata, or tests

### Requirement: Chat/session completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and Sessions handoff notes synchronized with this module completion result.

#### Scenario: Chat/session child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the chat and sessions matrix rows SHALL remove blockers already
  satisfied by list-query, live projection, real seed, and safe mutation
  evidence contracts
- **AND** remaining real mutation or product-local projection blockers SHALL be
  documented as module-specific deferred, degraded, skipped-safe, or
  handoff-blocked scenarios
