## ADDED Requirements

### Requirement: Handoff implementation requires prototype parity evidence

The frontend handoff protocol SHALL require production implementation evidence
to compare the active module prototype against the real `frontend-new` page when
a module claims high-fidelity visual alignment.

#### Scenario: Claude Code marks a module implemented

- **WHEN** Claude Code updates a `frontend-handoff/modules/<module>/README.md`
  status to implemented or records an implementation-complete note
- **THEN** it SHALL also produce or link prototype parity evidence containing
  prototype screenshot, current screenshot, side-by-side comparison, visual
  verdict, and accepted exceptions
- **AND** screenshot capture without comparison SHALL NOT be described as visual
  alignment.

### Requirement: Mock visual specs identify their evidence level

The frontend handoff protocol SHALL require module visual tests to state whether
they prove mock functional rendering or mock prototype parity.

#### Scenario: A visual spec only captures screenshots

- **WHEN** a `test/e2e/*-visual.spec.ts` file opens a mock-backed panel and saves
  screenshots without comparing to the active prototype
- **THEN** the module evidence SHALL be labeled mock functional screenshot
  evidence
- **AND** the module SHALL still require a separate prototype parity verdict
  before high-fidelity alignment is claimed.

### Requirement: Reverse sign-off uses current code evidence

The frontend handoff protocol SHALL base reverse sign-off on current code,
current screenshots, and current prototype files rather than historical task
checkboxes.

#### Scenario: Historical OpenSpec task says visual E2E passed

- **WHEN** a historical OpenSpec task says a visual E2E passed
- **THEN** reverse sign-off SHALL inspect the actual current implementation,
  current mock/real screenshot evidence, and active prototype
- **AND** SHALL treat the historical checkbox as supporting context only, not a
  final sign-off.
