# frontend-agents-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-agents-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Agents handoff package is the module visual truth

The system SHALL maintain a fresh `deck-go/frontend-handoff/modules/agents/` handoff package for this change containing `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`. The package SHALL be based on current contract truth and design-system tokens/atoms, and it SHALL document any unsupported design assumption rather than encoding it as production behavior.

#### Scenario: Handoff package is implementation-ready

- **WHEN** a developer begins the agents production rewrite for this change
- **THEN** `deck-go/frontend-handoff/modules/agents/README.md` SHALL identify the new prototype as the active visual target
- **AND** the package SHALL include the six required handoff files
- **AND** unsupported Gateway or backend assumptions SHALL be recorded in `api-discrepancy.md` or `implementation-notes.md`

### Requirement: Agents production panel follows contract-shaped data

The `frontend-new` agents panel SHALL render list, detail, section, create, delete, loading, empty, and error states from Deck-facing DTOs and typed API wrappers. Panel code MUST NOT depend on raw endpoint/action strings, idealized mock-only fields, or direct Gateway calls.

#### Scenario: List and detail use typed contract data

- **WHEN** the agents panel renders with mocked `DeckGoAgentsListResponse` and `DeckGoAgentDetailResponse` data
- **THEN** visible identity, status, model, workspace, default marker, counters, and section summaries SHALL come from those DTOs or documented optional fallbacks
- **AND** missing optional fields SHALL render as unavailable/neutral UI rather than invented values

#### Scenario: Section actions remain behind API facade

- **WHEN** the user saves skills, subagents, event streams, files, overview edits, creates an agent, or deletes an agent
- **THEN** the panel SHALL call `frontend-new/src/api.ts` wrappers or store actions that wrap those functions
- **AND** raw endpoint/action strings SHALL remain out of panel component files

### Requirement: Agents visual E2E uses contract-shaped mocks

The system SHALL provide mock-backed Playwright coverage for agents visual review. The test SHALL open the real `frontend-new` application shell, route to agents, fulfill backend/API calls with contract-shaped data, capture at least one primary visual state, and fail on unexpected console errors or page errors.

#### Scenario: Mock visual test opens agents

- **WHEN** the agents mock visual E2E runs
- **THEN** it SHALL show the agents panel inside the real deck-go shell
- **AND** it SHALL assert the primary agents workbench is visible
- **AND** it SHALL capture screenshot evidence for visual review

#### Scenario: Mock does not claim real Gateway coverage

- **WHEN** the agents visual E2E passes
- **THEN** the change closeout SHALL describe it as mock visual coverage
- **AND** it SHALL NOT claim that real Gateway or real LLM agents behavior has been verified

### Requirement: Agents production UI supports core operational states

The agents panel SHALL expose the operational states needed by an enterprise configuration cockpit: searchable/filterable list, selected detail workbench, section navigation, dirty/save/conflict feedback, create flow, destructive delete confirmation, loading, empty, and error states.

#### Scenario: Primary states are reachable

- **WHEN** the panel receives mock data for ready, empty, loading, and error states
- **THEN** each state SHALL be reachable in tests or documented visual seeds
- **AND** each state SHALL use design-system tokens/atoms for typography, spacing, color, controls, and focus treatment

### Requirement: Agents implementation records design-system feedback

The change SHALL record which agents-specific UI structures remain module-local and which patterns are candidates for later design-system promotion. Canonical atom/token changes MUST be additive and MUST include focused tests if introduced.

#### Scenario: Local molecules are documented

- **WHEN** the agents implementation is complete
- **THEN** `implementation-notes.md` or the OpenSpec closeout SHALL list local molecules/pattern candidates such as row summaries, section headers, policy rows, or file rows
- **AND** it SHALL state whether any canonical token/atom change was made

#### Scenario: Canonical design-system change is introduced

- **WHEN** the implementation adds a canonical atom variant, pattern, or token
- **THEN** the change SHALL include a reuse analysis and focused design-system test or drift check evidence

### Requirement: Agents revised v2 handoff is the active implementation target

The agents production pass for this change SHALL treat the revised v2 `deck-go/frontend-handoff/modules/agents/` package as the active visual and interaction target, subject to real Gateway capability calibration.

#### Scenario: Revised handoff is read before implementation

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL read the agents v2 `README.md`, `prototype.html`, `app.jsx`, `data.js`, `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `tweaks-panel.jsx`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the implementation SHALL preserve the v2 prototype's product intent unless contract or real Gateway evidence requires a documented adjustment

#### Scenario: Prototype exceeds real capability

- **WHEN** the revised v2 prototype expects a field, action, or state that real Gateway capability or Deck-facing contracts do not support
- **THEN** the production implementation SHALL adjust the UI to supported behavior or add a justified contract/adapter change
- **AND** the unsupported prototype expectation SHALL be recorded in agents implementation notes or OpenSpec task evidence

### Requirement: Agents high-fidelity completion is not real functional completion

The agents high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that the module works against a real OpenClaw Gateway.

#### Scenario: Mock visual evidence is reported

- **WHEN** agents mock visual tests or high-fidelity prototype checks pass
- **THEN** the implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, or not attempted with reason

#### Scenario: Real verification contradicts mock assumptions

- **WHEN** real Gateway verification contradicts the mock data or prototype assumption
- **THEN** the production implementation SHALL prefer real Gateway and Deck contract truth
- **AND** the mock fixture or prototype notes SHALL be updated if the contradiction is deterministic and in scope
