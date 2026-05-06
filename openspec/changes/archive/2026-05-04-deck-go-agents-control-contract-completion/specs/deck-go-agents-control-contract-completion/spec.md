## ADDED Requirements

### Requirement: Agents product claims SHALL map to contract truth

Deck Go SHALL ensure visible agents/subagents product workflows map to typed Gateway/Deck DTOs, BFF wrappers, frontend facades, and evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the agents or subagents UI exposes a read or write workflow
- **THEN** the workflow SHALL have a frontend API wrapper, Deck-facing DTO or generated Gateway method, and matrix evidence status

#### Scenario: Workflow is unsafe for automated real writes

- **WHEN** an agents/subagents workflow can mutate OpenClaw config or runtime state and disposable cleanup is not proven
- **THEN** the workflow SHALL be marked deferred or handoff-blocked for L2 mutation execution

### Requirement: Agents mutations SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence metadata for agents/subagents write actions that the production UI can trigger.

#### Scenario: Agents write action is recorded

- **WHEN** an agents create, update, delete, skills save, subagent policy save, event-stream save, file save, subagent steer, or subagent kill action is exposed through a frontend facade
- **THEN** `deck-mutations.contract.json` SHALL name the action id, route, response DTO, success indicator, audit coverage, conflict behavior, and fixture safety status

#### Scenario: Mutation evidence metadata is generated

- **WHEN** mutation evidence sync/check runs
- **THEN** generated Markdown and TypeScript metadata SHALL include the agents/subagents action rows

### Requirement: Agents facades SHALL keep raw route/action strings centralized

Agents and subagents panel code SHALL use frontend API facades rather than assembling raw BFF paths or action strings in production components.

#### Scenario: Panel performs mutation

- **WHEN** the agents or subagents panel performs a mutation
- **THEN** production component code SHALL call the API facade
- **AND** raw action strings such as `skills.set`, `subagents.set`, `kill`, or `steer` SHALL remain in `frontend-new/src/api.ts` or tests

### Requirement: Agents completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix and agents handoff notes synchronized with this module completion result.

#### Scenario: Agents child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the agents and subagents matrix rows SHALL remove the platform-control safe-mutation blocker
- **AND** remaining real mutation blockers SHALL be documented as module-specific deferred or handoff-blocked scenarios
