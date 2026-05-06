# frontend-api-explorer-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-api-explorer-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: API Explorer handoff package defines the visual contract

The api-explorer module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/api-explorer/` before the production UI rewrite is marked complete. The package SHALL use `GET /api/gateway/describe`, `fetchGatewayDescribe()`, `DeckGoGatewayDescribeResponse`, and the typed runtime Gateway RPC transport as the source truth. Prototype claims that conflict with code truth SHALL be corrected in handoff notes during implementation.

#### Scenario: Handoff package is reviewed

- **WHEN** the api-explorer handoff package is created or refreshed
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, `api-usage.md`, and implementation notes
- **AND** unsupported or missing Gateway schemas SHALL be documented as untyped, disabled-run, degraded, or no-schema states rather than guaranteed UI behavior
- **AND** the package SHALL describe method catalog, event catalog, schema tree, selected method, request builder, response pane, history, untyped methods, empty/error/loading/not-configured states, and mock visual states
- **AND** any reference to non-existent BFF routes or undeclared dependencies SHALL be reconciled against the implementation notes before archive

### Requirement: API Explorer production panel follows contract-backed workflows

The production api-explorer panel SHALL render and operate from contract-backed `gateway.describe` data and typed Gateway RPC transport while preserving the existing panel registry and BFF-only browser boundary.

#### Scenario: Gateway describe data is loaded

- **WHEN** `fetchGatewayDescribe()` resolves with contract-shaped methods, events, and untyped method names
- **THEN** the panel SHALL show describe status, method count, event count, untyped count, grouped method catalog, selected method identity, params schema, result schema, event payload schema, and untyped method visibility
- **AND** missing optional schema fields SHALL render as no-schema or unavailable evidence rather than fabricated values

#### Scenario: Method search and selection are used

- **WHEN** an operator searches methods by method name or scope and selects a method
- **THEN** method rows SHALL filter by the exact loaded contract data
- **AND** methods SHALL remain grouped by method domain
- **AND** selected method detail SHALL update to the selected method without mutating the loaded contract payload

#### Scenario: Request builder and run are used

- **WHEN** an operator edits the selected method params and runs a supported typed method
- **THEN** the panel SHALL send the request through the deck-go BFF typed Gateway RPC transport
- **AND** the panel SHALL show running, success, and error states with status/evidence, response body, request id or trace evidence when exposed, and raw payload details
- **AND** invalid JSON SHALL be blocked before network submit with an inline error
- **AND** unsupported, untyped, stream, or mutation-unsafe methods SHALL be disabled, degraded, or documented rather than invoked blindly

#### Scenario: Events, schema rows, and history are inspected

- **WHEN** an operator switches to events, expands/collapses nested schema rows, or reopens a prior request
- **THEN** event payload schema rows SHALL render from `events[*].payload`
- **AND** nested method/event schema rows SHALL preserve accessible expand/collapse controls
- **AND** schema rendering SHALL remain bounded to prevent runaway recursive layouts
- **AND** request history SHALL reload method/params/response evidence without fabricating persistent storage if persistence is not implemented

### Requirement: API Explorer UI aligns with the settled frontend design system

The api-explorer panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: API Explorer UI is rendered

- **WHEN** the api-explorer panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose describe health, method/event/untyped counts, method catalog, request builder, selected schema evidence, response pane, history access, and untyped visibility without overlapping text or nested decorative cards
- **AND** long method names, scopes, enum values, schema field names, JSON params, JSON responses, request ids, and raw untyped method names SHALL wrap or truncate in stable constrained regions without shifting the layout
- **AND** any richer editor/viewer fidelity that depends on undeclared packages SHALL remain module-local or be documented as dependency-blocked

### Requirement: API Explorer mock visual verification is available

The api-explorer rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped `gateway.describe` data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the api-explorer mock visual E2E is executed
- **THEN** it SHALL load describe data through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as method filtering, event tab inspection, schema collapse/expand, or untyped visibility
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM or full upstream schema-completeness evidence
