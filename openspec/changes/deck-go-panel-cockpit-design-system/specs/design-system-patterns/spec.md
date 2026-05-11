## ADDED Requirements

### Requirement: Cockpit panel patterns SHALL be promoted through the pattern layer

The design system SHALL provide cockpit/panel patterns for recurring
cross-module operational dashboards once Sessions and Usage reference evidence is
available. The initial promoted set SHALL include `PanelRoot`, `PanelSurface`,
`KpiStrip`, `PanelMetric`, `PanelSectionHeader`, `PanelStatusRow`, and
`PanelPill`.

These patterns SHALL live under `deck-go/frontend-new/src/design-system/patterns/`,
SHALL be exported from the public pattern barrel, and SHALL be imported by panels
only through the barrel path.

#### Scenario: A reference panel imports cockpit patterns

- **WHEN** Sessions or Usage consumes a cockpit pattern
- **THEN** the import SHALL come from `@/design-system/patterns` or the top-level design-system barrel
- **AND** the panel SHALL NOT import a specific file path under `patterns/`

#### Scenario: A non-reference panel needs the same cockpit shape

- **WHEN** a later panel has the same metric strip, surface, section header, or status row shape
- **THEN** it SHALL consume the cockpit pattern rather than copying Sessions or Usage CSS
- **AND** module-specific molecules SHALL remain local unless they pass a separate reuse-analysis gate

### Requirement: Cockpit patterns SHALL preserve canonical token values

Cockpit patterns SHALL consume existing `--ds-*` tokens for color, spacing,
radius, typography, and shadow. They SHALL NOT require changes to
`tokens/index.css` values and SHALL NOT redefine global density defaults.

Pattern-local CSS variables MAY exist only inside pattern selectors and only as
aliases over canonical `--ds-*` tokens or token-derived `color-mix()` values.

#### Scenario: A cockpit pattern is implemented

- **WHEN** a cockpit pattern CSS file is added
- **THEN** color, spacing, radius, typography, and shadow values SHALL be token-based
- **AND** the implementation SHALL NOT modify global canonical token values

#### Scenario: A module has stale token aliases

- **WHEN** a reference panel still consumes stale aliases such as `--ds-text`, `--ds-surface`, `--ds-danger`, or `--ds-warning`
- **THEN** the migration SHALL replace those aliases with canonical tokens or pattern-local aliases
- **AND** the parity test SHALL fail if stale aliases remain on the primary visual path

### Requirement: PanelRoot SHALL establish deterministic panel typography

`PanelRoot` SHALL establish the typography and base panel posture for cockpit
panels. It SHALL set font family, font size, line height, letter spacing, base
text color, and box sizing so panels do not inherit browser or shell defaults
that diverge from prototype parity.

#### Scenario: A cockpit panel renders through PanelRoot

- **WHEN** a cockpit panel is rendered in dark/en mock mode
- **THEN** computed root typography SHALL match the panel's declared parity contract
- **AND** typography assertions SHALL cover font family, font size, line height, and key type scale values

#### Scenario: A panel omits root typography

- **WHEN** a cockpit panel inherits shell/browser typography and computed root font size diverges from its parity contract
- **THEN** the visual parity test SHALL fail before visual acceptance can be claimed

### Requirement: KPI and surface patterns SHALL encode repeated operational hierarchy

`KpiStrip`, `PanelMetric`, `PanelSurface`, and `PanelSectionHeader` SHALL encode
the repeated hierarchy observed in Sessions and Usage: subdued uppercase labels,
strong values, small hints, dense bordered surfaces, and section headers with
optional meta/actions.

#### Scenario: A KPI strip is rendered

- **WHEN** a panel renders `KpiStrip` with `PanelMetric` children
- **THEN** labels, values, and hints SHALL use the canonical pattern typography hierarchy
- **AND** responsive layout SHALL avoid horizontal overflow at the panel's supported desktop and mobile widths

#### Scenario: A panel surface is selected or highlighted

- **WHEN** a panel renders a selected row or highlighted surface through `PanelSurface`
- **THEN** the selected/highlighted state SHALL be represented through a typed variant
- **AND** the panel SHALL NOT rely on ad hoc className or inline style overrides

### Requirement: Cockpit patterns SHALL ship with tests and gallery evidence

Every cockpit pattern SHALL ship with renderer coverage, `vitest-axe`
accessibility coverage, and a design-system Gallery example so reviewers can
inspect the variants without constructing a module harness.

#### Scenario: A cockpit pattern is added

- **WHEN** a new cockpit pattern file is added
- **THEN** a focused renderer test SHALL cover its required slots and variants
- **AND** an axe test SHALL assert the rendered example has no accessibility violations
- **AND** the Gallery SHALL expose a representative example for visual review
