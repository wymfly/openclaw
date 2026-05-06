# frontend-prototype-parity-remediation Specification

## Purpose

TBD - created by archiving change deck-go-frontend-prototype-parity-gate. Update Purpose after archive.

## Requirements

### Requirement: Shared parity gate precedes module remediation

The frontend prototype parity remediation program SHALL establish a shared
prototype-current evidence gate before module child proposals claim new visual
parity results.

#### Scenario: First module remediation begins

- **WHEN** the `agents` remediation child proposal starts implementation
- **THEN** the shared parity gate SHALL already provide repeatable contact-sheet
  and verdict artifact generation
- **AND** currently known stale mock visual spec failures SHALL be repaired or
  explicitly owned by the gate child proposal.

### Requirement: Activity child proposal closes the Activity matrix row

The frontend prototype parity remediation head SHALL treat the Activity row as complete only when the Activity child proposal has finished prototype reconciliation, deterministic fixes, mock parity evidence, strengthened real Gateway evidence or bounded handoff, and archive validation.

#### Scenario: Activity row is marked complete

- **WHEN** `deck-go-frontend-activity-prototype-parity-remediation` is archived
- **THEN** the head matrix SHALL record the archive path, mock parity status, real evidence status, accepted exceptions, and final verdict for `activity`
- **AND** head task `5.1` SHALL be marked complete only after those evidence fields are updated.

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

### Requirement: Real Gateway evidence covers product navigation, variants, and interactions

Module child proposals SHALL exercise the product UI against the real
Gateway/deck-go chain rather than relying only on direct RPC smoke tests.

#### Scenario: Module real Gateway evidence is claimed

- **WHEN** a child proposal marks real Gateway evidence as passed for a module
- **THEN** evidence SHALL include navigation from the Deck shell to the module
  main page
- **AND** SHALL include dark/English, dark/Chinese, light/English, and
  light/Chinese product-surface coverage unless the child proposal records a
  specific skipped-safe reason for any omitted variant
- **AND** SHALL exercise every meaningful child page, tab, dialog, or subview
  that belongs to the module's safe product surface with Playwright assertions
  that it is interactive
- **AND** SHALL NOT replace shell-driven product-flow evidence with direct panel
  URLs or direct RPC checks alone
- **AND** SHALL record unexpected console, page, and BFF API errors.

### Requirement: Real Gateway tests create safe run-scoped data where possible

Module real Gateway tests SHALL create representative real data in the isolated
test environment when the data source is safely writable.

#### Scenario: Gateway-backed fixture can be created safely

- **WHEN** the module's data comes from isolated `openclaw.json`, isolated
  workspace files, sessions, or a Gateway/Deck BFF mutation with reversible
  state
- **THEN** the child proposal SHALL create run-scoped fixture data through the
  Gateway RPC, Deck BFF route, or isolated file/config setup
- **AND** cleanup SHALL refuse to delete or mutate targets that do not include
  the current run id
- **AND** direct user/global state SHALL NOT be mutated outside the isolated real
  E2E state.

#### Scenario: Empty real data would weaken product validation

- **WHEN** a module normally depends on configured OpenClaw resources,
  `openclaw.json` entries, workspace session files, or other Gateway-backed
  state
- **THEN** the real E2E SHALL attempt representative run-scoped fixture creation
  before accepting an empty-state-only UI pass
- **AND** the evidence SHALL record the fixture method used: Gateway RPC, Deck
  BFF mutation, isolated `openclaw.json` setup, isolated workspace/session setup,
  or skipped-safe circuit breaker
- **AND** Playwright assertions SHALL cover the user-visible post-fixture flow,
  including list/detail and main/subpage surfaces where the module provides them.

#### Scenario: Fixture creation is too risky

- **WHEN** the fixture would touch high-impact external accounts, installed
  skills, device tokens, user memory, or another non-isolated resource
- **THEN** the child proposal MAY mark the mutation skipped-safe
- **AND** SHALL still run safe read/UI evidence and record what fixture support
  is missing.

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
