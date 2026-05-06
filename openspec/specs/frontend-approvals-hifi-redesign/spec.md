# frontend-approvals-hifi-redesign Specification

## Purpose

Defines the high-fidelity, contract-backed Approvals redesign for Deck BFF/Gateway approval control, policy editing, queue filtering, selected approval evidence, decision actions, approval stream updates, mock/local visual verification, and design-system rollout evidence.

## Requirements

### Requirement: Approvals handoff package defines the visual contract

The approvals module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/approvals/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing approval wrappers, `/api/approvals*` BFF routes, `/api/stream` approval SSE events, Gateway approval methods, and approval DTOs as the source truth. Prototype claims that conflict with code truth SHALL be corrected in handoff notes during implementation.

#### Scenario: Handoff package is reviewed

- **WHEN** the approvals handoff package is created or refreshed
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, `api-usage.md`, and implementation notes
- **AND** the package SHALL document pending exec approvals, plugin approvals, kind filter/search, selected approval detail, countdown evidence, decision bar, current lack of Gateway-backed decision reason fields, policy defaults, agent overrides, allowlist paths, policy editing, live stream updates, last-action evidence, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain real Gateway approval-list, plugin-list, recent-decision audit, summary KPI, bulk action, policy reason validation, and countdown-authority semantics SHALL be documented as follow-up rather than silently fabricated in the UI
- **AND** any reference to non-existent BFF routes, non-authoritative decision values, undeclared dependencies, or backend features SHALL be reconciled against implementation notes before archive

### Requirement: Approvals production panel follows contract-backed workflows

The production approvals panel SHALL render and operate from contract-backed Deck approval data while preserving the existing panel registry, navigation, SSE, and API facade boundaries.

#### Scenario: Approval queues are loaded

- **WHEN** `fetchApprovalsPolicy`, `fetchPendingApprovals`, and `fetchPluginApprovals` resolve with contract-shaped data
- **THEN** the panel SHALL show approval readiness, pending exec count, active plugin pending count, allowlist count, agent override count, selected approval identity, selected approval command or plugin request, created/expiry evidence, policy hash/payload evidence, queue evidence, and raw payload evidence
- **AND** missing optional fields such as command argv, agent id, session key, run id, cwd, plugin description, requested scopes, source URL, decision, status, created time, expiry, requester, or policy hash SHALL render as unavailable evidence rather than fabricated values
- **AND** untyped approval-list and plugin-list response shapes SHALL be normalized defensively before rendering

#### Scenario: Approval actions are used

- **WHEN** an operator allows once, allows always, denies, refreshes, opens an agent/session, saves policy, adds/removes an agent override, adds/removes an allowlist path, or changes policy defaults
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes and Gateway-supported hyphenated decision values
- **AND** destructive decisions SHALL remain visibly associated with the selected approval
- **AND** successful action results SHALL remain inspectable as raw evidence without replacing the loaded approval or policy contract payload

#### Scenario: Approval stream updates are received

- **WHEN** approval SSE events add or resolve pending approvals through `/api/stream`
- **THEN** the panel SHALL update the pending queue without requiring a full page reload
- **AND** selected approval fallback SHALL remain stable when the selected approval is still available
- **AND** resolved approval ids SHALL be removed from pending queue evidence

### Requirement: Approvals UI aligns with the settled frontend design system

The approvals panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Approvals UI is rendered

- **WHEN** the approvals panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose exec and plugin queue state, selected approval evidence, decision actions, policy state, stream/action evidence, and raw payload access without overlapping text or nested decorative cards
- **AND** long commands, cwd paths, agent ids, session keys, run ids, plugin ids, allowlist paths, descriptions, errors, reason text, and JSON payload text SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Approvals mock visual verification is available

The approvals rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped approval data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the approvals mock/local visual E2E is executed
- **THEN** it SHALL load approval policy, pending exec approvals, plugin approvals, and approval stream setup through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as exec/plugin surface switching, queue search/filtering, policy editing, decision result, selected approval switch, unsupported reason affordance, or stream update
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM or full approval security assurance
