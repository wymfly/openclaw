## MODIFIED Requirements

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
