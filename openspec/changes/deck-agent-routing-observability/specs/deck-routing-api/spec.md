## ADDED Requirements

### Requirement: deck.routing.list returns all bindings with computed tiers

The system SHALL return all configured bindings with pre-computed priority tier labels and a content-hash synthetic ID. Results SHALL be filterable by `agentId`, `channel`, and `accountId`. Response SHALL include `configHash` for optimistic locking.

#### Scenario: List all bindings

- **WHEN** client calls `deck.routing.list` with no filters
- **THEN** system returns all bindings sorted by tier priority (peer → peer.parent → guild+roles → guild → team → account → channel), each with a deterministic content-hash `id`, plus `defaultAgentId`, `dmScope`, and `configHash`

#### Scenario: Filter by agentId

- **WHEN** client calls `deck.routing.list({ agentId: "coder" })`
- **THEN** system returns only bindings where `agentId` is "coder"

### Requirement: deck.routing.add creates a binding with conflict detection

The system SHALL atomically add a binding to `config.bindings`, validate against existing bindings, and return warnings for overlaps or shadows. The operation SHALL require `baseHash` for optimistic locking.

#### Scenario: Add binding successfully

- **WHEN** client calls `deck.routing.add` with valid `agentId`, `match`, and correct `baseHash`
- **THEN** system appends the binding to config, returns `ok: true`, the new binding with computed `id` and `tier`, and the new `configHash`

#### Scenario: Add binding with conflict

- **WHEN** client calls `deck.routing.add` with a `match` that overlaps an existing binding for a different agent
- **THEN** system adds the binding but returns `warnings` array containing the overlap details

#### Scenario: Add binding with stale baseHash

- **WHEN** client calls `deck.routing.add` with a `baseHash` that does not match current config hash
- **THEN** system returns `CONFLICT` error without modifying config

### Requirement: deck.routing.remove deletes a binding by content-hash ID

The system SHALL remove a binding identified by its content-hash ID. The operation SHALL require `baseHash`.

#### Scenario: Remove existing binding

- **WHEN** client calls `deck.routing.remove({ id: "<hash>", baseHash: "<hash>" })`
- **THEN** system removes the matching binding, returns the removed binding details and optional `impact` message describing the routing fallback

#### Scenario: Remove non-existent binding

- **WHEN** client calls `deck.routing.remove` with an `id` that matches no binding
- **THEN** system returns `NOT_FOUND` error

### Requirement: deck.routing.validate checks for conflicts without writing

The system SHALL evaluate a proposed binding against existing bindings and return conflict analysis without modifying config.

#### Scenario: Validate clean binding

- **WHEN** client calls `deck.routing.validate` with a match that has no conflicts
- **THEN** system returns `ok: true` with the predicted `tier` and empty `conflicts` array

#### Scenario: Validate duplicate binding

- **WHEN** client calls `deck.routing.validate` with a match identical to an existing binding
- **THEN** system returns `ok: false` with a conflict of type `"duplicate"`

### Requirement: deck.routing.simulate resolves routing for given parameters

The system SHALL call the existing `resolveAgentRoute()` function and return the matched agent, binding, session key, and per-tier check results (8 entries: 7 binding tiers + default).

#### Scenario: Simulate with peer match

- **WHEN** client calls `deck.routing.simulate({ channel: "discord", peer: { kind: "channel", id: "dev-help" } })`
- **THEN** system returns the matching agentId, `matchedBy: "binding.peer"`, the generated sessionKey, and a `tiers` array where the "peer" entry has `matched: true` and all subsequent tiers have `checked: false`

#### Scenario: Simulate with no binding match

- **WHEN** client calls `deck.routing.simulate` with parameters that match no binding
- **THEN** system returns the default agent, `matchedBy: "default"`, and a `tiers` array where all 7 binding tiers show `matched: false` and the "default" tier shows `matched: true`
