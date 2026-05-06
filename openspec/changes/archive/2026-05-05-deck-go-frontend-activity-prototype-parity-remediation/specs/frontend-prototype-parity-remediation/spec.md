## ADDED Requirements

### Requirement: Activity child proposal closes the Activity matrix row

The frontend prototype parity remediation head SHALL treat the Activity row as complete only when the Activity child proposal has finished prototype reconciliation, deterministic fixes, mock parity evidence, strengthened real Gateway evidence or bounded handoff, and archive validation.

#### Scenario: Activity row is marked complete

- **WHEN** `deck-go-frontend-activity-prototype-parity-remediation` is archived
- **THEN** the head matrix SHALL record the archive path, mock parity status, real evidence status, accepted exceptions, and final verdict for `activity`
- **AND** head task `5.1` SHALL be marked complete only after those evidence fields are updated.
