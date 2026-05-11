## Purpose

Define the product-level contract closure requirements for Deck Go Models and
Providers workflows after config-write safety and mutation evidence platform
contracts are available.

## Requirements

### Requirement: Models product claims SHALL map to contract truth

Deck Go SHALL ensure visible models/providers workflows map to typed Gateway
DTOs, Deck config BFF contracts, config-write safety metadata, frontend
facades, and evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the Models UI exposes configured models, auth overview, catalog,
  usage, config save, or probe workflows
- **THEN** the workflow SHALL have a frontend facade, Deck/Gateway DTO or
  generated method, and matrix evidence status

#### Scenario: Workflow is projected or unsafe

- **WHEN** a Models workflow depends on unsupported pricing snapshots, PATCH
  audit history, force-probe behavior, real provider calls, or unsafe config
  mutation
- **THEN** the workflow SHALL be marked unsupported, skipped-safe, deferred,
  degraded, or handoff-blocked rather than product-complete

### Requirement: Models actions SHALL be evidence-known

Deck Go SHALL record action-level mutation evidence metadata for
production-visible Models config save and provider probe actions.

#### Scenario: Config save action is recorded

- **WHEN** Models config save is exposed through a frontend facade
- **THEN** `deck-mutations.contract.json` SHALL name the action id, route,
  response DTO, success indicator, audit/config-write source, conflict behavior,
  and fixture safety status

#### Scenario: Provider probe action is recorded

- **WHEN** provider auth probe is exposed through a frontend facade
- **THEN** mutation evidence metadata SHALL describe target provider extraction,
  external side-effect safety, and real execution status

### Requirement: Models facades SHALL preserve typed transport boundaries

Models panel code SHALL use frontend API facades and generated runtime Gateway
client wrappers rather than assembling raw Gateway RPC transport calls in
production components.

#### Scenario: Panel performs model action

- **WHEN** the Models panel saves config or probes provider auth
- **THEN** production component code SHALL call the API facade
- **AND** mutation evidence interpretation SHALL remain in
  `frontend-new/src/api.ts`, generated metadata, or tests

### Requirement: Models completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and Models handoff notes synchronized with this module completion result.

#### Scenario: Models child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the models/providers matrix row SHALL remove blockers already
  satisfied by config-write safety and safe mutation evidence
- **AND** remaining provider/projection blockers SHALL be documented as
  module-specific deferred, degraded, skipped-safe, or unsupported scenarios

### Requirement: Models typed actions SHALL extend contract completion evidence

Deck Go SHALL extend Models/Providers contract completion from raw config save and provider probe coverage to typed Models config detail and typed provider/model/mode actions.

#### Scenario: Typed Models action is production-visible

- **WHEN** provider upsert, provider delete preview, provider delete commit, model upsert, model delete preview, model delete commit, or mode set is exposed to the frontend
- **THEN** the action SHALL have a Deck-facing DTO, frontend facade or mutation hook, mutation evidence metadata, owner module, route/action id, response success indicator, fixture safety status, and real-evidence status.

#### Scenario: Raw config save route remains outside normal Models UI

- **WHEN** `models.config.save` remains in contracts or backend code for compatibility, generic config tooling, or historical evidence
- **THEN** normal Models provider/model CRUD SHALL not depend on it
- **AND** the Models page SHALL not expose it as a product action or describe it as the fallback path for unsupported fields.

#### Scenario: Unsupported Models workflow is visible in design

- **WHEN** a Models workflow depends on unsupported rate limits, OAuth runner behavior, secret-value store CRUD, audit history, rollback, raw provider `request` editing, model `compat` editing, or unsafe provider calls
- **THEN** the workflow SHALL be marked unsupported, skipped-safe, degraded, or follow-up-blocked rather than product-complete.

### Requirement: Models contract completion SHALL include handoff and UI evidence

Deck Go SHALL keep Models contract truth, frontend product implementation, and handoff prototype synchronized.

#### Scenario: Handoff is updated

- **WHEN** the typed Models control plane is implemented
- **THEN** `deck-go/frontend-handoff/modules/models` SHALL document the final product IA, component tree, states, interactions, API usage, implementation notes, and raw-editor removal from the Models product path
- **AND** it SHALL state that OpenClaw config truth overrides older decorative prototype assumptions.

#### Scenario: Frontend evidence is recorded

- **WHEN** Models frontend implementation is marked complete
- **THEN** focused component tests, mock E2E or visual smoke evidence, build/typecheck evidence, and real-safe route evidence where available SHALL prove the visible typed workflows, usage-policy overview, raw-editor absence, and edge states.
