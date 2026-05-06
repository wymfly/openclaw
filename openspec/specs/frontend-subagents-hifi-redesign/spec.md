# frontend-subagents-hifi-redesign Specification

## Purpose

Defines the contract-led high-fidelity redesign for the Deck Go `subagents` frontend module, including handoff package, production runs/permissions workbench, BFF query/action forwarding, mock visual verification, and design-system feedback.

## Requirements

### Requirement: Subagents handoff package defines the visual contract

The subagents module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/subagents/` before the production UI rewrite is marked complete. The package SHALL use current Deck-facing DTOs, BFF action envelopes, generated Gateway params/results, and Go route behavior as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the subagents handoff package is created or refreshed
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document unsupported or uncertain product behavior as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** route documentation SHALL distinguish the v2 prototype's visual route model from production BFF action routes when they differ

### Requirement: Subagents production panel follows contract-backed workflows

The production subagents panel SHALL render and operate from contract-backed runs, lineage, kill, steer, agent permission, and config-default data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Subagent runs are loaded

- **WHEN** `fetchSubagentRuns` returns `DeckGoSubagentsListResponse`
- **THEN** the panel SHALL show live/history totals, filters, run queue, selected run detail, lineage, related agent/session navigation, outcome/raw inspection, and payload evidence
- **AND** missing optional fields SHALL render as unavailable rather than fabricated values
- **AND** supported status filters SHALL match the current Gateway schema values `active`, `completed`, `failed`, `timeout`, and `all`

#### Scenario: Subagent actions are invoked

- **WHEN** an operator steers or kills a selected run
- **THEN** the panel SHALL call the existing API wrappers with normalized `/api/deck/subagents` action payloads
- **AND** kill SHALL remain confirmation-gated for active or otherwise live-looking runs
- **AND** real live-run mutation SHALL be skipped-safe in L2 unless a disposable run fixture exists

#### Scenario: Per-agent permissions are saved

- **WHEN** an operator edits per-agent subagent permissions
- **THEN** the panel SHALL apply updates through the existing `deck.agents.subagents.set` BFF action wrapper using current `configHash` or base-hash information
- **AND** it SHALL not imply `allowAny`, atomic diff preview, REST-style config routes, or retry semantics beyond the current Gateway result contract unless those behaviors are verified

### Requirement: Subagents BFF forwards list query filters

The Deck Go backend SHALL forward contract-supported query parameters from `GET /deck/subagents` to the runtime/Gateway adapter so frontend filtering matches the contract exposed by `fetchSubagentRuns`.

#### Scenario: Child-agent filter is requested

- **WHEN** a browser calls `GET /deck/subagents?agentId=reviewer&status=all`
- **THEN** the backend SHALL include `agentId: "reviewer"` in the adapter params
- **AND** the runtime view SHALL be able to filter runs by child agent

#### Scenario: Pagination is requested

- **WHEN** a browser calls `GET /deck/subagents?limit=100&offset=20`
- **THEN** the backend SHALL include integer `limit` and `offset` in the adapter params when they parse successfully
- **AND** invalid integer query values SHALL be ignored rather than forwarded as strings

### Requirement: Subagents UI aligns with the settled frontend design system

The subagents panel SHALL use the chat/agents/routing design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Subagents UI is rendered

- **WHEN** the subagents panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose status, run queue, selected run detail, lineage, and primary steer/kill affordances without overlapping text or nested decorative cards
- **AND** per-agent permission mode SHALL remain reachable without displacing the active-run workflow
- **AND** prototype-only audit/stalled/killed states SHALL be visually degraded or documented when not backed by current contracts

### Requirement: Subagents mock visual verification is available

The subagents rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped subagent data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the subagents mock visual E2E is executed
- **THEN** it SHALL load subagent runs through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as lineage, permissions mode, permission edit, steer, kill confirmation, outcome, or raw detail
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
