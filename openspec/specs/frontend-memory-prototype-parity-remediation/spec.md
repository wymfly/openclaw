# frontend-memory-prototype-parity-remediation Specification

## Purpose

TBD - created by archiving change deck-go-frontend-memory-prototype-parity-remediation. Update Purpose after archive.

## Requirements

### Requirement: Memory production UI matches the active four-tab workbench flow

The Memory production panel SHALL use the active handoff prototype as the visual
and interaction reference while preserving current deck-go contract truth.

#### Scenario: Operator opens Memory workbench

- **WHEN** the operator navigates to Memory
- **THEN** the first viewport SHALL show the Memory brand, Browse/Search/Health/Dreams
  tabs, memory summary KPIs, agent selector, browse tree, content viewer, and
  contract-backed status/footer
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Memory child tabs

- **WHEN** the operator browses directories, reads a file, searches memory,
  opens health, opens dreams, reads a diary, or triggers a safe maintenance
  affordance
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway, LanceDB, or filesystem browser calls.

### Requirement: Memory contract chain remains BFF-only

Memory browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway, LanceDB, localstore, or workspace filesystem directly.

#### Scenario: Memory data and actions are loaded

- **WHEN** the panel loads browse/read/search/health/dreams data
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Memory search degraded state is explicit

Memory search evidence SHALL treat unavailable LanceDB semantics as an explicit
degraded product state rather than a successful semantic search.

#### Scenario: Search adapter is unavailable

- **WHEN** `POST /api/memory/search` returns `501` or `lanceDbEnabled=false`
- **THEN** the UI SHALL show degraded/unavailable search copy
- **AND** archive SHALL NOT claim semantic search is backed by real LanceDB.

### Requirement: Destructive dream actions are skipped-safe

Memory dream maintenance evidence SHALL avoid unsafe mutation claims.

#### Scenario: Operator opens destructive dream action

- **WHEN** reset, resetShortTerm, backfill, repair, or dedupe cannot be proven
  disposable and reversible in the current real environment
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record the action as confirmation-gated, skipped-safe, or deferred
- **AND** archive SHALL NOT claim those actions as automated real mutation
  capabilities.

### Requirement: Memory mock evidence covers prototype states

Memory mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Memory evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover Browse, file read, Search, degraded search, Health,
  Dreams, dream action result, destructive confirmation, localized copy, and
  empty/degraded states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Memory real E2E verifies safe product flow and variants

Memory real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Memory UI variants are verified

- **WHEN** the real E2E verifies Memory UI
- **THEN** it SHALL navigate from another shell panel into Memory with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with Browse, Search, Health, Dreams, safe read or
  degraded fallback, confirmation-gated dream actions, and empty/degraded states
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Memory API shape is verified

- **WHEN** the real E2E verifies Memory API routes
- **THEN** it SHALL verify runtime readiness, browse/read availability or
  absence, canonical POST search and compatibility GET search shape, health
  shape, dream diary read shape, and skipped-safe destructive action outcomes.

### Requirement: Memory deterministic defects are fixed before archive

Deterministic Memory defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Memory remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, mutation guard bug, direct Gateway
  browser call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
