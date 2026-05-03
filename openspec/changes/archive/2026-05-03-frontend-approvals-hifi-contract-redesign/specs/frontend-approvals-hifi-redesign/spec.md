## ADDED Requirements

### Requirement: Approvals handoff package defines the visual contract

The approvals module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/approvals/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing approval wrappers, `/api/approvals*` BFF routes, approval SSE events, and approval DTOs as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the approvals handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document pending exec approvals, plugin approvals, selected approval detail, policy defaults, agent overrides, allowlist paths, policy JSON editing, decisions, live stream updates, last-action evidence, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain real Gateway approval-list and plugin-list semantics SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Approvals production panel follows contract-backed workflows

The production approvals panel SHALL render and operate from contract-backed Deck approval data while preserving the existing panel registry, navigation, SSE, and API facade boundaries.

#### Scenario: Approval queues are loaded

- **WHEN** `fetchApprovalsPolicy`, `fetchPendingApprovals`, and `fetchPluginApprovals` resolve with contract-shaped data
- **THEN** the panel SHALL show approval readiness, pending exec count, active plugin pending count, allowlist count, agent override count, selected approval identity, selected approval command or plugin command, created/expiry evidence, policy hash/payload evidence, and queue evidence
- **AND** missing optional fields such as command argv, agent id, session key, run id, cwd, plugin description, decision, status, created time, expiry, or policy hash SHALL render as unavailable evidence rather than fabricated values

#### Scenario: Approval actions are used

- **WHEN** an operator allows once, allows always, denies, refreshes, opens an agent/session, saves policy, adds/removes an agent override, adds/removes an allowlist path, or changes policy defaults
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** successful action results SHALL remain inspectable as raw evidence without replacing the loaded approval or policy contract payload

#### Scenario: Approval stream updates are received

- **WHEN** approval SSE events add or resolve pending approvals
- **THEN** the panel SHALL update the pending queue without requiring a full page reload
- **AND** selected approval fallback SHALL remain stable when the selected approval is still available
- **AND** resolved approval ids SHALL be removed from pending queue evidence

### Requirement: Approvals UI aligns with the settled frontend design system

The approvals panel SHALL use the current chat/agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads/activity/api-explorer/cron/webhooks design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Approvals UI is rendered

- **WHEN** the approvals panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose exec and plugin queue state, selected approval evidence, decision actions, policy defaults, allowlist state, stream/action evidence, and raw payload access without overlapping text or nested decorative cards
- **AND** long commands, cwd paths, agent ids, session keys, run ids, plugin ids, allowlist paths, descriptions, errors, and JSON payload text SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Approvals mock visual verification is available

The approvals rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped approval data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the approvals mock/local visual E2E is executed
- **THEN** it SHALL load approval policy, pending exec approvals, and plugin approvals through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as exec/plugin surface switching, policy editing, decision result, selected approval switch, or stream update
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM or full approval security assurance
