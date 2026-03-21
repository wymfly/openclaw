## ADDED Requirements

### Requirement: Context tab displays system prompt composition layers

The Context tab SHALL display the system prompt as a set of collapsible composition layers: bootstrap files, identity, skills prompt, extra instructions, and hook overrides. Each layer SHALL show its source label, character count, and a preview of its content.

#### Scenario: Agent with all prompt layers populated

- **WHEN** user navigates to the Context tab for an agent that has identity, bootstrap files, skills, and extra instructions configured
- **THEN** each layer is rendered as a collapsible section with its source label, character count badge, and truncated content preview

#### Scenario: Agent with minimal configuration

- **WHEN** user navigates to the Context tab for an agent with only default configuration (no custom bootstrap or identity)
- **THEN** only the default layers (skills prompt, base system prompt) are shown; empty layers display an "unconfigured" indicator

### Requirement: Full assembled system prompt preview

The Context tab SHALL provide a "Preview Full Prompt" toggle that renders the complete assembled system prompt text as returned by the `deck.agents.systemPrompt.preview` RPC.

#### Scenario: User toggles full prompt preview

- **WHEN** user clicks the "Preview Full Prompt" toggle
- **THEN** the system fetches the assembled prompt via RPC and renders it in a read-only code block with syntax highlighting and a character/token count header

#### Scenario: Preview reflects channel context

- **WHEN** user selects a channel context (e.g., "telegram", "discord") from the optional context selector
- **THEN** the preview re-fetches with that channel context and displays the channel-specific prompt variant

### Requirement: Bootstrap file inline editor

The Context tab SHALL allow viewing and editing workspace bootstrap files (BOOTSTRAP.md, HEARTBEAT.md, IDENTITY.md, SOUL.md, TOOLS.md, USER.md) via inline editor using existing `deck.agents.files.get` and `deck.agents.files.set` RPCs.

#### Scenario: User opens a bootstrap file for editing

- **WHEN** user clicks on a bootstrap file entry in the Context tab
- **THEN** the file content loads in an inline editor with markdown syntax awareness and a Save button

#### Scenario: User saves an edited bootstrap file

- **WHEN** user modifies a bootstrap file and clicks Save
- **THEN** the system writes the file via `deck.agents.files.set` RPC, shows a success indicator, and refreshes the prompt preview if it is currently visible

#### Scenario: File does not exist yet

- **WHEN** user opens a bootstrap file that does not exist for the agent
- **THEN** the editor shows an empty state with a "Create" button that writes a new file via the same RPC

### Requirement: Context tab uses collapsible sections for density management

All subsections within the Context tab (prompt layers, tool policy, bootstrap files) SHALL be rendered as collapsible accordions, with prompt layers collapsed by default.

#### Scenario: Default collapsed state

- **WHEN** user first navigates to the Context tab
- **THEN** prompt layer sections are collapsed showing only labels and character counts; bootstrap files section shows the file list without content

#### Scenario: Expand a section

- **WHEN** user clicks on a collapsed section header
- **THEN** the section expands to show full content with smooth animation
