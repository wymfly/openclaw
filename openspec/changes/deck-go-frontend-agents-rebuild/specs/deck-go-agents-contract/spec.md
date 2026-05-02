## ADDED Requirements

### Requirement: Agents summary contract exposes stable UI fields

Deck-Go SHALL expose an agents summary DTO for `frontend-new` that contains stable fields needed by list, shared store, routing, and subagents consumers. The DTO MUST include `id`, display name fallback, optional `emoji`/`avatar`, optional `workspace`, optional `model`, default-agent marker, realtime status, and any available session/binding/activity counters. Fields that cannot be produced from Gateway or BFF truth MUST be optional or explicitly unavailable; the frontend MUST NOT rely on arbitrary open extension fields for primary UI behavior.

#### Scenario: List payload normalizes Gateway agent identity

- **WHEN** `frontend-new` calls the agents list API through `src/api.ts`
- **THEN** each row SHALL expose a stable display name derived from Gateway `name`, identity `name`, or `id`
- **AND** avatar/emoji/model/workspace SHALL be normalized from Gateway fields without requiring panel code to parse Gateway internals

#### Scenario: Unsupported counters are not fabricated

- **WHEN** Gateway cannot provide `sessionCount`, `bindingCount`, or `lastActiveAtMs` for a list row
- **THEN** the DTO SHALL either omit those fields or mark them unavailable
- **AND** the UI SHALL render an unavailable/empty state instead of inventing numeric values

### Requirement: Agents detail contract supports configuration workbench sections

Deck-Go SHALL provide typed detail and section DTOs for the agents workbench sections: overview, skills, subagents, tool policy preview, system prompt preview, files, and event streams. Each section DTO SHALL expose enough metadata for loading, dirty state, save success, conflict, and error rendering.

#### Scenario: Detail view hydrates from typed surfaces

- **WHEN** a user opens an agent detail view
- **THEN** the frontend SHALL load overview data from the typed detail response
- **AND** each secondary section SHALL call a typed API wrapper rather than constructing raw endpoint/action strings inside panel components

#### Scenario: Section save uses source config hash

- **WHEN** the user saves skills, subagent permissions, or event streams
- **THEN** the request SHALL include the relevant config hash/base hash from the loaded section response
- **AND** a stale hash response SHALL be rendered as a conflict state that asks the user to reload or retry

### Requirement: Agents writes use typed Deck-facing request DTOs

Create, update, delete, and section mutation flows SHALL use Deck-facing request DTOs generated from `contracts/source/deck-api.contract.ts`. The create flow MUST only submit fields supported by the current backend create route unless an orchestrated BFF action is added in this change.

#### Scenario: Create request respects backend-supported fields

- **WHEN** the create wizard submits a new agent
- **THEN** the initial `POST /agents` request SHALL include only supported create fields such as name, workspace, emoji, and avatar
- **AND** model, skills, subagent permissions, or default-agent changes SHALL be applied through follow-up typed section calls unless the backend adds a typed orchestrated create action

#### Scenario: Patch request mirrors Gateway update schema

- **WHEN** the user edits agent identity/model/workspace in the overview section
- **THEN** the frontend SHALL call the typed patch wrapper with the body fields mirrored from Gateway `agents.update` minus the URL-supplied `agentId`

### Requirement: Agents realtime status uses declared stream events

The agents UI SHALL consume only declared Deck-Go stream events for realtime row/detail status. It MUST support the current `activity.event` and `agent.status.changed` stream contracts, and MUST treat unknown event shapes as ignored input rather than panel failures.

#### Scenario: Busy status updates from stream event

- **WHEN** the stream parser receives `agent.status.changed` for the selected agent with status `busy`
- **THEN** the agents store SHALL mark that agent as busy
- **AND** list/detail status indicators SHALL update without a full page reload

#### Scenario: Unknown activity payload is ignored

- **WHEN** the stream receives an `activity.event` payload whose fields do not match known agents metrics consumption
- **THEN** the agents store SHALL leave existing state unchanged
- **AND** no uncaught exception SHALL be thrown by the panel

### Requirement: Contract discrepancies are explicit

If the handoff package assumes Gateway/BFF fields or endpoints that are not supported by current contract truth, the implementation SHALL record the discrepancy before claiming the module complete. Temporary frontend adapters MUST have a removal condition or follow-up target when they synthesize ideal design shapes from current responses.

#### Scenario: Handoff query parameters are unsupported

- **WHEN** implementation discovers that `agents.list` does not support search, sort, filter, cursor, or limit parameters
- **THEN** the first implementation SHALL use client-side behavior or omit the affordance
- **AND** the unsupported server-side query contract SHALL be recorded as a follow-up/discrepancy rather than silently sending ignored parameters as if they were authoritative

#### Scenario: Subagent response shape remains redundant

- **WHEN** the Gateway response contains both `allowAgents`/`allowedAgents` and `allAgents`
- **THEN** any `allAgents[].allowed` view shape SHALL be produced by a named adapter
- **AND** source DTOs SHALL continue to represent Gateway truth until the backend contract is changed
