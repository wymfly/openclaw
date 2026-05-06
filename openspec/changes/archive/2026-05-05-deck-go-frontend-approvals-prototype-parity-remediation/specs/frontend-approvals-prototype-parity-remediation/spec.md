## ADDED Requirements

### Requirement: Approvals active prototype is pinned before remediation

The approvals remediation SHALL identify the active visual target before
changing or validating production UI.

#### Scenario: Approvals prototype files are inspected

- **WHEN** approvals remediation begins
- **THEN** `deck-go/frontend-handoff/modules/approvals/prototype.html` SHALL be
  treated as the active visual target
- **AND** older files such as `prototype-v1-codex.html` SHALL be treated as
  historical context unless the handoff README declares them active.

### Requirement: Approvals contract truth controls production behavior

The approvals remediation SHALL reconcile prototype assumptions with the actual
Deck approval DTOs, routes, stream payloads, and mutation evidence.

#### Scenario: Prototype decision or plugin fields differ from contract truth

- **WHEN** prototype data uses unsupported fields, underscore decision labels,
  reason submission, audit projections, or summary KPIs
- **THEN** production SHALL follow the current Deck/Gateway contract chain
- **AND** unsupported prototype behavior SHALL be documented as an accepted
  exception or follow-up contract decision.

### Requirement: Approvals strict mock prototype parity evidence is produced

The approvals remediation SHALL produce strict mock prototype parity evidence
under the shared remediation gate.

#### Scenario: Approvals visual parity is claimed

- **WHEN** this change marks approvals visually aligned
- **THEN** evidence SHALL include prototype screenshot, mock-current screenshot,
  side-by-side comparison artifact, structured verdict, and
  accepted-exception ledger if differences remain
- **AND** a passing mock visual Playwright spec alone SHALL NOT be sufficient.

### Requirement: Approvals deterministic defects are fixed before archive

Deterministic approvals defects found during remediation SHALL be fixed in this
child proposal before archive.

#### Scenario: Scoped defect is discovered

- **WHEN** remediation discovers a reproducible approvals UI, fixture, stream,
  API facade, contract, Go adapter, DTO, or handoff-doc defect
- **THEN** the proposal SHALL fix the defect and run focused verification
- **AND** the defect SHALL NOT be handed off as real Gateway uncertainty.

### Requirement: Approvals real Gateway evidence is safe and bounded

Approvals real Gateway evidence SHALL avoid unsafe real approval or policy
mutations unless disposable fixtures and cleanup are proven.

#### Scenario: Real mutation fixture is unavailable

- **WHEN** safe run-scoped approval or policy mutation fixtures cannot be
  established
- **THEN** real evidence SHALL be limited to safe reads, UI rendering, and
  BFF-only browser transport checks
- **AND** mutation workflows SHALL be recorded as skipped-safe or
  handoff-blocked with command, observed behavior, and next action.

### Requirement: Approvals real E2E covers shell navigation, variants, and child interactions

Approvals real Gateway evidence SHALL exercise the user-facing product surface,
not only API probes.

#### Scenario: Approvals real E2E is claimed

- **WHEN** this change records real Gateway evidence for Approvals
- **THEN** the evidence SHALL start from the Deck shell and navigate to the
  Approvals module through the product navigation
- **AND** the evidence SHALL cover both light and dark themes
- **AND** the evidence SHALL cover both English and Chinese locale rendering
- **AND** the evidence SHALL interact with safe child surfaces such as queue
  selection, detail rendering, policy read UI, stream status, and safe
  disabled/skipped mutation controls.

### Requirement: Approvals test data uses isolated real fixtures when safe

Approvals remediation SHALL create real test data only when the data is
run-scoped, reversible, and not shared with operator state.

#### Scenario: Approval or policy fixture creation is considered

- **WHEN** remediation needs real approval or policy data beyond existing
  Gateway state
- **THEN** the fixture path SHALL prove run-scoped creation, targeted cleanup,
  and refusal to mutate non-run-scoped resources before being used
- **AND** if that proof is unavailable after bounded attempts, the workflow
  SHALL keep the mutation skipped-safe and record the failed/blocked fixture
  evidence in the handoff.
