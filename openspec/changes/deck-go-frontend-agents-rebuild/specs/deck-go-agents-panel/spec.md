## ADDED Requirements

### Requirement: Agents panel provides searchable list and selected detail

`frontend-new` SHALL provide an agents panel with a list/workbench view and a selected-agent detail view. The list SHALL use the shared agents store, support client-side search/sort/filter where server support is unavailable, and preserve selection in stable UI state.

#### Scenario: Agent list loads successfully

- **WHEN** the agents panel opens and the backend returns an agents list
- **THEN** the panel SHALL render one row per agent with identity, model/workspace metadata, default marker, and status indicator
- **AND** selecting a row SHALL open that agent's detail view

#### Scenario: Empty list renders an actionable empty state

- **WHEN** the agents list response contains no agents
- **THEN** the panel SHALL render an empty state that offers the create-agent entry point
- **AND** it SHALL NOT render an empty table with no explanation

### Requirement: Detail workbench exposes configuration sections

The agents detail workbench SHALL expose the sections needed for agent administration: overview, skills, subagents, tool policy, system prompt, files, and event streams. Section navigation MUST keep unsaved changes visible and MUST avoid losing dirty edits during tab changes.

#### Scenario: Section navigation preserves dirty edits

- **WHEN** the user edits a section and navigates to another section before saving
- **THEN** the panel SHALL keep the dirty state visible
- **AND** returning to the original section SHALL preserve the pending edit until the user saves, discards, or reloads

#### Scenario: Read-only previews are clearly non-editable

- **WHEN** the user opens tool policy or system prompt preview sections
- **THEN** the panel SHALL render provenance/source metadata from the typed preview response
- **AND** controls that would imply direct editing SHALL NOT be shown unless a typed write contract exists

### Requirement: Create, edit, and delete flows are safe and contract-bound

The agents panel SHALL provide create wizard, overview edit, and delete flows that submit only typed, supported requests. Destructive delete MUST require explicit confirmation and update shared agents state after success.

#### Scenario: Create wizard completes supported create flow

- **WHEN** the user completes the create wizard with a valid name and workspace
- **THEN** the panel SHALL call the typed create API
- **AND** on success it SHALL refresh agents state and navigate to the created agent detail

#### Scenario: Delete requires confirmation

- **WHEN** the user chooses to delete an agent
- **THEN** the panel SHALL show a confirmation dialog identifying the target agent
- **AND** the delete API SHALL NOT be called until the user confirms

### Requirement: Agents panel follows the design system and accessibility rules

Production agents UI SHALL use canonical `frontend-new` design-system atoms, hooks, and `--ds-*` tokens. Module-private molecules are allowed for business-specific composites, but replacements for canonical Button/Input/Modal/Drawer/Table/Tooltip-like atoms MUST NOT be created.

#### Scenario: Non-canonical handoff atoms are adapted

- **WHEN** the handoff references `Switch`, `Avatar`, `EmptyState`, or `KeyHint`
- **THEN** `Switch` SHALL be implemented with canonical `Toggle`
- **AND** the other items SHALL be module-private molecules or patterns unless separately promoted through design-system rules

#### Scenario: Accessibility tests cover core states

- **WHEN** the agents panel unit tests run
- **THEN** list, detail, create wizard, and delete confirmation surfaces SHALL be covered by focused render/a11y tests

### Requirement: Agents panel handles loading, errors, conflicts, and realtime updates

The agents panel SHALL represent loading, backend errors, stale config conflicts, deleted-agent states, and stream disconnects without crashing or losing user context.

#### Scenario: Backend error keeps previous context

- **WHEN** a detail section refresh fails after an agent has already loaded
- **THEN** the panel SHALL keep the last known detail visible where safe
- **AND** render an inline error with retry affordance for the failed section

#### Scenario: Selected agent is deleted elsewhere

- **WHEN** the current selected agent is removed by another action or realtime event
- **THEN** the panel SHALL close or invalidate the detail view
- **AND** it SHALL select a safe fallback row or render the list empty state

### Requirement: Legacy agents code is not copied wholesale

The rewrite SHALL use `deck-go/frontend/src/components/panels/agents/**` only as a reference for endpoints, edge cases, and tested helper behavior. The new module MUST be decomposed into reviewable components, hooks, store helpers, and CSS files under `frontend-new`.

#### Scenario: New module has bounded files

- **WHEN** the agents implementation is complete
- **THEN** no single new agents component file SHOULD approach the old monolithic `AgentsPanel.tsx` size
- **AND** reusable pure helpers SHALL have focused tests
