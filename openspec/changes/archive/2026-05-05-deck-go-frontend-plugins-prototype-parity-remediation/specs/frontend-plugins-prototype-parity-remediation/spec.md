## ADDED Requirements

### Requirement: Plugins production UI matches the active inventory flow

The Plugins production panel SHALL use the active handoff prototype product flow
as its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Plugins

- **WHEN** the operator navigates to Plugins
- **THEN** the first viewport SHALL show a Plugins inventory list with page
  title, KPI strip, search, capability filter, origin filter, API scope control,
  dense plugin rows, and refresh action
- **AND** each populated row SHALL show plugin identity, version, capability
  chips, exposed channel/tool/provider counts, source, diagnostics, status, and
  a visible affordance to open detail.

#### Scenario: Operator drills into a plugin

- **WHEN** the operator selects a plugin row
- **THEN** the panel SHALL show a plugin detail view with back navigation, hero,
  status/source/capability evidence, and tabs for Overview, Capabilities,
  Diagnostics, Activation, Manifest, and Audit
- **AND** tabs with route-blocked data SHALL show explicit degraded or
  projection-only states rather than fabricated Gateway data.

### Requirement: Plugins contract chain remains BFF/Gateway read-only scoped

The Plugins frontend SHALL continue to use deck-go BFF wrappers for all plugin
inventory data.

#### Scenario: Plugins inventory loads

- **WHEN** Plugins loads default or all-plugin inventory
- **THEN** it SHALL use `fetchPluginsWithCapability` against the Deck BFF route
- **AND** browser code SHALL NOT call the OpenClaw Gateway or plugin runtime
  endpoints directly.

#### Scenario: Unsupported mutation is visible

- **WHEN** an operator inspects install, uninstall, enable, disable, reload,
  marketplace, trust, signature, manifest-route, or audit-route capability
- **THEN** the UI and evidence SHALL describe those capabilities as unsupported,
  degraded, or follow-up contracts
- **AND** the panel SHALL NOT expose working mutation controls that imply current
  contract support.

### Requirement: Plugins detail dialogs are interactive and read-only

Plugins SHALL provide read-only detail dialogs that match the active prototype
without introducing unsupported mutations.

#### Scenario: Operator opens diagnostic detail

- **WHEN** a selected plugin has diagnostics and the operator opens a diagnostic
  row
- **THEN** a dialog SHALL show diagnostic level, message, source plugin evidence,
  and a remediation hint
- **AND** the dialog SHALL be closeable without changing plugin state.

#### Scenario: Operator opens manifest or raw inventory

- **WHEN** the operator opens manifest or raw inventory evidence
- **THEN** a dialog or expandable surface SHALL show JSON derived from the
  selected `DeckGoPluginInventoryEntry`
- **AND** any non-route-backed manifest fields SHALL be labelled as synthetic,
  projected, or unavailable.

### Requirement: Plugins mock evidence covers prototype states

Plugins mock visual and unit evidence SHALL exercise the prototype-shaped
product flow.

#### Scenario: Mock Plugins evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover populated list, search/filter/scope switching,
  row-to-detail navigation, every detail tab, diagnostic/manifest/raw dialogs,
  empty or no-match state, and localized UI
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Plugins real E2E attempts safe run-scoped fixture data

Plugins real Gateway evidence SHALL attempt representative fixture creation
before accepting empty-state-only evidence.

#### Scenario: Real plugin fixture can be safely created

- **WHEN** a run-scoped plugin inventory fixture can be created through isolated
  `openclaw.json`, isolated workspace plugin files, Gateway RPC, or Deck BFF
  without installing packages or touching external accounts
- **THEN** the real E2E SHALL create the fixture with an id or name containing
  the current run id
- **AND** cleanup SHALL refuse to remove or mutate anything that does not
  contain the current run id
- **AND** the user-visible Plugins UI SHALL verify the fixture through list and
  detail interaction.

#### Scenario: Real plugin fixture is unsafe or unsupported

- **WHEN** fixture creation would require installed plugin packages, external
  channel accounts, credentials, global plugin state, or unsupported plugin
  loader behavior
- **THEN** the real E2E SHALL circuit-break fixture creation as skipped-safe with
  concrete evidence
- **AND** SHALL still verify real route envelopes, shell navigation, variants,
  empty-valid or populated UI handling, and BFF-only browser transport.

### Requirement: Plugins real E2E covers navigation, variants, and interactions

Plugins real Gateway UI evidence SHALL exercise the product surface through Deck
shell navigation and supported variants.

#### Scenario: Real Plugins UI variants are verified

- **WHEN** the real E2E verifies Plugins UI
- **THEN** it SHALL navigate from another shell panel into Plugins with the nav
  or handoff button
- **AND** SHALL verify one dark English render and one light Chinese render
- **AND** SHALL interact with list filters, scope switching, detail tabs or
  empty-valid fallback, and available dialogs when inventory is non-empty
- **AND** SHALL record unexpected console, page, BFF API, direct Gateway request,
  and direct Gateway websocket errors.

### Requirement: Plugins unsupported projections are explicit

Prototype-only Plugins projections SHALL be labelled instead of silently
claimed.

#### Scenario: Manifest, audit, lifecycle, marketplace, trust, or signature data is not contract-backed

- **WHEN** manifest routes, activation audit history, lifecycle controls,
  marketplace metadata, trust-source metadata, or package signature verification
  are unavailable from current Deck-facing DTOs
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as projected, unavailable, skipped-safe, or follow-up
  contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.
