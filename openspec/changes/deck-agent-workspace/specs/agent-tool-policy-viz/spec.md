## ADDED Requirements

### Requirement: Tool policy pipeline layer visualization

The tool policy section SHALL display the 7-layer policy pipeline as a vertical stacked diagram. Each layer SHALL show its config source key, rule count, and whether it narrows or expands the tool set.

#### Scenario: Agent with multiple active policy layers

- **WHEN** user views the tool policy section for an agent that has profile, global, agent-level, and group policies configured
- **THEN** each active layer is rendered as a pipeline step with its label (e.g., "tools.profile (coding)"), rule count, and a visual indicator of its effect (allow/deny/passthrough)

#### Scenario: Agent with only default policy

- **WHEN** user views the tool policy section for an agent with no custom policy layers
- **THEN** the pipeline shows only the default passthrough state with all tools allowed

#### Scenario: Empty layer display

- **WHEN** a policy layer has no rules configured
- **THEN** the layer is rendered in a muted style with a "no rules" indicator and does not affect the pipeline visualization

### Requirement: Per-tool resolution detail view

The tool policy section SHALL provide a per-tool detail view that shows the resolution chain — which layer allowed or denied each tool and the final computed result.

#### Scenario: User expands a specific tool's resolution

- **WHEN** user clicks on a tool name in the tool list
- **THEN** the system shows the resolution trace: each pipeline layer that evaluated this tool, the layer's decision (allow/deny/no-opinion), and the final result highlighted

#### Scenario: Tool denied by a specific layer

- **WHEN** a tool is denied by the agent-level policy but allowed by the global policy
- **THEN** the per-tool detail clearly shows the agent-level layer as the denying layer with a visual conflict indicator

### Requirement: Tool list with allow/deny summary

The tool policy section SHALL display a summary list of all available tools with their final allow/deny status after all policy layers are applied.

#### Scenario: Full tool list rendering

- **WHEN** the tool policy preview RPC returns the resolved tool list
- **THEN** each tool is rendered with its name, final status (allowed/denied), and the decisive layer label

#### Scenario: Tool list filtering

- **WHEN** user types in the tool search input
- **THEN** the tool list filters to show only tools matching the search query by name

### Requirement: Tool policy data sourced from gateway RPC

The tool policy visualization SHALL use the `deck.agents.toolPolicy.preview` RPC as its sole data source. The frontend SHALL NOT attempt to resolve tool policies client-side.

#### Scenario: RPC returns tool policy data

- **WHEN** user navigates to the tool policy section
- **THEN** the system calls `deck.agents.toolPolicy.preview` with the agent ID and renders the response

#### Scenario: RPC error handling

- **WHEN** the tool policy preview RPC fails
- **THEN** the section displays an error state with retry option and does not show stale data
