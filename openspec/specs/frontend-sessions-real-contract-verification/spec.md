# frontend-sessions-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-sessions-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Sessions contract chain is verified before completion

The Sessions implementation SHALL be reviewed against the full Deck Sessions,
chat history, usage/context, compaction, subagent lineage, mutation, UI
metadata, frontend wrapper, mock fixture, visual E2E, and real-stack evidence
chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Sessions module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for
  inventory, previews, detail, transcript history/cache, transcript search,
  export preview, usage/context, usage logs, compaction checkpoint list,
  compaction branch/restore, subagent lineage, parent/child navigation, reset,
  clear, patch, compact, delete, BFF-only browser behavior, and projected
  server-side pagination/stream refresh
- **AND** every workflow SHALL be classified as supported, degraded,
  unsupported, environment-dependent, empty-valid, skipped-safe, or
  handoff-blocked
- **AND** stale route, method, DTO, cache, mutation, lineage, compaction, usage,
  or Gateway assumptions SHALL be corrected or explicitly recorded as stale

### Requirement: Sessions production behavior stays contract-backed

The production Sessions panel SHALL expose only behavior backed by current
Deck-facing DTOs, frontend wrappers, Go BFF/runtime routes, or documented Deck
projections.

#### Scenario: Route and mutation truth is used

- **WHEN** Sessions handoff, frontend, backend, tests, or docs describe the
  contract chain
- **THEN** they SHALL name current wrappers and routes for inventory, previews,
  detail, chat history, usage/context, compaction, lineage, and session
  mutations
- **AND** they SHALL NOT claim server-side cursors, exhaustive patch schemas,
  real-time panel refresh, or real Gateway mutation safety unless verified in
  code and tests

#### Scenario: Destructive actions remain guarded

- **WHEN** an operator can compact or delete a session
- **THEN** the production panel SHALL require confirmation before invoking the
  backend wrapper
- **AND** real-stack verification SHALL skip or only safely reject destructive
  mutation when operator state safety is not proven

#### Scenario: Transcript cache and export remain local

- **WHEN** a selected session history is already cached
- **THEN** the panel SHALL reuse cached transcript data before fetching history
- **AND** export previews SHALL be generated from loaded transcript data without
  calling a server export endpoint

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

#### Scenario: Real Sessions mutation is unsafe or unavailable

- **WHEN** real reset, clear, delete, compact, patch, branch, or restore would
  affect uncontrolled operator state
- **THEN** the implementation SHALL skip the mutation safely or verify an
  expected rejection only
- **AND** the test SHALL record pass, degraded, skipped-safe, or
  handoff-blocked evidence after at most three fresh attempts

### Requirement: Sessions deterministic drift is fixed directly

Clear Sessions-scoped issues found during explore or verification SHALL be fixed
directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, UI metadata,
  endpoint classification, or test drift is discovered and no material product
  ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
