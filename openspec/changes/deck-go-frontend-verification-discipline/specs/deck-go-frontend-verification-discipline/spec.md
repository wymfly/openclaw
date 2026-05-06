## ADDED Requirements

### Requirement: Frontend remediation SHALL start from a tracked fact baseline

Each deck-go frontend remediation change that is based on an external or cross-agent review SHALL create or update a tracked fact baseline before implementation tasks are marked complete. The baseline SHALL classify each material review claim as `accepted`, `corrected`, `rejected`, or `deferred-uncertain`, and each classification SHALL cite current repository evidence.

#### Scenario: Accepted review claim has evidence

- **WHEN** a review claim is marked `accepted`
- **THEN** the fact baseline SHALL cite at least one current command, file path, or deterministic code reference proving the claim
- **AND** the command or reference SHALL be specific enough for another agent to rerun or inspect it.

#### Scenario: Incorrect review claim is corrected

- **WHEN** current code contradicts a review claim
- **THEN** the fact baseline SHALL mark the claim `corrected`
- **AND** SHALL include the corrected fact and evidence for the correction.

#### Scenario: Unclear review claim is deferred

- **WHEN** a review claim cannot be proven or disproven without human visual judgment or new product decisions
- **THEN** the fact baseline SHALL mark it `deferred-uncertain`
- **AND** implementation tasks SHALL NOT treat that claim as a required fix unless a later proposal upgrades it with evidence.

### Requirement: Task completion SHALL require fresh verification evidence

Tasks in a frontend verification-discipline change SHALL be checked complete only after the implementation has produced fresh evidence in the same working tree. Historical OpenSpec task checkboxes, prior session memory, and untracked `.local` artifacts SHALL be supporting context only.

#### Scenario: Task checkbox is marked complete

- **WHEN** an implementation marks a task checkbox complete
- **THEN** the task or a linked tracked artifact SHALL name the verification command or inspected file evidence used for that checkbox
- **AND** the evidence SHALL have been gathered after the relevant implementation edit.

#### Scenario: Verification command fails

- **WHEN** a required verification command fails
- **THEN** the related task SHALL remain unchecked
- **AND** the failure SHALL be fixed or recorded as a blocker with scope, command output summary, and next action.

#### Scenario: Historical evidence exists but current evidence is missing

- **WHEN** an old implementation note or archived proposal says a check passed
- **THEN** the current task SHALL NOT be marked complete until current evidence is gathered or the task explicitly records why current evidence is impossible.

### Requirement: Evidence manifests SHALL be tracked and level-specific

Module closure evidence SHALL be summarized in tracked text or JSON manifests. The manifests SHALL distinguish `mock-functional`, `mock-prototype-parity`, and `real-gateway` evidence, including command, artifact path, verdict status, run id when applicable, and accepted exceptions.

#### Scenario: Evidence exists only under ignored local artifacts

- **WHEN** screenshots, Playwright output, or parity reports live under `.local`
- **THEN** a tracked manifest SHALL cite those artifact paths and commands
- **AND** the module SHALL NOT claim signed-off closure solely because ignored artifacts exist.

#### Scenario: Prototype parity verdict is unreviewed

- **WHEN** a parity report verdict is `unreviewed`
- **THEN** the manifest SHALL preserve `unreviewed`
- **AND** README reverse sign-off SHALL NOT claim high-fidelity visual acceptance for that module.

#### Scenario: Real Gateway evidence is degraded

- **WHEN** real Gateway validation is `degraded`, `empty-valid`, `skipped-safe`, or `handoff-blocked`
- **THEN** the manifest SHALL record the bounded status and reason
- **AND** deterministic local code defects discovered during that validation SHALL be fixed or moved to a linked follow-up change.

### Requirement: Frontend verification inventory SHALL be machine-checkable

deck-go SHALL provide deterministic inventory checks for the accepted frontend closure facts: README status format, reverse sign-off presence, panel token namespace drift, panel a11y coverage, token mirror drift, and shared list primitive panel usage.

#### Scenario: Inventory check runs

- **WHEN** the frontend verification inventory check is run
- **THEN** it SHALL print counts for the accepted fact categories
- **AND** it SHALL exit non-zero for categories that this change defines as closure blockers.

#### Scenario: Inventory check finds a non-blocking concern

- **WHEN** the inventory check finds a concern intentionally classified as follow-up
- **THEN** it SHALL print the concern with its classification
- **AND** it SHALL NOT silently omit the concern from the report.
