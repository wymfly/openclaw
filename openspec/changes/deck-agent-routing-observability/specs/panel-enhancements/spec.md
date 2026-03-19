## ADDED Requirements

### Requirement: Sessions panel displays session type column

The Sessions list SHALL include a "Type" column showing DM (📱), Group (👥), Channel (💬), or Subagent (🔗) icons. Subagent sessions SHALL additionally show depth and parent agent.

#### Scenario: Display subagent session type

- **WHEN** user views Sessions panel and a session has key format `agent:*:subagent:*`
- **THEN** the Type column shows 🔗 Subagent with depth indicator and parent agent link

#### Scenario: Filter by session type

- **WHEN** user selects "Subagent" in the type filter dropdown
- **THEN** only subagent-type sessions are shown

### Requirement: Session detail shows lineage for subagent sessions

When viewing a subagent session's detail, a lineage block SHALL appear above the message history showing the call chain.

#### Scenario: Display lineage block

- **WHEN** user opens a session detail for a subagent session
- **THEN** system calls `deck.subagents.lineage({ sessionKey })` and renders the call chain using the LineageTree component, with a link to the Subagents panel

#### Scenario: Non-subagent session has no lineage

- **WHEN** user opens a session detail for a regular DM/group session
- **THEN** no lineage block is shown

### Requirement: Skills panel includes Agent assignment matrix tab

The Skills panel SHALL have a new tab "Agent Assignment Matrix" showing an Agent × Skill cross-table.

#### Scenario: Display matrix

- **WHEN** user navigates to the Skills panel Assignment Matrix tab
- **THEN** system renders a table with skills as rows and agents as columns; cells show 🔵 (all mode), ✅ (in whitelist), or ❌ (not in whitelist)

#### Scenario: Toggle skill assignment

- **WHEN** user clicks a ❌ cell for agent "coder" × skill "docker"
- **THEN** system calls `deck.agents.skills.set` to add "docker" to coder's whitelist; cell changes to ✅

#### Scenario: All-mode agent cells are not clickable

- **WHEN** user attempts to click a 🔵 cell
- **THEN** nothing happens; a tooltip explains "此 Agent 使用全部 Skill，需先到 Agent 详情切换为白名单模式"

### Requirement: Channels panel includes Agent bindings tab

The Channels panel SHALL have a new tab "Agent Bindings" showing which channels/groups route to which agents for a selected channel+account.

#### Scenario: View channel bindings

- **WHEN** user selects Discord / my-server in the channel+account selector
- **THEN** system calls `deck.routing.list({ channel: "discord", accountId: "my-server" })` and renders a mapping table of channels → agents

#### Scenario: Unbind channel

- **WHEN** user clicks "Unbind" on a binding row
- **THEN** system calls `deck.routing.remove({ id, baseHash })` and refreshes the list

#### Scenario: Display DM policy summary

- **WHEN** user views the Agent Bindings tab
- **THEN** the bottom area shows DM security policy, merge mode, and paired user count for the selected channel+account
