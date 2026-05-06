## ADDED Requirements

### Requirement: Subagents production UI matches the active runs/permissions workbench flow

The Subagents production panel SHALL use the active handoff prototype as the
visual and interaction reference while preserving current deck-go contract
truth.

#### Scenario: Operator opens Subagents workbench

- **WHEN** the operator navigates to Subagents
- **THEN** the first viewport SHALL show the Subagents brand, metric strip,
  runs/permissions mode control, filters, run list, selected run detail,
  lineage, action affordances, and global/default permission context
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Subagents child surfaces

- **WHEN** the operator filters/selects runs, opens detail tabs, reviews
  lineage/outcome/raw, edits permissions, opens steer/kill dialogs, or reviews
  unsupported audit state
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway browser calls.

### Requirement: Subagents contract chain remains BFF-only

Subagents browser code SHALL call only the Deck BFF/API facade and SHALL NOT
call the OpenClaw Gateway directly.

#### Scenario: Subagents data and actions are loaded

- **WHEN** the panel loads runs, lineage, kill, steer, agent subagent config,
  config writes, or global defaults
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Subagents live/config mutations are guarded

Subagents kill, steer, and per-agent permission writes SHALL remain guarded by
current route, ownership, and hash evidence.

#### Scenario: Operator starts a Subagents mutation

- **WHEN** the UI queues kill, steer, or permission save
- **THEN** the UI SHALL show the relevant dialog, target run/agent, or
  `configHash` evidence before calling the mutation wrapper
- **AND** successful mutation evidence SHALL record the returned DTO or cleanup
  result
- **AND** hash-missing, inactive-run, not-found, or unsupported outcomes SHALL
  be shown as degraded/warn/error states.

### Requirement: Persistent Subagents mutations are fixture-safe

Subagents real mutation evidence SHALL avoid unsafe claims against user
sessions or agent config.

#### Scenario: Real disposable target is unavailable

- **WHEN** kill, steer, or permission save cannot be proven run-scoped,
  disposable, and reversible in the current real environment
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record the action as confirmation-gated, skipped-safe, or deferred
- **AND** archive SHALL NOT claim those actions as automated real mutation
  capabilities.

### Requirement: Subagents mock evidence covers prototype states

Subagents mock visual and unit evidence SHALL exercise the prototype-shaped
product flow with contract-shaped fixture data.

#### Scenario: Mock Subagents evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover dense runs, search, filters, run selection,
  permissions mode, permission edit dialog, lineage, outcome/raw, audit
  degraded state, steer/kill dialogs, navigation affordances, localized copy,
  and empty/degraded states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Subagents real E2E verifies safe product flow and variants

Subagents real Gateway evidence SHALL exercise product behavior through the
Deck shell and real BFF/Gateway chain.

#### Scenario: Real Subagents UI variants are verified

- **WHEN** the real E2E verifies Subagents UI
- **THEN** it SHALL navigate from another shell panel into Subagents with the
  nav or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with selected-run or empty/degraded fallback,
  permissions mode, lineage/detail tabs, steer/kill/permission dialogs when
  safely available, and raw/audit states
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Subagents API shape is verified

- **WHEN** the real E2E verifies Subagents API routes
- **THEN** it SHALL verify runtime readiness, list, lineage, agents list,
  subagent config get, invalid kill, invalid steer, and skipped-safe mutation
  outcomes.

### Requirement: Subagents deterministic defects are fixed before archive

Deterministic Subagents defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Subagents remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, mutation guard bug, direct Gateway
  browser call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
