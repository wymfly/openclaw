# frontend-usage-prototype-parity-remediation Specification

## ADDED Requirements

### Requirement: Usage production UI matches the active read-only cost cockpit flow

The Usage production panel SHALL use the active handoff prototype as the visual
and interaction reference while preserving current deck-go contract truth.

#### Scenario: Operator opens Usage workbench

- **WHEN** the operator navigates to Usage
- **THEN** the first viewport SHALL show the Usage brand, cost summary, cost
  trend, provider quota/status, session usage inventory, range/filter/sort
  controls, and selected detail or empty selection
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Usage child surfaces

- **WHEN** the operator switches ranges, selects a provider, filters or sorts
  sessions, expands a session, or reviews logs/timeseries/context tabs
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway browser calls.

### Requirement: Usage contract chain remains BFF-only

Usage browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway directly.

#### Scenario: Usage data is loaded

- **WHEN** the panel loads cost, provider, session, log, or timeseries data
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and relative
  `/api/usage/*` routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Usage unsupported prototype actions remain honest

Usage production and evidence SHALL NOT claim unsupported prototype actions or
analytics as contract-backed features.

#### Scenario: Prototype-only analytic or mutation is encountered

- **WHEN** the prototype includes billing-grade accuracy, tenant accounting,
  forecasts, budget recommendations, quota mutation, or dependency-gated chart
  fidelity that lacks a verified Deck/Gateway contract or dependency decision
- **THEN** the implementation notes, tests, or accepted-exception ledger SHALL
  record the behavior as unsupported, skipped-safe, or deferred
- **AND** the production UI SHALL not silently wire fake successful mutations or
  unsupported analytics.

### Requirement: Usage mock evidence covers prototype-shaped rows

Usage mock visual and unit evidence SHALL exercise the read-only product flow
with contract-shaped fixture data.

#### Scenario: Mock Usage evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover cost KPIs, range switching, provider quota,
  search/filter/sort, session expansion, logs/timeseries/context tabs,
  localized copy, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Usage real E2E verifies safe product flow and variants

Usage real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Usage UI variants are verified

- **WHEN** the real E2E verifies Usage UI
- **THEN** it SHALL navigate from another shell panel into Usage with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with selected-session or empty fallback, provider
  selection, detail tabs, and filters
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Usage API shape is verified

- **WHEN** the real E2E verifies Usage API routes
- **THEN** it SHALL verify runtime readiness, cost, providers, sessions, legacy
  aliases, and logs/timeseries when a session key exists
- **AND** it SHALL record billing accuracy, tenant accounting, forecast, and
  quota mutation attempts as skipped-safe when no verified contract exists.

### Requirement: Usage deterministic defects are fixed before archive

Deterministic Usage defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Usage remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, direct Gateway browser call, or BFF
  route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
