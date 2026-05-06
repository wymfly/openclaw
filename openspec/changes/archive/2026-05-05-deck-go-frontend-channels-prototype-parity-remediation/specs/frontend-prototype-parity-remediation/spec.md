## MODIFIED Requirements

### Requirement: Remediation head tracks every active module

The deck-go frontend prototype parity remediation program SHALL maintain a
module matrix covering every active `frontend-new` panel that appears in the
Deck shell registry.

#### Scenario: Module remediation matrix is reviewed

- **WHEN** the remediation head is prepared for archive
- **THEN** every active panel SHALL have a matrix row with module id, active
  prototype path, current implementation path, latest child proposal, mock
  parity status, real evidence status, accepted exceptions, and final verdict
- **AND** no module SHALL be omitted because an older proposal once captured a
  screenshot.

#### Scenario: Channels row is remediated

- **WHEN** the Channels child proposal archives
- **THEN** the remediation matrix SHALL record the Channels active prototype,
  child proposal archive path, mock parity verdict, real Gateway evidence
  status, accepted exceptions, and final verdict
- **AND** the head task `5.6` SHALL be marked complete only after the Channels
  evidence and notes are updated.
