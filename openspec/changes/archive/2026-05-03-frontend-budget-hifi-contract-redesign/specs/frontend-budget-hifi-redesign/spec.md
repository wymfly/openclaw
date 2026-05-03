## ADDED Requirements

### Requirement: Budget handoff package defines the visual contract

The budget module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/budget/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing budget wrappers, `/api/usage/budget*` BFF routes, and `DeckGoBudget*` DTOs as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the budget handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document budget rule inventory, selected rule detail, evaluation severity, threshold progress, global/per-agent/per-task scopes, create/edit/delete flows, loading/error/empty states, validation states, and mock visual states
- **AND** unsupported or uncertain real billing, enforcement, usage aggregation, and quota semantics SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Budget production panel follows Deck-local contract workflows

The production budget panel SHALL render and operate from contract-backed Deck budget data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Budget rules are loaded

- **WHEN** `fetchBudgetRules` and `evaluateBudgetRules` resolve with contract-shaped data
- **THEN** the panel SHALL show rule count, enabled count, warning count, over-limit count, selected rule identity, scope, target, dimension, period, enabled state, current evaluation value, warn threshold, over threshold, and status severity evidence
- **AND** missing optional fields such as agent id, task id, warn threshold, over threshold, current evaluation, timestamps, or evaluation status SHALL render as unavailable evidence rather than fabricated values

#### Scenario: Budget rule actions are used

- **WHEN** an operator creates, edits, deletes, cancels, validates, refreshes, or selects a budget rule
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** rule mutations SHALL refresh budget rules and evaluations through the normal wrapper path
- **AND** validation failures SHALL keep invalid form state local without calling mutation wrappers
- **AND** successful action results SHALL leave the refreshed contract payload visible without replacing it with fabricated local-only data

### Requirement: Budget UI aligns with the settled frontend design system

The budget panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Budget UI is rendered

- **WHEN** the budget panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose budget metrics, rule inventory, selected rule evaluation, threshold progress, rule form affordances, and destructive confirmation access without overlapping text or nested decorative cards
- **AND** long rule names, agent ids, task ids, numeric values, periods, errors, and timestamps SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Budget mock visual verification is available

The budget rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped budget data without requiring a real Gateway, real billing data, or an LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the budget mock/local visual E2E is executed
- **THEN** it SHALL load budget rules and evaluations through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as create, edit, validation, delete confirmation, or selected rule switch
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, billing accuracy, usage enforcement, or production quota assurance
