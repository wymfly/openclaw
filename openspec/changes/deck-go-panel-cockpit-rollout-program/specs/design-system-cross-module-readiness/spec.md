## ADDED Requirements

### Requirement: Cockpit rollout readiness matrix SHALL cover all target panels

After the third cockpit validation sample, cross-module readiness SHALL include a
cockpit rollout matrix that covers every target panel under
`deck-go/frontend-new/src/components/panels/`. The matrix SHALL record each
panel's readiness classification, matching cockpit anatomy, local-only
molecules, suggested batch, and verification expectations.

#### Scenario: Readiness audit completes

- **WHEN** the cockpit rollout readiness audit is completed
- **THEN** the cross-module readiness record SHALL include every target panel
- **AND** every panel SHALL have one of `direct-fit`, `partial-fit`,
  `needs-new-pattern`, or `stay-local`
- **AND** omitted panels SHALL be treated as a blocker for program rollout

#### Scenario: A panel is assigned to a batch

- **WHEN** the readiness matrix assigns a panel to a batch
- **THEN** the matrix SHALL list the specific cockpit structures expected to migrate
- **AND** it SHALL list the module-local structures that must not be promoted in that batch

### Requirement: Batch evidence SHALL update readiness after migration

Every cockpit rollout batch SHALL update cross-module readiness when it
completes. The update SHALL link the batch change, record migrated patterns,
record local-only molecules, state whether canonical token values changed, and
name any deferred follow-up candidates.

#### Scenario: A batch migration completes

- **WHEN** a cockpit rollout batch finishes implementation and verification
- **THEN** the readiness matrix SHALL mark every panel in the batch as migrated or reclassified
- **AND** it SHALL include focused test and visual verification evidence for each migrated panel
- **AND** it SHALL state that global token values did not change unless a separate token proposal changed them

#### Scenario: A batch leaves a panel partially migrated

- **WHEN** a batch migrates only part of a panel's cockpit anatomy
- **THEN** the readiness matrix SHALL record the remaining local or deferred structures
- **AND** program closure SHALL NOT treat that panel as fully converged unless the remaining structures are explicitly classified as stay-local
