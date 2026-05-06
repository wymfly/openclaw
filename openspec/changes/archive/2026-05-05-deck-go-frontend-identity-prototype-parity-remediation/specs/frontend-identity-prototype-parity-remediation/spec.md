## ADDED Requirements

### Requirement: Identity production UI matches the active registry workbench flow

The Identity production panel SHALL use the active handoff prototype as the
visual and interaction reference while preserving current deck-go contract
truth.

#### Scenario: Operator opens Identity workbench

- **WHEN** the operator navigates to Identity
- **THEN** the first viewport SHALL show canonical inventory, peer count,
  channel mix, baseHash state, canonical rail, selected canonical detail, peer
  mappings, mutation-safety state, and unsupported/projection states where
  applicable
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Identity child surfaces

- **WHEN** the operator searches canonicals, selects a canonical, opens raw
  payload, opens Link peer, submits a safe link, unlinks a run-scoped peer, or
  clicks unsupported create/rename/delete controls
- **THEN** the UI SHALL update local state through the Deck-facing DTOs and BFF
  wrappers
- **AND** it SHALL avoid direct Gateway calls.

### Requirement: Identity contract chain remains BFF-only

Identity browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway, localstore, or workspace filesystem directly.

#### Scenario: Identity data and actions are loaded

- **WHEN** the panel loads identity links, submits link/unlink, or loads agent
  identity hints
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Identity mutations are baseHash-guarded and skipped-safe

Identity mutation evidence SHALL use the current `configHash` and avoid unsafe
or unsupported action claims.

#### Scenario: Operator links or unlinks a peer

- **WHEN** the operator submits a link or unlink mutation
- **THEN** the request SHALL include the current `baseHash`
- **AND** the UI SHALL refetch identity links after success or failure
- **AND** real E2E SHALL create only run-scoped disposable fixtures when
  cleanup can safely unlink them.

#### Scenario: Prototype assumes unsupported identity actions

- **WHEN** create canonical, rename canonical, delete canonical, peer activity,
  or recent mutation audit is unavailable from current contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as unsupported, degraded, projection, or follow-up
  contracts
- **AND** archive SHALL NOT claim those actions as verified direct Gateway
  product capabilities.

### Requirement: Identity mock evidence covers prototype states

Identity mock visual and unit evidence SHALL exercise the prototype-shaped
product flow with contract-shaped fixture data.

#### Scenario: Mock Identity evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover canonical inventory, search/selection, peer rows,
  raw payload, baseHash state, link dialog, link mutation, unsupported actions,
  localized copy, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Identity real E2E verifies safe product flow and variants

Identity real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Identity UI variants are verified

- **WHEN** the real E2E verifies Identity UI
- **THEN** it SHALL navigate from another shell panel into Identity with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with canonical search/selection, raw payload, Link
  dialog, safe link/unlink or skipped-safe fallback, unsupported actions, and
  empty/projection states
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Identity API shape is verified

- **WHEN** the real E2E verifies Identity API routes
- **THEN** it SHALL verify runtime readiness, identity list shape, `configHash`
  availability or absence, optional run-scoped link/unlink mutation evidence,
  agent identity route shape, and unsupported/skipped-safe outcomes.

### Requirement: Identity deterministic defects are fixed before archive

Deterministic Identity defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Identity remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, mutation guard bug, projection shape
  bug, direct Gateway browser call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
