## ADDED Requirements

### Requirement: Channels production UI matches the active v2 flow

The Channels production panel SHALL use the active handoff prototype product
flow as its visual and interaction target while preserving current deck-go
contract truth.

#### Scenario: Operator opens Channels list

- **WHEN** the operator navigates to Channels
- **THEN** the first viewport SHALL show a full-width Channels list view with a
  header, KPI strip, search/filter toolbar, row header, and channel inventory
  rows or a recoverable empty/error state
- **AND** the list view SHALL use the active v2 handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator opens a channel detail view

- **WHEN** the operator selects a channel row
- **THEN** the panel SHALL switch to a full-width detail view with back control,
  channel hero, status metadata, tab bar, and tab body
- **AND** the tab bar SHALL expose Overview, Throughput, Probe, Settings,
  Routing, and WeCom access only when the selected channel supports WeCom
  access.

### Requirement: Channels contract chain remains BFF-only

Channels browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway directly.

#### Scenario: Channel inventory and actions are loaded

- **WHEN** the panel loads inventory, tests a channel, fetches throughput,
  logs out, patches channel settings, loads routing, or displays WeCom access
- **THEN** the browser SHALL use `frontend-new/src/api.ts` wrappers and Deck BFF
  routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Channels unsupported projections are explicit

Prototype-only Channels projections SHALL be labelled instead of silently
claimed as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or degraded data

- **WHEN** channel creation, rich real throughput, normalized server-side
  account diagnostics, normalized `wecomAccess`, probe history, routing add
  drawer, or destructive account/provider mutations are unavailable from current
  Deck-facing contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as disabled, mock-only, degraded, skipped-safe, or follow-up
  contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.

### Requirement: Channels mock evidence covers list-detail prototype states

Channels mock visual and unit evidence SHALL exercise the prototype-shaped
product flow with contract-shaped fixture data.

#### Scenario: Mock Channels evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover list search/filter, row selection, detail back
  navigation, Overview, Throughput, Probe, Settings, Routing, WeCom access,
  dialogs or disabled create state, empty/error states, and localized UI
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Channels real E2E verifies safe route shape and variants

Channels real Gateway evidence SHALL exercise product behavior through the
Deck shell and real BFF/Gateway chain.

#### Scenario: Real Channels UI variants are verified

- **WHEN** the real E2E verifies Channels UI
- **THEN** it SHALL navigate from another shell panel into Channels with the nav
  or handoff control
- **AND** it SHALL verify one dark English render and one light Chinese render
- **AND** it SHALL interact with search/filter, row or empty-state recovery,
  detail navigation when rows exist, at least three tabs or available fallback
  sections, and available dialogs or skipped-safe fallbacks
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Channels API shape is verified

- **WHEN** the real E2E verifies Channels API routes
- **THEN** it SHALL verify runtime readiness, `GET /api/channels`,
  `GET /api/channels/{channelId}/throughput`, and direct typed
  `channels.status` RPC shape when available
- **AND** destructive probe/logout/config mutation routes SHALL be executed only
  when the test has disposable run-scoped channel state, otherwise recorded as
  skipped-safe with evidence.

### Requirement: Channels real E2E attempts representative fixture data safely

Channels real Gateway evidence SHALL attempt representative run-scoped data
creation before accepting empty-state-only evidence.

#### Scenario: Safe Channels fixture can be created

- **WHEN** the isolated real E2E environment can create a reversible
  run-scoped channel/config fixture through Deck BFF, Gateway RPC, or isolated
  `openclaw.json` setup
- **THEN** the fixture SHALL include the current run id in a channel id,
  account id, label, or metadata field
- **AND** cleanup SHALL restore the original safe config snapshot or refuse to
  mutate any target that does not include the current run id.

#### Scenario: Channels fixture is too risky

- **WHEN** fixture creation would touch external provider accounts, real logout
  state, non-disposable channel config, installed plugins, or other user/global
  OpenClaw state
- **THEN** the real E2E SHALL mark that fixture skipped-safe with concrete
  evidence
- **AND** SHALL still run safe read/UI evidence and record what disposable
  fixture support is missing.

### Requirement: Channels deterministic defects are fixed before archive

Deterministic Channels defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Channels remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, or BFF projection
  bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
