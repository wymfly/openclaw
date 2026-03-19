## ADDED Requirements

### Requirement: deck.agents.detail returns aggregated agent information

The system SHALL return a complete agent profile including basic config, binding count, session count, active subagent count, effective skill mode, and subagent permission summary.

#### Scenario: Get detail for agent with whitelist skills

- **WHEN** client calls `deck.agents.detail({ agentId: "coder" })` and the agent has `skills: ["python", "node"]`
- **THEN** system returns `skillMode: "whitelist"`, `effectiveSkills: ["python", "node"]`, `totalAvailableSkills` reflecting the total system skill count, and `subagents` with effective max depth/children from global defaults

#### Scenario: Get detail for agent with no skill restriction

- **WHEN** client calls `deck.agents.detail({ agentId: "main" })` and the agent has no `skills` field
- **THEN** system returns `skillMode: "all"` and `effectiveSkills` containing all registered skill keys

### Requirement: deck.agents.skills.get returns per-agent skill assignment

The system SHALL return the agent's skill mode, assigned skills, and the full available skill list with eligibility and assignment status.

#### Scenario: Get skills for whitelist agent

- **WHEN** client calls `deck.agents.skills.get({ agentId: "coder" })`
- **THEN** system returns `mode: "whitelist"`, `skills` array with assigned keys, and `available` array where each skill has `eligible` (runtime) and `assigned` (in whitelist) booleans

### Requirement: deck.agents.skills.set updates per-agent skill assignment

The system SHALL write the agent's skill mode and whitelist to config. The operation SHALL require `baseHash`.

#### Scenario: Switch agent to whitelist mode

- **WHEN** client calls `deck.agents.skills.set({ agentId: "main", mode: "whitelist", skills: ["python", "git"], baseHash })`
- **THEN** system writes `skills: ["python", "git"]` to the agent's config and returns the new `configHash`

#### Scenario: Switch agent to all-skills mode

- **WHEN** client calls `deck.agents.skills.set({ agentId: "coder", mode: "all", skills: [], baseHash })`
- **THEN** system removes the `skills` field from the agent's config (or sets to undefined)

### Requirement: deck.agents.subagents.get returns subagent permissions

The system SHALL return per-agent subagent config (`allowAgents`, `model`) plus effective global defaults for display.

#### Scenario: Get subagent config

- **WHEN** client calls `deck.agents.subagents.get({ agentId: "main" })`
- **THEN** system returns `allowAgents`, `allowAny`, optional `model` override, `effectiveMaxSpawnDepth`, `effectiveMaxChildrenPerAgent`, and full agent lists for UI rendering

### Requirement: deck.agents.subagents.set updates subagent permissions

The system SHALL write `allowAgents` and `model` to the per-agent subagent config. The operation SHALL require `baseHash`. Global limits (`maxSpawnDepth`, `maxChildrenPerAgent`, `thinking`) SHALL NOT be writable through this method.

#### Scenario: Set allowed agents

- **WHEN** client calls `deck.agents.subagents.set({ agentId: "main", allowAgents: ["coder", "researcher"], model: null, baseHash })`
- **THEN** system writes `subagents.allowAgents: ["coder", "researcher"]` and clears model override

#### Scenario: Attempt to set global limit

- **WHEN** client calls `deck.agents.subagents.set` with fields like `maxSpawnDepth`
- **THEN** system ignores those fields (they are not part of the accepted params)
