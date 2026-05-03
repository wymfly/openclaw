## ADDED Requirements

### Requirement: Subagents handoff package defines the visual contract

The subagents module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/subagents/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing DTOs and BFF route/action envelopes as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the subagents handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document unsupported or uncertain product behavior as discrepancy notes or open questions rather than guaranteed UI behavior

### Requirement: Subagents production panel follows contract-backed workflows

The production subagents panel SHALL render and operate from contract-backed runs, lineage, kill, steer, agent permission, and config-default data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Subagent runs are loaded

- **WHEN** `fetchSubagentRuns` returns `DeckGoSubagentsListResponse`
- **THEN** the panel SHALL show active/history totals, filters, run queue, selected run detail, lineage, related agent/session navigation, and payload inspection
- **AND** missing optional fields SHALL render as unavailable rather than fabricated values

#### Scenario: Subagent actions are invoked

- **WHEN** an operator steers or kills a selected run
- **THEN** the panel SHALL call the existing API wrappers with normalized payloads
- **AND** kill SHALL remain confirmation-gated for active runs

#### Scenario: Global defaults are saved

- **WHEN** an operator saves global subagent defaults
- **THEN** the panel SHALL apply updates through the existing config get/apply wrappers using current base hash information
- **AND** it SHALL not imply atomic diff preview support beyond the returned apply result

### Requirement: Subagents BFF forwards child-agent filter

The Deck Go backend SHALL forward the `agentId` query parameter from `GET /deck/subagents` to the runtime/Gateway adapter so frontend child-agent filtering matches the contract exposed by `fetchSubagentRuns`.

#### Scenario: Child-agent filter is requested

- **WHEN** a browser calls `GET /deck/subagents?agentId=reviewer&status=all`
- **THEN** the backend SHALL include `agentId: "reviewer"` in the adapter params
- **AND** the runtime view SHALL be able to filter runs by child agent

### Requirement: Subagents UI aligns with the settled frontend design system

The subagents panel SHALL use the chat/agents/routing design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Subagents UI is rendered

- **WHEN** the subagents panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose status, run queue, selected run detail, lineage, and primary steer/kill affordances without overlapping text or nested decorative cards
- **AND** global defaults/config mode SHALL remain reachable without displacing the active-run workflow

### Requirement: Subagents mock visual verification is available

The subagents rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped subagent data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the subagents mock visual E2E is executed
- **THEN** it SHALL load subagent runs through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as lineage/config/steer
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
