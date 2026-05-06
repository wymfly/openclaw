## MODIFIED Requirements

### Requirement: Remediation head tracks every active module

The deck-go frontend prototype parity remediation program SHALL maintain a
module matrix covering every active `frontend-new` panel that appears in the
Deck shell registry.

#### Scenario: Settings row is remediated

- **WHEN** the Settings child proposal archives
- **THEN** the remediation matrix SHALL record the Settings active prototype,
  child proposal archive path, mock parity verdict, real Gateway evidence
  status, accepted exceptions, and final verdict
- **AND** the head task `5.5` SHALL be marked complete only after the Settings
  evidence and notes are updated.
