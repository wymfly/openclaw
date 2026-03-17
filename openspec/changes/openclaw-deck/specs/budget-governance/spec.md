## ADDED Requirements

### Requirement: Budget Rule Management

The budget governance panel SHALL support creating, reading, updating, and deleting budget rules with per-agent and per-task scope. Rules SHALL be persisted in the SQLite projection store.

#### Scenario: Create a budget rule

- **WHEN** the user creates a budget rule with scope (agent or task), dimension (tokensIn / tokensOut / totalTokens / cost), and threshold values
- **THEN** the panel SHALL persist the rule in SQLite and display it in the rules list

#### Scenario: Delete a budget rule

- **WHEN** the user confirms deletion of a budget rule
- **THEN** the panel SHALL remove the rule from SQLite and stop enforcing it

### Requirement: Multi-Dimension Thresholds

Each budget rule SHALL support thresholds across four dimensions: tokensIn, tokensOut, totalTokens, and cost.

#### Scenario: Configure multi-dimension thresholds

- **WHEN** the user edits a budget rule
- **THEN** the panel SHALL allow setting independent warn and over thresholds for each of the four dimensions (tokensIn, tokensOut, totalTokens, cost)

### Requirement: Budget State Tracking

The panel SHALL display the current budget state for each rule as one of three states: ok, warn, or over.

#### Scenario: Display warn state

- **WHEN** a budget rule's tracked dimension exceeds the warn threshold but is below the over threshold
- **THEN** the panel SHALL display the rule with a yellow "warn" state indicator and the current consumption value

#### Scenario: Display over state

- **WHEN** a budget rule's tracked dimension exceeds the over threshold
- **THEN** the panel SHALL display the rule with a red "over" state indicator and emit a budget alert via the EventBus

### Requirement: Budget Scope Assignment

Budget rules SHALL support scoping to specific agents or task types, with a global fallback scope.

#### Scenario: Assign rule to specific agent

- **WHEN** the user creates a budget rule and selects a specific agent as scope
- **THEN** the rule SHALL only track and enforce token consumption for that agent's sessions
