## ADDED Requirements

### Requirement: Agents panel uses Master-Detail layout

The Agents panel SHALL display a list of agents on the left and a detail view with 5 tabs on the right.

#### Scenario: Select agent from list

- **WHEN** user clicks an agent in the left list
- **THEN** the right pane loads that agent's detail via `deck.agents.detail` and displays 5 tabs: Overview, Routing, Skills, Subagent, Sessions

### Requirement: Overview tab shows agent summary with stat cards

The Overview tab SHALL display basic agent info and clickable stat cards (binding count, skill count, subagent permissions, active sessions, active subagent runs).

#### Scenario: Display overview

- **WHEN** user views the Overview tab for agent "coder"
- **THEN** system shows basic info (ID, name, workspace, model, default status) and 5 stat cards with counts; clicking a card navigates to the corresponding tab or panel

### Requirement: Routing tab shows agent-specific bindings

The Routing tab SHALL display bindings filtered to the current agent, with add/edit/delete capabilities using the shared BindingDialog.

#### Scenario: View agent bindings

- **WHEN** user views the Routing tab for agent "coder"
- **THEN** system calls `deck.routing.list({ agentId: "coder" })` and renders only that agent's bindings

#### Scenario: Add binding from agent context

- **WHEN** user clicks "Add Binding" in the Routing tab
- **THEN** the BindingDialog opens with `agentId` pre-filled to the current agent

### Requirement: Skills tab manages per-agent skill assignment

The Skills tab SHALL allow switching between "all skills" and "whitelist" mode, and in whitelist mode, allow toggling individual skills.

#### Scenario: Switch to whitelist mode

- **WHEN** user selects "Custom Whitelist" and checks python, node, git
- **THEN** system calls `deck.agents.skills.set({ agentId, mode: "whitelist", skills: ["python", "node", "git"], baseHash })` and confirms success

#### Scenario: Display runtime eligibility

- **WHEN** user views the skills list
- **THEN** each skill shows runtime eligibility status (ready / dependency missing / platform incompatible)

### Requirement: Subagent tab manages agent spawn permissions

The Subagent tab SHALL allow configuring allowAgents and model override, display effective global limits (read-only), and show current active runs.

#### Scenario: Configure allowed agents

- **WHEN** user selects "Allow specific agents" and checks "researcher"
- **THEN** system calls `deck.agents.subagents.set({ agentId, allowAgents: ["researcher"], baseHash })` on save

#### Scenario: Display effective limits

- **WHEN** user views the Subagent tab
- **THEN** system shows effective maxSpawnDepth and maxChildrenPerAgent values from global defaults with a note "在 Subagents 面板 Config Tab 修改"

### Requirement: Sessions tab shows agent-scoped sessions

The Sessions tab SHALL display sessions belonging to the current agent, with type filtering.

#### Scenario: Filter subagent sessions

- **WHEN** user selects "Subagent" in the type filter
- **THEN** only sessions with subagent session keys are shown, each displaying depth and parent agent link
