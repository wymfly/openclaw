# frontend-activity-prototype-parity-remediation Specification

## Purpose

TBD - created by archiving change deck-go-frontend-activity-prototype-parity-remediation. Update Purpose after archive.

## Requirements

### Requirement: Activity page matches the active unified-feed prototype

The Activity production panel SHALL use `deck-go/frontend-handoff/modules/activity/prototype.html` as its visual and interaction authority unless an accepted exception is recorded.

#### Scenario: Activity renders the unified feed workspace

- **WHEN** the Activity panel loads with contract-shaped activity events
- **THEN** it SHALL render a page header, KPI strip, search control, family filter, severity filter, time-range filter, refresh control, grouped feed rows, and no monitor diagnostics cards
- **AND** the first viewport SHALL be structurally comparable to the active prototype.

#### Scenario: Activity row opens an event detail dialog

- **WHEN** an operator clicks or keyboard-activates an activity feed row
- **THEN** the panel SHALL open an event detail dialog with event type, description, timestamp, id, agent identity when available, details when available, and copyable raw JSON
- **AND** closing the dialog SHALL return the operator to the feed without leaving the Activity panel.

### Requirement: Activity uses Deck BFF activity contracts only from browser code

The Activity browser implementation SHALL call Deck BFF wrappers for activity snapshot and stream data and SHALL NOT call Gateway, local files, backend internals, or monitor projection routes directly for the Activity page UI.

#### Scenario: Activity fetches snapshot data

- **WHEN** the Activity panel requests its initial data or refreshes
- **THEN** it SHALL use the frontend API wrapper for `GET /activity`
- **AND** it SHALL render `DeckGoActivityResponse.events` without requiring monitor run data.

#### Scenario: Activity receives live stream data

- **WHEN** an `activity.event` SSE payload arrives with a contract-shaped event
- **THEN** the panel SHALL merge it into the feed without duplicating an existing event id
- **AND** an unknown event type SHALL still render with a generic muted family/severity rather than crashing.

### Requirement: Activity filters compose over contract-shaped events

The Activity panel SHALL implement search, family, severity, and time-range filters over the loaded activity events.

#### Scenario: Operator filters the feed

- **WHEN** the operator searches or changes family, severity, or time range
- **THEN** the feed SHALL AND-combine the active filters
- **AND** the KPI or visible-count affordance SHALL reflect the filtered result
- **AND** an empty result SHALL render a clear empty state with a way to recover by clearing or widening filters.

### Requirement: Activity mock parity evidence is strict

The Activity child proposal SHALL produce mock evidence that separates functional rendering from active-prototype parity.

#### Scenario: Activity mock parity is claimed

- **WHEN** Activity is marked mock-visually aligned
- **THEN** evidence SHALL include the active prototype screenshot, the mock-current screenshot, a side-by-side contact sheet, a structured verdict, and accepted exceptions if any remain
- **AND** the mock visual spec SHALL exercise at least one row selection/dialog interaction and one filter interaction.

### Requirement: Activity real Gateway evidence follows strengthened product standard

The Activity real Gateway E2E SHALL validate the real Deck BFF/Gateway chain through product navigation, variants, interactions, and safe data seeding.

#### Scenario: Activity real E2E passes with real data or bounded degradation

- **WHEN** real Gateway Activity evidence is run
- **THEN** the test SHALL navigate from the Deck shell into Activity
- **AND** SHALL render at least one dark English state and one light Chinese state
- **AND** SHALL exercise search, family/severity/time filters, refresh, row detail dialog, copy/close behavior, and empty-state recovery when applicable
- **AND** SHALL attempt safe run-scoped real Activity data creation through the isolated cpa/main chat/session path when available
- **AND** SHALL record seed status, BFF response shape, UI assertions, unexpected console/page/API errors, and direct Gateway browser access evidence.

#### Scenario: Activity real fixture creation is blocked

- **WHEN** the cpa/main real seed cannot complete within the bounded attempts
- **THEN** the child proposal MAY classify seed data as handoff-blocked or degraded
- **AND** it SHALL still verify safe read/UI behavior against the real BFF state
- **AND** it SHALL record the blocker and next action rather than fabricating browser-visible activity rows.
