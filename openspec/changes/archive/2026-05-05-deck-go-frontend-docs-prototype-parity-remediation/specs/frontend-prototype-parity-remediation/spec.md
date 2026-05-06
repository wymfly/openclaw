## MODIFIED Requirements

### Requirement: Remediation head tracks every active frontend module

The remediation matrix SHALL include the Docs child proposal status, prototype
parity verdict, real Gateway evidence outcome, accepted exceptions, and archive
path once this child is complete.

#### Scenario: Docs child completes

- **WHEN** `deck-go-frontend-docs-prototype-parity-remediation` records verified
  evidence and archives
- **THEN** the head matrix row for `docs` SHALL move from `parity unreviewed` to
  a structured `pass`, `pass-with-exceptions`, or `needs-follow-up` verdict
- **AND** head task `5.8` SHALL be marked complete only after the matrix,
  implementation notes, and OpenSpec validation evidence are updated.
