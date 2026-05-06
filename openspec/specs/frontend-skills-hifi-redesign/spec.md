# frontend-skills-hifi-redesign Specification

## Purpose

Defines the high-fidelity, contract-backed Skills redesign for installed skill inventory, configuration, ClawHub discovery/actions, agent skill assignment, mock/local visual verification, and design-system rollout evidence.

## Requirements

### Requirement: Skills handoff package defines the visual contract

The skills module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/skills/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing skill wrappers, `/api/skills*` BFF routes, `/api/agents` skill actions, generated `skills.*` Gateway contracts, generated `deck.agents.skills.*` Gateway contracts, and `DeckGoSkill*` / `DeckGoAgentSkills*` DTOs as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the skills handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document installed skill inventory, selected skill detail, readiness/missing requirements, configuration editing, install options, ClawHub bins/search/detail/install/update, agent skill matrix, matrix mutation evidence, last-action evidence, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain real ClawHub install/network safety semantics SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Skills production panel follows contract-backed workflows

The production skills panel SHALL render and operate from contract-backed Deck skill data while preserving the existing panel registry, navigation, and API facade boundaries.

#### Scenario: Skill inventory is loaded

- **WHEN** `fetchSkills`, `fetchSkillHubBins`, `fetchAgentsList`, and `fetchAgentSkills` resolve with contract-shaped data
- **THEN** the panel SHALL show skill readiness, installed count, ready count, needs-setup count, selected skill identity, source, status, enabled state, primary env, missing requirement evidence, install options, ClawHub bins/search affordances, and agent skill matrix evidence
- **AND** missing optional fields such as emoji, description, homepage, primary env, config, install options, missing requirements, agent name, mode, assigned state, or config hash SHALL render as unavailable evidence rather than fabricated values

#### Scenario: Skill actions are used

- **WHEN** an operator enables, disables, saves config, installs an option, refreshes inventory, searches ClawHub, loads hub detail, installs from ClawHub, updates ClawHub, refreshes the matrix, toggles an agent whitelist assignment, or navigates to an agent skills view
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** agent skill updates SHALL pass the current `configHash` as `baseHash`
- **AND** successful action results SHALL remain inspectable as raw evidence without replacing the loaded skill or agent skill contract payload

#### Scenario: ClawHub detail is inspected

- **WHEN** an operator selects a ClawHub search result
- **THEN** the panel SHALL render detail from `DeckGoSkillHubDetailResponse`
- **AND** slug, display name, summary, latest version, owner, platform metadata, changelog, and raw mutation evidence SHALL be displayed when present
- **AND** unavailable owner, metadata, version, or changelog fields SHALL be labeled as unavailable rather than invented

### Requirement: Skills UI aligns with the settled frontend design system

The skills panel SHALL use the current chat/agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads/activity/api-explorer/cron/webhooks/approvals design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Skills UI is rendered

- **WHEN** the skills panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose installed inventory, selected skill evidence, requirement/config/install controls, ClawHub catalog state, agent matrix summary, and raw evidence access without overlapping text or nested decorative cards
- **AND** long skill names, keys, descriptions, env keys, install ids, bin names, slugs, agent ids, config hashes, errors, and JSON payload text SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Skills mock visual verification is available

The skills rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped skill data without requiring a real Gateway, real ClawHub network access, or an LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the skills mock/local visual E2E is executed
- **THEN** it SHALL load skill inventory, ClawHub support data, and agent skill matrix data through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as selected skill switch, config save, install option, ClawHub detail/install/update, or agent matrix toggle
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, real ClawHub marketplace, or production install safety assurance

### Requirement: Skills high-fidelity completion is not real functional completion

The Skills high-fidelity workflow SHALL remain a required visual quality gate, but it SHALL NOT be considered sufficient evidence that Skills works against a real OpenClaw Gateway, real ClawHub network, real credential persistence, or safe production install/update semantics.

#### Scenario: Skills mock visual evidence is reported

- **WHEN** Skills mock visual tests or high-fidelity prototype checks pass
- **THEN** implementation closeout SHALL label the evidence as L1 mock visual evidence
- **AND** it SHALL also report L2 real verification status separately as passed, handoff-blocked, skipped, or not attempted with reason

#### Scenario: Real Skills verification contradicts mock assumptions

- **WHEN** real Gateway or Deck BFF verification contradicts mock data or a prototype assumption
- **THEN** the production implementation SHALL prefer real Gateway, Deck contract, and Go BFF truth
- **AND** the mock fixture or prototype notes SHALL be updated when the contradiction is deterministic and in scope

#### Scenario: Skills mutation safety is not proven by prototype actions

- **WHEN** the prototype or mock visual E2E demonstrates install, update, config, ClawHub, or agent assignment actions
- **THEN** the evidence SHALL remain mock/local unless the same action has disposable or reversible real-stack verification
- **AND** unsupported or unsafe mutation assumptions SHALL be recorded as handoff-blocked rather than silently presented as fully real-verified capability
