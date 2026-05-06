## MODIFIED Requirements

### Requirement: Remediation head tracks every active frontend module

The remediation matrix SHALL include the Alerts child proposal status,
prototype parity verdict, real Gateway evidence outcome, accepted exceptions,
and archive path once this child is complete.

#### Scenario: Alerts child completes

- **WHEN** `deck-go-frontend-alerts-prototype-parity-remediation` records
  verified evidence and archives
- **THEN** the head matrix row for `alerts` SHALL move from `parity unreviewed`
  to a structured `pass`, `pass-with-exceptions`, or `needs-follow-up` verdict
- **AND** head task `6.1` SHALL be marked complete only after the matrix,
  implementation notes, and OpenSpec validation evidence are updated.
