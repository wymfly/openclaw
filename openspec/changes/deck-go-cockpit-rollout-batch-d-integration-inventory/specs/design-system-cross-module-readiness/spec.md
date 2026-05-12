## MODIFIED Requirements

### Requirement: Batch evidence SHALL update readiness after migration

Every cockpit rollout batch SHALL update cross-module readiness when it
completes. The update SHALL link the batch change, record migrated patterns,
record local-only molecules, state whether canonical token values changed, and
name any deferred follow-up candidates.

#### Scenario: Batch D migration completes

- **WHEN** Skills, Plugins, and Nodes cockpit rollout changes finish
  implementation and verification
- **THEN** the cockpit rollout readiness matrix SHALL mark those panels as
  migrated or partially migrated by
  `deck-go-cockpit-rollout-batch-d-integration-inventory`
- **AND** it SHALL record the cockpit APIs consumed by each panel
- **AND** it SHALL record focused build and mock visual verification evidence
- **AND** it SHALL state that global token values, atom APIs, and
  `PanelCockpit` APIs did not change
