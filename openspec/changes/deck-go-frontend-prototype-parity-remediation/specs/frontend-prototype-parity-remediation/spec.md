## ADDED Requirements

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

### Requirement: Prior screenshot-only evidence is downgraded

The remediation program SHALL distinguish old screenshot capture evidence from
strict prototype parity evidence.

#### Scenario: Archived module proposal has only mock screenshots

- **WHEN** an archived module proposal only proves that a mock page opened and
  saved screenshots
- **THEN** the remediation matrix SHALL classify that evidence as mock
  functional or screenshot evidence
- **AND** SHALL NOT classify it as prototype parity evidence until a side-by-side
  comparison and verdict exist.

### Requirement: Active prototype is identified before remediation

Every module remediation child proposal SHALL identify the active
`frontend-handoff/modules/<module>/prototype.html` file before changing
production UI.

#### Scenario: Prototype conflicts with contract truth

- **WHEN** the active prototype assumes data, actions, or flows unsupported by
  Gateway/deck-go contract truth
- **THEN** the child proposal SHALL revise the handoff package or record an
  accepted exception before implementing production UI
- **AND** the final verdict SHALL say which source won and why.

### Requirement: Mock visual parity has required evidence artifacts

Every module remediation child proposal SHALL produce mock visual parity
evidence comparing the active prototype and the current `frontend-new`
implementation under the same viewport, locale, theme, and navigation state.

#### Scenario: Module claims mock visual parity

- **WHEN** a child proposal marks a module mock-visually aligned
- **THEN** evidence SHALL include a prototype screenshot, a mock-current
  screenshot, a side-by-side contact sheet, a structured verdict, and an
  accepted-exception ledger if any differences remain
- **AND** a plain `page.screenshot()` call SHALL NOT be sufficient by itself.

### Requirement: Visual verdicts block child proposal archive

Visual comparison verdicts SHALL block archive when unresolved mismatches remain.

#### Scenario: Verdict finds a material mismatch

- **WHEN** the structured verdict marks any material layout, density,
  typography, color, interaction, empty-state, or information-hierarchy mismatch
  as `needs-fix`
- **THEN** the child proposal SHALL remain incomplete until the mismatch is fixed
  or converted into a source-linked accepted exception.

### Requirement: Mock functional evidence is separate from mock parity evidence

The remediation workflow SHALL classify mock functional E2E and mock visual
parity as separate gates.

#### Scenario: Mock visual spec passes

- **WHEN** a `test/e2e/*-visual.spec.ts` test passes by asserting text,
  interactions, console cleanliness, and screenshot capture
- **THEN** the evidence SHALL count as mock functional evidence
- **AND** SHALL NOT count as mock prototype parity unless the test or companion
  artifact compares the screenshot with the active prototype and records a
  verdict.

### Requirement: Real Gateway circuit breakers are bounded and explicit

Module child proposals SHALL attempt real Gateway evidence where relevant and
MAY circuit-break real validation only after bounded attempts with concrete
failure evidence.

#### Scenario: Real Gateway validation cannot complete

- **WHEN** real Gateway validation fails because of environment, credentials,
  seed data, upstream availability, or non-deterministic external state
- **THEN** the child proposal SHALL record command, environment, attempt count,
  observed failure, and next required action
- **AND** MAY archive only if mock functional evidence, mock prototype parity,
  and deterministic local fixes are complete.

### Requirement: Deterministic defects are fixed in the owning child proposal

Deterministic defects found during module remediation SHALL be fixed before the
owning child proposal archives.

#### Scenario: Remediation discovers a stale fixture or nullability defect

- **WHEN** remediation discovers a reproducible local code defect, stale mock
  assertion, fixture mismatch, BFF projection bug, API facade mismatch, or DTO
  nullability crash
- **THEN** the child proposal SHALL fix it and add focused verification
- **AND** SHALL NOT hand it off as a later real E2E uncertainty.

### Requirement: Accepted exceptions are structured

Accepted prototype deviations SHALL be explicit, source-linked, and reviewable.

#### Scenario: Production intentionally differs from prototype

- **WHEN** the final implementation intentionally differs from the active
  prototype
- **THEN** the child proposal SHALL record the prototype location, production
  file location, difference, reason, owner, and classification as Gateway
  constraint, product decision, or later redesign deferral.
