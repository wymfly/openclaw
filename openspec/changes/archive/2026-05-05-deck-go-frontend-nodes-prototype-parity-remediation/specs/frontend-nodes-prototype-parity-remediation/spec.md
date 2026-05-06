## ADDED Requirements

### Requirement: Nodes production UI matches the active two-pane workbench flow

The Nodes production panel SHALL use the active handoff prototype as the visual
and interaction reference while preserving current deck-go contract truth.

#### Scenario: Operator opens Nodes workbench

- **WHEN** the operator navigates to Nodes
- **THEN** the first viewport SHALL show the Nodes brand, fleet/pairing KPI
  rail, pending pairing surface, node inventory, selected-node or pairing detail,
  lifecycle state, guarded actions, and contract-backed status/footer
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Nodes child surfaces

- **WHEN** the operator selects nodes or pairing requests, opens lifecycle,
  pairing, invoke, pending-work, capabilities, permissions, or raw payload
  surfaces
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway browser calls.

### Requirement: Nodes contract chain remains BFF-only

Nodes browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway directly.

#### Scenario: Nodes data and actions are loaded

- **WHEN** the panel loads inventory, detail, pairing, invoke, pending-work, or
  verification data
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Nodes dynamic envelopes remain explicit

Nodes invoke and pending-work evidence SHALL treat command-specific payload
leaves as dynamic contract surfaces rather than pretending typed schemas exist.

#### Scenario: Operator invokes a command or queues pending work

- **WHEN** the UI sends `node.invoke` or `node.pending.enqueue` through the BFF
- **THEN** it SHALL validate only the JSON envelope it can prove
- **AND** it SHALL render the BFF response verbatim
- **AND** archive SHALL NOT claim command-specific generated forms or typed
  payload semantics exist.

### Requirement: Non-disposable device mutations are skipped-safe

Nodes real mutation evidence SHALL avoid unsafe claims against user or device
state.

#### Scenario: Real mutation fixture is unavailable

- **WHEN** rename, invoke, pending enqueue, pair request, approve, reject, or
  verify cannot be proven disposable and reversible in the current real
  environment
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record the action as confirmation-gated, skipped-safe, or deferred
- **AND** archive SHALL NOT claim those actions as automated real mutation
  capabilities.

### Requirement: Nodes mock evidence covers prototype states

Nodes mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Nodes evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover inventory, selected node, pending pairing, orphan
  pairing, rename, approve/reject/request/verify confirmation, invoke JSON
  validation/result, pending enqueue, localized copy, and empty/degraded states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Nodes real E2E verifies safe product flow and variants

Nodes real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Nodes UI variants are verified

- **WHEN** the real E2E verifies Nodes UI
- **THEN** it SHALL navigate from another shell panel into Nodes with the nav or
  handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with selected-node or empty/degraded fallback,
  pairing surfaces, invoke and pending-work confirmation gates, and raw/dynamic
  output behavior
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Nodes API shape is verified

- **WHEN** the real E2E verifies Nodes API routes
- **THEN** it SHALL verify runtime readiness, inventory, pairing list, describe,
  invoke, pending enqueue, pair request, approve, reject, verify, and skipped-safe
  mutation outcomes.

### Requirement: Nodes deterministic defects are fixed before archive

Deterministic Nodes defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Nodes remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, mutation guard bug, direct Gateway
  browser call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
