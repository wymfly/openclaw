## ADDED Requirements

### Requirement: Routing production UI matches the active queue/detail workbench flow

The Routing production panel SHALL use the active handoff prototype as the
visual and interaction reference while preserving current deck-go contract
truth.

#### Scenario: Operator opens Routing workbench

- **WHEN** the operator navigates to Routing
- **THEN** the first viewport SHALL show the Routing brand, metric strip,
  config hash, DM scope controls, binding queue, selected binding detail,
  simulator, activity, and mutation confirmation affordances
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Routing child surfaces

- **WHEN** the operator filters/selects bindings, opens a draft, validates,
  adds, removes, moves, simulates, patches scope, or reviews activity
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway browser calls.

### Requirement: Routing contract chain remains BFF-only

Routing browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway directly.

#### Scenario: Routing data and actions are loaded

- **WHEN** the panel loads list, validation, add, remove, simulate, scope, or
  activity data
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Routing mutations remain config-hash aware

Routing add, remove, move, and DM scope mutations SHALL use current hash
evidence and SHALL NOT silently mutate stale config.

#### Scenario: Operator starts a routing mutation

- **WHEN** the UI queues add, remove, move, or scope patch
- **THEN** the confirmation gate SHALL include the current `configHash` or
  source hash evidence
- **AND** successful mutation evidence SHALL record the returned hash or cleanup
  result
- **AND** hash-mismatch failures SHALL be shown as degraded/warn states.

### Requirement: Persistent routing mutations are fixture-safe

Routing real mutation evidence SHALL avoid unsafe claims against user routing
config.

#### Scenario: Real add/remove fixture is unavailable

- **WHEN** add, remove, move, or scope patch cannot be proven run-scoped,
  disposable, and reversible in the current real environment
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record the action as confirmation-gated, skipped-safe, or deferred
- **AND** archive SHALL NOT claim those actions as automated real mutation
  capabilities.

### Requirement: Routing mock evidence covers prototype states

Routing mock visual and unit evidence SHALL exercise the prototype-shaped
product flow with contract-shaped fixture data.

#### Scenario: Mock Routing evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover list, filters, selection, draft add/validate,
  remove, move, DM scope patch, simulate, activity, navigation affordances,
  localized copy, and empty/degraded states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Routing real E2E verifies safe product flow and variants

Routing real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Routing UI variants are verified

- **WHEN** the real E2E verifies Routing UI
- **THEN** it SHALL navigate from another shell panel into Routing with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with selected-binding or empty/degraded fallback,
  add/remove/scope confirmation gates, simulator, activity, and hash evidence
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Routing API shape is verified

- **WHEN** the real E2E verifies Routing API routes
- **THEN** it SHALL verify runtime readiness, list, validate, simulate, add,
  remove, invalid/hash mismatch, and skipped-safe mutation outcomes.

### Requirement: Routing deterministic defects are fixed before archive

Deterministic Routing defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Routing remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, mutation guard bug, direct Gateway
  browser call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
