# frontend-alerts-hifi-redesign Specification

## Purpose

Defines the high-fidelity, contract-backed Alerts redesign for Deck-local alert rule inventory, trigger/action policy evidence, rule CRUD/toggle/delete, fired-history fallback, mock/local visual verification, and design-system rollout evidence.

## Requirements

### Requirement: Alerts handoff package defines the visual contract

The alerts module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/alerts/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing alert wrappers, `/api/alerts*` BFF routes, and `DeckGoAlert*` DTOs as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the alerts handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document alert rule inventory, selected rule detail, trigger expression evidence, action/cooldown/timestamp evidence, create/edit/toggle/delete flows, loading/error/empty states, validation states, fired-history fallback, and mock visual states
- **AND** unsupported or uncertain real alert delivery, webhook delivery, escalation, fired history, and incident-feed semantics SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Alerts production panel follows Deck-local contract workflows

The production alerts panel SHALL render and operate from contract-backed Deck alert data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Alert rules are loaded

- **WHEN** `fetchAlertRules` resolves with contract-shaped data
- **THEN** the panel SHALL show rule count, enabled count, webhook/action count, last-fired count, selected rule identity, entity type, condition, threshold, action, cooldown, enabled state, timestamps, and last-fired evidence
- **AND** missing optional fields such as `lastFiredAt`, timestamps, entity label, action label, or cooldown SHALL render as unavailable evidence rather than fabricated values

#### Scenario: Alert rule actions are used

- **WHEN** an operator creates, edits, toggles, deletes, cancels, validates, refreshes, or selects an alert rule
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** rule mutations SHALL refresh alert rules through the normal wrapper path
- **AND** validation failures SHALL keep invalid form state local without calling mutation wrappers
- **AND** destructive delete SHALL require an explicit inline confirmation before calling `deleteAlertRule`

#### Scenario: Fired history fallback is inspected

- **WHEN** an operator opens the fired-history view
- **THEN** the panel SHALL clearly state that Gateway-backed fired alert history is unavailable
- **AND** it SHALL display supported `lastFiredAt` fallback evidence from alert rules when present
- **AND** it SHALL not invent fired alert event rows, severity history, delivery history, or incident timeline data

### Requirement: Alerts UI aligns with the settled frontend design system

The alerts panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Alerts UI is rendered

- **WHEN** the alerts panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose alert metrics, rule inventory, selected rule evidence, trigger expression, action/cooldown evidence, fired-history fallback access, and mutation controls without overlapping text or nested decorative cards
- **AND** long rule names, entity types, conditions, action names, timestamps, errors, and cooldown values SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Alerts mock visual verification is available

The alerts rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped alert data without requiring a real Gateway, real alert delivery, webhook receiver, or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the alerts mock/local visual E2E is executed
- **THEN** it SHALL load alert rules through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as create, edit, validation, toggle, delete confirmation, selected rule switch, or fired-history fallback
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, real alert delivery, webhook delivery, fired history, or production incident assurance
