## MODIFIED Requirements

### Requirement: Budget production panel follows Deck-local contract workflows

The production budget panel SHALL render and operate from contract-backed Deck budget data while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the v2 handoff as the visual target, but it SHALL follow route/method code truth: Budget rule CRUD is Deck-local BFF/localstore behavior, evaluation combines enabled local rules with managed runtime usage-cost totals, and unsupported forecast/history/audit/enforcement claims SHALL be recorded unless verified against a Deck-facing contract.

#### Scenario: Budget rules are loaded

- **WHEN** `fetchBudgetRules` and `evaluateBudgetRules` resolve with contract-shaped data
- **THEN** the panel SHALL show rule count, enabled count, warning count, over-limit count, selected rule identity, scope, target, dimension, period, enabled state, current evaluation value, warn threshold, over threshold, and status severity evidence
- **AND** missing optional fields such as agent id, task id, warn threshold, over threshold, current evaluation, timestamps, or evaluation status SHALL render as unavailable evidence rather than fabricated values
- **AND** the documented route chain SHALL use `GET /api/usage/budget` for Deck-local rule list and `GET /api/usage/budget/evaluate` for local-rule-plus-usage-cost evaluation
- **AND** the documented route chain SHALL NOT claim upstream `gateway.usage.budget.*` methods unless they are verified in code

#### Scenario: Budget rule actions are used

- **WHEN** an operator creates, edits, deletes, cancels, validates, refreshes, toggles, or selects a budget rule
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** rule mutations SHALL refresh budget rules and evaluations through the normal wrapper path
- **AND** validation failures SHALL keep invalid form state local without calling mutation wrappers
- **AND** successful action results SHALL leave the refreshed contract payload visible without replacing it with fabricated local-only data
- **AND** delete handling SHALL follow the current BFF response semantics instead of assuming a 204-only response

#### Scenario: Prototype-only budget workflows are reviewed

- **WHEN** the handoff package references real billing accuracy, production quota enforcement, predictive forecast, per-rule history, durable recent-change audit, notification routing, org/team billing policy, chart dependency, form dependency, or upstream budget RPCs
- **THEN** production SHALL keep those workflows out of guaranteed active behavior unless a matching Deck-facing contract or verified BFF endpoint exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/budget/implementation-notes.md`
