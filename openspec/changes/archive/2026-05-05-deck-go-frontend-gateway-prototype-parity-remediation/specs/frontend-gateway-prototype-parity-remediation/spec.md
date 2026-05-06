## ADDED Requirements

### Requirement: Gateway production UI matches the active control-plane workbench flow

The Gateway production panel SHALL use the active handoff prototype as the
visual and interaction reference while preserving current deck-go contract
truth.

#### Scenario: Operator opens Gateway workbench

- **WHEN** the operator navigates to Gateway
- **THEN** the first viewport SHALL show runtime state, Gateway health/status,
  key metrics, channel/heartbeat evidence, describe entry points, batch
  affordance state, and projection summaries where available
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Gateway child surfaces

- **WHEN** the operator searches describe methods/events, filters by scope,
  inspects method/event detail, opens Batch console, runs a safe read-only
  batch, or opens Activity/projection tabs
- **THEN** the UI SHALL update local state without changing the Deck-facing DTO
  shape
- **AND** it SHALL avoid direct Gateway calls.

### Requirement: Gateway contract chain remains BFF-only

Gateway browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway, localstore, or workspace filesystem directly.

#### Scenario: Gateway data and actions are loaded

- **WHEN** the panel loads runtime summary, capabilities, health, status,
  describe, batch, activity, monitor runs, or monitor stats
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Gateway batch is safe and runtime-mode-aware

Gateway batch submission SHALL be restricted to safe read-only bundled-mode
operations.

#### Scenario: Operator uses batch console

- **WHEN** the operator opens the batch console
- **THEN** the UI SHALL expose only read-only methods advertised by
  `gateway.describe`
- **AND** it SHALL exclude `gateway.batch`, subscription methods, and
  `operator.write` methods
- **AND** remote-mode or unsafe batch paths SHALL be disabled, degraded, or
  skipped-safe with visible product state.

### Requirement: Gateway projections are explicit

Gateway projections SHALL be explicit: prototype-only, BFF-projected,
environment-only, or future Gateway projections SHALL be labelled instead of
silently claimed as direct Gateway-backed features.

#### Scenario: Prototype assumes unsupported or projected behavior

- **WHEN** throughput streaming, durable Gateway audit, non-empty monitor
  history, remote batch, mutating batch, lifecycle controls, or full health
  schema detail is unavailable or unsafe from current contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as projected, empty-valid, unsupported, degraded,
  skipped-safe, or follow-up contracts
- **AND** archive SHALL NOT claim those projections as fully verified direct
  Gateway product capabilities.

### Requirement: Gateway mock evidence covers prototype states

Gateway mock visual and unit evidence SHALL exercise the prototype-shaped
product flow with contract-shaped fixture data.

#### Scenario: Mock Gateway evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover runtime/health/status metrics, channel and
  heartbeat rails, Methods & Events explorer, scope/search/detail interactions,
  batch console, safe batch result, Activity/projection states, localized copy,
  and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Gateway real E2E verifies safe product flow and variants

Gateway real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Gateway UI variants are verified

- **WHEN** the real E2E verifies Gateway UI
- **THEN** it SHALL navigate from another shell panel into Gateway with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with describe search/scope/detail, Batch console,
  safe read-only batch or disabled fallback, Activity/projection tabs, and
  skipped-safe lifecycle/mutating controls
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Gateway API shape is verified

- **WHEN** the real E2E verifies Gateway API routes
- **THEN** it SHALL verify runtime readiness, capabilities, health, status,
  describe, read-only `gateway.describe` batch, activity, monitor runs, monitor
  stats, and selected monitor detail when available
- **AND** it SHALL record route payload shapes and any empty-valid or
  skipped-safe projection outcome.

### Requirement: Gateway deterministic defects are fixed before archive

Deterministic Gateway defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Gateway remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, unsafe batch-gating bug, projection
  shape bug, direct Gateway browser call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
