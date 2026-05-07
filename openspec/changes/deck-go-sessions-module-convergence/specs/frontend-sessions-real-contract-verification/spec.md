## MODIFIED Requirements

### Requirement: Sessions contract chain is verified before completion

The Sessions implementation SHALL be reviewed against the full Deck Sessions,
chat history, usage/context, compaction, subagent lineage, mutation, UI
metadata, frontend wrapper, mock fixture, visual E2E, and real-stack evidence
chain before this change is marked complete. This verification SHALL happen
before and after the information-architecture rewrite so the UI convergence
does not hide contract drift.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Sessions module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for
  inventory, previews, detail, transcript history/cache, transcript search,
  export preview, usage/context, usage logs, compaction checkpoint list,
  compaction branch/restore, subagent lineage, parent/child navigation, reset,
  clear, patch, compact, delete, create/send/abort/steer adjacency, BFF-only
  browser behavior, Gateway-only parameter knobs, and projected server-side
  pagination/stream refresh
- **AND** every workflow SHALL be classified as supported, degraded,
  unsupported, environment-dependent, empty-valid, skipped-safe,
  adjacent-owned, product-local, or handoff-blocked
- **AND** stale route, method, DTO, cache, mutation, lineage, compaction, usage,
  UI hierarchy, or Gateway assumptions SHALL be corrected or explicitly
  recorded as stale

### Requirement: Sessions deterministic drift is fixed directly

Clear Sessions-scoped issues found during explore or verification SHALL be
fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, UI metadata,
  endpoint classification, test drift, or production behavior drift is
  discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
- **AND** implementation SHALL continue through the deterministic fix before
  claiming the Sessions module convergence is complete

### Requirement: Sessions has bounded real-stack evidence

The Sessions implementation SHALL include bounded L2 real-stack verification
for the Sessions BFF and runtime contract chain.

#### Scenario: Real stack exposes Sessions route shapes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify safe response shapes for session inventory,
  selected detail when available, chat history when available, usage/context,
  usage logs, compaction list when safe, lineage when applicable, and the
  production Sessions UI
- **AND** the production Sessions UI SHALL render against the real BFF without
  browser-side direct Gateway calls
- **AND** empty session lists, missing usage rows, missing compaction
  checkpoints, or unsupported lineage SHALL be recorded as empty-valid or
  degraded when route shape and UI behavior remain correct
- **AND** the production UI evidence SHALL include at least one Inspector tab
  switch after this convergence change
- **AND** the production UI evidence SHALL verify that reset, clear, compact,
  delete, and restore confirmation-required actions arm confirmation without
  unsafe first-click execution when those controls are visible

#### Scenario: Real Sessions mutation is unsafe or unavailable

- **WHEN** real reset, clear, delete, compact, patch, branch, or restore would
  affect uncontrolled operator state
- **THEN** the implementation SHALL skip the mutation safely or verify an
  expected rejection only
- **AND** the test SHALL record pass, degraded, skipped-safe, or
  handoff-blocked evidence after at most three fresh attempts
- **AND** run-scoped fixture mutations SHALL be allowed only when cleanup
  rejects targets that do not contain the current run id
