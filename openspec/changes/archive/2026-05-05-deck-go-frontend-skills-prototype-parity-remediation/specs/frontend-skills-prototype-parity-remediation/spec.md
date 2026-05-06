## ADDED Requirements

### Requirement: Skills production UI matches the active catalog flow

The Skills production panel SHALL use the active handoff prototype product flow
as its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Skills

- **WHEN** the operator navigates to Skills
- **THEN** the first viewport SHALL show a Skills catalog with page title, KPI
  strip, Installed/Hub segmented mode control, search/filter controls, dense
  skill rows, and refresh/update actions
- **AND** installed skill source, status, setup requirements, primary env/config
  hints, and hub result metadata SHALL be visible through row or KPI affordances.

#### Scenario: Operator drills into a skill

- **WHEN** the operator selects an installed skill row
- **THEN** the panel SHALL show a skill detail surface with back navigation,
  skill hero, status/source pills, and tabs for Overview, Setup, Triggers, Bins,
  Files, and Audit
- **AND** tabs with unavailable contract data SHALL show explicit empty or
  projected-unavailable states rather than fabricated backend data.

### Requirement: Skills contract chain remains BFF/Gateway scoped

The Skills frontend SHALL continue to use deck-go BFF and generated runtime
Gateway transport wrappers for all data and mutations.

#### Scenario: Skills data loads

- **WHEN** Skills loads installed inventory, hub bins/search/detail, and agent
  skill matrix data
- **THEN** it SHALL use existing frontend wrappers for those surfaces
- **AND** browser code SHALL NOT call the OpenClaw Gateway, ClawHub, package
  manager, or filesystem directly.

#### Scenario: Skills mutation is requested

- **WHEN** an operator configures, enables, disables, installs, updates, or
  changes agent skill assignment
- **THEN** the mutation SHALL go through the existing Deck BFF wrapper
- **AND** unsupported or unsafe real write paths SHALL be labelled as
  skipped-safe or unavailable in real E2E evidence.

### Requirement: Skills real E2E attempts safe run-scoped fixture data

Skills real Gateway evidence SHALL attempt representative fixture creation only
when isolation can be proven.

#### Scenario: Real Skills fixture can be safely created

- **WHEN** the real E2E can create a disposable workspace/config skill entry
  whose id or name includes the current run id
- **THEN** it SHALL create that fixture through a Deck BFF/Gateway/config or
  isolated workspace path
- **AND** SHALL verify the run-scoped skill through the user-visible Skills UI.

#### Scenario: Real Skills fixture is unsafe

- **WHEN** fixture creation would touch operator-global installed skills,
  package manager binaries, hub-managed bins, credentials, or non-run-scoped
  workspace state
- **THEN** the test SHALL circuit-break as skipped-safe with evidence
- **AND** SHALL still verify real read surfaces, shell navigation, variants,
  detail interactions, and BFF-only browser transport.

### Requirement: Skills real E2E covers navigation, variants, and interactions

Skills real Gateway UI evidence SHALL exercise the product UI through Deck shell
navigation and supported variants.

#### Scenario: Real Skills UI variants are verified

- **WHEN** the real E2E verifies Skills UI
- **THEN** it SHALL navigate from another shell panel into Skills with the nav
  button
- **AND** SHALL verify one dark English render and one light Chinese render
- **AND** SHALL interact with Installed search/filter, detail tabs, Hub search
  or bins/detail surfaces when safe, and back navigation
- **AND** SHALL record unexpected console, page, BFF API, direct Gateway request,
  and direct Gateway websocket errors.

### Requirement: Skills unsupported projections are explicit

Prototype-only Skills projections SHALL be labelled instead of silently claimed.

#### Scenario: Triggers, files, audit, or managed-bin state is not contract-backed

- **WHEN** triggers, files, audit history, managed-bin removal, or synchronous
  install progress is unavailable from current Deck-facing DTOs
- **THEN** the UI, tests, or implementation notes SHALL record it as projected,
  unavailable, skipped-safe, or accepted exception
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.
