## ADDED Requirements

### Requirement: Budget, Alerts, and Webhooks product claims SHALL map to Deck-local contract truth

Deck Go SHALL treat Budget, Alerts, and Webhooks as Deck-local control surfaces
for their current production workflows, while documenting Gateway-derived inputs
and unsupported product leaves explicitly.

#### Scenario: Supported Deck-local workflow is exposed

- **WHEN** the UI exposes Budget rule CRUD/evaluation, Alerts rule CRUD, or
  Webhook CRUD/test-delivery/delivery-history workflows
- **THEN** the workflow SHALL have a Deck BFF route, Deck-facing DTO or mutation
  evidence contract, frontend facade, panel surface, and mock/real evidence

#### Scenario: Product capability is not contracted

- **WHEN** product design wants Budget forecast/enforcement, period-specific
  aggregation, Alerts durable fire/audit history, alert dry-run/evaluator,
  webhook retry scheduling, delivery retention, stats, event catalog, audit
  timeline, live delivery push, or notification binding
- **THEN** the capability SHALL remain unsupported, degraded, deferred, or
  handoff-blocked until a Gateway or Deck-local contract supports it

### Requirement: Budget evaluation responses SHALL match the Deck-facing DTO

Deck Go SHALL make current Budget evaluation BFF/runtime responses use the
`DeckGoBudgetEvaluation.current` field defined by the Deck-facing contract.

#### Scenario: Budget evaluation is returned

- **WHEN** `/api/usage/budget/evaluate` returns enabled rule evaluations
- **THEN** each evaluation SHALL include `current`
- **AND** the response SHALL match `DeckGoBudgetEvaluationsResponse`

#### Scenario: Older wire data is normalized by the frontend

- **WHEN** a frontend facade receives an older evaluation shape with
  `currentValue`
- **THEN** it SHALL normalize that value into `current` without changing the
  product DTO consumed by panels

### Requirement: Webhook test delivery mutation evidence SHALL match the BFF response

Deck Go SHALL type the webhook test-delivery response and use the response's
real success indicator in mutation evidence metadata.

#### Scenario: Webhook test delivery succeeds

- **WHEN** `/api/webhooks/{id}/test` returns a successful delivery response
- **THEN** the response SHALL match a named Deck-facing webhook test-delivery
  DTO
- **AND** mutation evidence for `webhook.test-delivery` SHALL evaluate
  `success=true` as successful

#### Scenario: Webhook retry is requested

- **WHEN** product design wants manual retry or scheduled retry workflows
- **THEN** those workflows SHALL remain unsupported/deferred until a retry route
  and retention policy are contracted

### Requirement: Alerts fallback copy SHALL name the correct contract boundary

Deck Go SHALL describe unsupported Alerts fired-history and audit-history states
as current Alerts/control contract limits rather than treating them as completed
Gateway-backed features.

#### Scenario: Fired history tab is shown without durable history

- **WHEN** the Alerts panel renders the fired-history fallback state
- **THEN** the copy SHALL state that fired history is not exposed by the current
  Alerts contract
- **AND** the fallback SHALL keep rule `lastFiredAt` as the only supported
  history field

### Requirement: Budget / Alerts / Webhooks completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
module handoff notes, and head verification evidence synchronized with this
module completion result.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** Budget, Alerts, and Webhooks matrix rows SHALL mark the follow-up as
  archived
- **AND** remaining unsupported/deferred product leaves SHALL stay visible in
  matrix gaps and module implementation notes
