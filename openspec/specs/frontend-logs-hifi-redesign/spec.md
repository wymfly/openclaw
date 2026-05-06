# frontend-logs-hifi-redesign Specification

## Purpose

Defines the contract-led high-fidelity redesign requirements for the deck-go
`logs` frontend module, including handoff artifacts, production UI behavior,
mock visual coverage, and local design-system feedback.

## Requirements

### Requirement: Logs handoff package defines the visual contract

The logs module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/logs/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing DTOs, BFF route, and SSE stream event envelope as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the logs handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document unsupported or uncertain product behavior as discrepancy notes or open questions rather than guaranteed UI behavior

### Requirement: Logs production panel follows contract-backed workflows

The production logs panel SHALL render and operate from contract-backed log tail and stream event data while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the v2 handoff as the visual target, but it SHALL parse raw `unknown[]` lines defensively and record typed-line, server-filter, and durable export assumptions unless they are verified against a Deck-facing contract.

#### Scenario: Logs tail is loaded

- **WHEN** `fetchLogsTail` returns `DeckGoLogsTailResponse`
- **THEN** the panel SHALL show tail status, stream status, cursor, visible count, filters, parsed log rows, selected row details, export affordance, live event tape, stream event inspection, and raw tail payload details
- **AND** missing optional fields SHALL render as unavailable or omitted rather than fabricated values
- **AND** unsupported or invalid line values SHALL be skipped or rendered through raw payload affordances rather than throwing

#### Scenario: Local filters are applied

- **WHEN** an operator changes level, source, session, correlation id, or free-text filters
- **THEN** the panel SHALL filter already-loaded log rows locally
- **AND** it SHALL not imply those filters were sent to Gateway unless a future contract adds server-side filter parameters
- **AND** selected row state SHALL remain stable when the selected cursor remains visible and fall back predictably when filters exclude it

#### Scenario: Stream events are received

- **WHEN** `/logs/stream` emits `log.batch` or `log.reset`
- **THEN** the panel SHALL update cursor/localStorage, live tape, tail rows, selected row fallback, and reset state using existing stream parser behavior
- **AND** pause/resume SHALL preserve the current local buffer semantics

#### Scenario: Prototype-only log workflows are reviewed

- **WHEN** the handoff package references typed `DeckGoLogLine`, server-side filters, stronger SSE payload fields, or durable export/download behavior
- **THEN** production SHALL keep those workflows out of guaranteed active behavior unless a matching Deck-facing contract or verified BFF endpoint exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/logs/implementation-notes.md`

### Requirement: Logs UI aligns with the settled frontend design system

The logs panel SHALL use the chat/agents/routing/subagents design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Logs UI is rendered

- **WHEN** the logs panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose tail status, stream state, filters, log rows, live tape, stream event/payload inspection, and export controls without overlapping text or nested decorative cards
- **AND** code/log text SHALL use stable scroll containers so long log lines do not resize or break the workbench

### Requirement: Logs mock visual verification is available

The logs rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped log data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the logs mock visual E2E is executed
- **THEN** it SHALL load log tail data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as filter/export/live-stream handling
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
