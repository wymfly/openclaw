# frontend-activity-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-activity-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Activity handoff package defines the visual contract

The activity module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/activity/` before the production UI rewrite is marked complete. The package SHALL use `GET /api/activity`, `GET /api/monitor/runs`, `GET /api/monitor/runs/{runId}`, `GET /api/monitor/stats`, the shared `activity.event` stream, and the corresponding `DeckGoActivity*` and `DeckGoMonitor*` DTOs as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the activity handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** unsupported or uncertain real Gateway projection behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** the package SHALL describe activity filters, grouped event timeline, selected event detail, monitor run inventory, run diagnostics, empty/error/loading/not-configured states, and mock visual states

### Requirement: Activity production panel follows contract-backed workflows

The production activity panel SHALL render and operate from contract-backed activity and monitor data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Activity and monitor data is loaded

- **WHEN** the activity panel loads with contract-shaped activity events, monitor runs, monitor stats, and selected run detail
- **THEN** the panel SHALL show stream status, activity counts, visible counts, grouped event timeline, selected event identity, run history, monitor stats, top agents, selected run summary, parsed diagnostics, raw event rows, and raw payload detail
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values

#### Scenario: Activity stream event arrives

- **WHEN** an `activity.event` SSE payload arrives with a contract-shaped event
- **THEN** the panel SHALL merge it into the activity timeline without duplicating existing event ids
- **AND** the merged timeline SHALL remain sorted by newest timestamp first
- **AND** an unselected timeline SHALL select the first available event

#### Scenario: Filters, selection, and pagination are used

- **WHEN** an operator edits activity filters, monitor run filters, selects an event, selects a run, refreshes data, or loads the next monitor page
- **THEN** the panel SHALL keep filter values contract-shaped and call the existing API wrappers with normalized query values
- **AND** selected event and selected run fallbacks SHALL remain stable when refreshed data still contains the current selection
- **AND** cursor pagination SHALL append new monitor runs without duplicating existing run ids

#### Scenario: Cross-panel handoff actions are used

- **WHEN** an operator opens an event agent, selected run agent, selected run session, or top-agent shortcut
- **THEN** the panel SHALL use the shared Deck navigation helpers for cross-panel handoff instead of direct route mutation
- **AND** handoff buttons SHALL only render when the selected contract payload contains the required target id

### Requirement: Activity UI aligns with the settled frontend design system

The activity panel SHALL use the current chat/agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Activity UI is rendered

- **WHEN** the activity panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose activity stream health, filter state, grouped timeline, run inventory, selected event, and selected run diagnostics without overlapping text or nested decorative cards
- **AND** long event ids, run ids, session keys, stream payloads, paths, and model names SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Activity mock visual verification is available

The activity rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped activity and monitor data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the activity mock visual E2E is executed
- **THEN** it SHALL load activity and monitor data through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as activity filtering, group collapse, selected run diagnostics, or related-panel handoff affordances
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E

### Requirement: Activity high-fidelity completion is not real functional completion

The Activity high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that Activity works against a real deck-go stack with real Gateway/LLM telemetry.

#### Scenario: Activity mock visual evidence is reported

- **WHEN** Activity mock visual tests or high-fidelity prototype checks pass
- **THEN** implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, skipped, real-empty-valid, or not attempted with reason

#### Scenario: Real Activity verification contradicts mock assumptions

- **WHEN** real BFF, stream, or UI verification contradicts mock data or a prototype assumption
- **THEN** the production implementation SHALL prefer Deck contract and Go BFF projection truth
- **AND** the implementation SHALL fix deterministic scoped drift directly or update mock/prototype notes when the contradiction is not a scoped fix
