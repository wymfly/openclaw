# deck-go-safe-mutation-evidence-contract Specification

## Purpose

TBD - created by archiving change deck-go-safe-mutation-evidence-contract. Update Purpose after archive.

## Requirements

### Requirement: Mutation evidence contract SHALL describe Deck control writes

Deck Go SHALL maintain source-controlled mutation evidence metadata for product-facing control mutations that records action identity, route/method, owner module, source classification, result evidence, error/conflict behavior, audit coverage, and fixture safety status.

#### Scenario: Mutation action is described

- **WHEN** a Deck control mutation is included in the mutation evidence contract
- **THEN** the contract SHALL name the action id, owner module, route/method, existing response DTO or dynamic envelope, success indicator, target identity field when present, audit coverage, and fixture safety status

#### Scenario: Unsafe mutation class is deferred

- **WHEN** a mutation class cannot be safely exercised with disposable real fixtures or existing contract truth
- **THEN** the contract SHALL mark the action as deferred or skipped-safe rather than requiring real write evidence in this proposal

### Requirement: Mutation evidence metadata SHALL be generated and checked

The mutation evidence contract SHALL generate Markdown documentation and frontend-readable TypeScript metadata from one source.

#### Scenario: Contract generation succeeds

- **WHEN** `make mutation-evidence-contract-sync` is run
- **THEN** generated Markdown and TypeScript metadata SHALL match the source mutation evidence contract

#### Scenario: Contract drift is checked

- **WHEN** `make mutation-evidence-contract-check` is run
- **THEN** the command SHALL fail if generated Markdown or TypeScript metadata are stale

### Requirement: Frontend mutation helpers SHALL preserve existing DTOs

Frontend mutation helpers SHALL normalize request/result/error evidence beside existing typed responses without replacing module-specific response DTOs.

#### Scenario: Successful mutation is interpreted

- **WHEN** a representative mutation response contains a configured success indicator or target identity field
- **THEN** the helper SHALL return normalized mutation evidence containing the action id, ok state, target id when present, and audit expectation from generated metadata

#### Scenario: Failed mutation is interpreted

- **WHEN** a mutation fails with a known conflict or validation error shape
- **THEN** the helper SHALL preserve the original error message and expose only the conflict/degraded indicator supported by the action metadata

### Requirement: Fixture-safe local mutations SHALL have representative proof

Deck Go SHALL use already proven disposable fixtures as the first mutation evidence consumers.

#### Scenario: Fixture-safe action is covered

- **WHEN** a budget, alert, or webhook create/update/delete action is marked fixture-safe
- **THEN** focused tests SHALL prove its frontend evidence helper behavior and existing real E2E fixture safety path remains available

#### Scenario: Fixture-unsafe action is not forced

- **WHEN** a module mutation depends on operator-sensitive resources such as agents, cron jobs, routing bindings, docs, skills, devices, or memory
- **THEN** this proposal SHALL record the action as deferred or skipped-safe unless an existing module-specific proposal already proves disposable cleanup

### Requirement: Head matrix SHALL track mutation evidence completion

Deck Go SHALL keep the head contract-chain audit matrix synchronized with this child proposal lifecycle.

#### Scenario: Mutation evidence child is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the head matrix SHALL mark `deck-go-safe-mutation-evidence-contract` as `archived`
- **AND** downstream module proposals that depend on safe mutation evidence SHALL remain deferred until their own module-specific contracts are implemented
