## ADDED Requirements

### Requirement: Token Consumption Aggregation

The usage tracking panel SHALL display token consumption aggregated over three time windows: today, 7 days, and 30 days. Data SHALL be fetched via the `usage.status` and `usage.cost` Gateway RPCs.

#### Scenario: Display today's usage

- **WHEN** the user views the Usage panel
- **THEN** the panel SHALL call `usage.status` and display total tokens consumed (input + output) and estimated cost for the current day

#### Scenario: Display 7-day and 30-day usage

- **WHEN** the user selects the 7d or 30d time window
- **THEN** the panel SHALL display aggregated token consumption and cost for the selected period

### Requirement: Per-Model and Per-Agent Breakdown

The panel SHALL provide breakdowns of token usage by model and by agent via `sessions.usage` and `sessions.usage.logs`.

#### Scenario: Per-model breakdown

- **WHEN** the user views the model breakdown section
- **THEN** the panel SHALL display a table showing token consumption and cost per model, sorted by total tokens descending

#### Scenario: Per-agent breakdown

- **WHEN** the user views the agent breakdown section
- **THEN** the panel SHALL display a table showing token consumption and cost per agent

### Requirement: Usage Charts

The panel SHALL render time-series charts of token usage and cost using Recharts, with data from `sessions.usage.timeseries`.

#### Scenario: Time-series chart rendering

- **WHEN** the user views the Usage panel with a 7d or 30d window selected
- **THEN** the panel SHALL render a line/bar chart showing daily token usage and cost over the selected period

### Requirement: Context Window Pressure Monitoring

The panel SHALL display context window pressure indicators showing how close active sessions are to their model's context limit.

#### Scenario: Context pressure warning

- **WHEN** an active session's context usage exceeds 80% of the model's context window
- **THEN** the panel SHALL display a warning indicator with the current usage percentage and remaining token capacity
