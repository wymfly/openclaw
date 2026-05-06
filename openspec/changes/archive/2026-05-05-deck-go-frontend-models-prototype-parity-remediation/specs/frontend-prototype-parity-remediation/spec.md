## MODIFIED Requirements

### Requirement: Remediation head tracks every active module

The deck-go frontend prototype parity remediation program SHALL maintain a
module matrix covering every active `frontend-new` panel that appears in the
Deck shell registry.

#### Scenario: Models row is remediated

- **WHEN** the Models child proposal archives
- **THEN** the remediation matrix SHALL record the Models active prototype,
  child proposal archive path, mock parity verdict, real Gateway evidence
  status, accepted exceptions, and final verdict
- **AND** the head task `5.2` SHALL be marked complete only after the Models
  evidence and notes are updated.
