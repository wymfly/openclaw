# deck-go-real-e2e-fixture-library Specification

## Purpose

Define shared Deck Go real E2E fixture helpers for safe writable resources, ensuring creation and cleanup are run-id scoped and unproven resource classes remain skipped-safe or deferred.

## Requirements

### Requirement: Fixtures are run-id scoped

deck-go real E2E SHALL create shared writable fixtures with identifiers that include the current real E2E run id.

#### Scenario: Fixture name is created

- **WHEN** a shared helper creates a budget rule, alert rule, webhook, or other proven disposable resource
- **THEN** the resource name, id, label, description, or metadata SHALL include the current real E2E run id before the helper returns it to the spec

### Requirement: Cleanup refuses non-run-scoped resources

deck-go real E2E SHALL refuse cleanup for any resource that cannot be proven to belong to the current run.

#### Scenario: Cleanup target lacks run id

- **WHEN** a shared fixture cleanup helper receives a resource id, name, label, title, description, run id field, or metadata marker that does not contain the current run id
- **THEN** the helper SHALL fail before issuing a delete, revert, or cleanup request

#### Scenario: Cleanup target is run scoped

- **WHEN** a shared fixture cleanup helper receives a resource descriptor that contains the current run id
- **THEN** the helper MAY issue the normal Deck BFF cleanup request for that resource class

### Requirement: Fixture helpers use normal Deck BFF contracts

deck-go real E2E fixture helpers SHALL create and delete resources through the same BFF routes used by the frontend product surface.

#### Scenario: Budget fixture is used

- **WHEN** a spec needs a budget rule fixture
- **THEN** it SHALL use a shared helper that creates and deletes the rule through `/api/usage/budget`

#### Scenario: Alert fixture is used

- **WHEN** a spec needs an alert rule fixture
- **THEN** it SHALL use a shared helper that creates and deletes the rule through `/api/alerts`

#### Scenario: Webhook fixture is used

- **WHEN** a spec needs a webhook fixture
- **THEN** it SHALL use a shared helper that creates and deletes the webhook through `/api/webhooks`

### Requirement: Unsafe fixture classes remain explicit

deck-go real E2E SHALL not add shared fixture helpers for resource classes whose disposable cleanup is not yet proven.

#### Scenario: Resource class is not proven disposable

- **WHEN** a module would need to mutate agents, cron jobs, routing bindings, docs, channel accounts, installed skills, device tokens, memory, or other operator-sensitive state
- **THEN** the fixture library SHALL leave that class skipped-safe or deferred until a module proposal defines safe cleanup semantics

### Requirement: Head proposal matrix tracks fixture library completion

deck-go SHALL keep the head contract-chain proposal matrix synchronized with the fixture library child proposal lifecycle.

#### Scenario: Fixture library child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the head matrix SHALL mark `deck-go-real-e2e-fixture-library` as `archived`
