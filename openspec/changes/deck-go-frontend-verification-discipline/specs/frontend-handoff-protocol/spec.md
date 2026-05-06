## ADDED Requirements

### Requirement: Module README implemented status SHALL be canonical and evidence-backed

Every `frontend-handoff/modules/<module>/README.md` that claims implementation completion SHALL use the exact status format `**Status**: implemented (sha <40-hex-commit-sha>)`. The referenced commit SHALL be a repository commit that contains or preserves the implementation state being signed off, and the README or implementation notes SHALL link the status to tracked evidence.

#### Scenario: Implemented status is valid

- **WHEN** a module README contains `**Status**: implemented (sha <commit-sha>)`
- **THEN** `<commit-sha>` SHALL be a 40-character lowercase hex commit present in the local git repository
- **AND** the module README or `implementation-notes.md` SHALL cite the tracked evidence manifest for that module.

#### Scenario: Implemented status is non-canonical

- **WHEN** a module README contains an implemented-like status that does not match `implemented (sha <40-hex-commit-sha>)`
- **THEN** the status inventory SHALL fail that module
- **AND** the module SHALL NOT be counted as protocol-closed.

#### Scenario: Module is not implemented

- **WHEN** a module is not ready to claim implementation completion
- **THEN** its status SHALL use an allowed non-implemented protocol value such as `ready-for-implementation`, `revised vN — pending implementation`, `migrated (sha <commit-sha>)`, or `lite-handoff`
- **AND** it SHALL NOT use informal implemented phrases.

### Requirement: Reverse sign-off SHALL use a structured current-code template

Reverse sign-off SHALL be a structured section in each implemented module README or linked tracked manifest. It SHALL include current prototype reference, production reference, evidence levels, visual verdict, accepted exceptions, reviewer, date, and final sign-off status.

#### Scenario: Reverse sign-off is complete

- **WHEN** a module is counted as reverse-signed-off
- **THEN** its sign-off record SHALL include prototype path, production path, mock functional evidence, mock prototype parity evidence, real Gateway evidence or bounded reason, accepted exceptions, reviewer, and date
- **AND** it SHALL state one of `accepted`, `accepted-with-exceptions`, `needs-revision`, or `blocked`.

#### Scenario: Reverse sign-off is a short assertion

- **WHEN** a module only says it is implemented or says to see implementation notes without structured fields
- **THEN** the sign-off inventory SHALL classify it as incomplete
- **AND** the module SHALL NOT be counted as reverse-signed-off.

#### Scenario: Historical note contradicts current code

- **WHEN** a reverse sign-off section says pending implementation but production code and implementation notes indicate implementation exists
- **THEN** the remediation SHALL update or replace the stale section
- **AND** SHALL cite current code evidence rather than deleting the contradiction silently.

### Requirement: Prototype parity claims SHALL reference tracked manifests

A module SHALL NOT claim high-fidelity prototype parity unless a tracked manifest links the active prototype, current mock screenshot or capture, side-by-side comparison, structured verdict, and accepted exceptions. Ignored `.local` artifacts are acceptable evidence sources only when summarized by a tracked manifest.

#### Scenario: Parity report exists under .local only

- **WHEN** `.local/<module>-prototype-remediation-parity-report/` exists but no tracked manifest references it
- **THEN** the module SHALL be classified as having local parity artifacts but no tracked parity sign-off
- **AND** README status or reverse sign-off SHALL NOT describe parity as closed.

#### Scenario: Parity verdict remains unreviewed

- **WHEN** a tracked manifest records `verdict: unreviewed`
- **THEN** the module SHALL be allowed to record evidence collection
- **AND** SHALL NOT claim final visual acceptance.

### Requirement: Review reports SHALL be corrected before they drive implementation

When a review report is used as input to frontend remediation, any factual error discovered during cross-check SHALL be recorded in a tracked correction section or fact baseline before the report is used to create tasks.

#### Scenario: Report says a script is missing but code has the script

- **WHEN** a review report claims a required script is missing
- **THEN** cross-check SHALL inspect the path and command references
- **AND** if the script exists, the fact baseline SHALL record the correction and implementation tasks SHALL NOT include creating the script as if it were absent.

#### Scenario: Report overstates missing evidence

- **WHEN** a report says evidence is completely absent but current code contains partial evidence
- **THEN** the fact baseline SHALL preserve the partial evidence and classify the remaining gap precisely
- **AND** tasks SHALL target the precise gap rather than the overstated claim.
