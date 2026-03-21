## ADDED Requirements

### Requirement: Message throughput display

The system SHALL display message throughput statistics per channel, including messages received and messages sent over configurable time windows (1h, 6h, 24h).

#### Scenario: View throughput for a channel

- **WHEN** user selects a channel in the Channels panel
- **THEN** a throughput section shows messages in/out counts for the selected time window
- **THEN** a mini bar chart visualizes throughput over time (grouped by 5-min intervals for 1h, 30-min for 6h, 1h for 24h)

#### Scenario: Switch time window

- **WHEN** user selects "24h" from the time window selector (default is "1h")
- **THEN** the throughput chart updates to show the last 24 hours of data
- **THEN** the total count updates accordingly

#### Scenario: No traffic

- **WHEN** a channel has received no messages in the selected time window
- **THEN** the chart shows flat zero bars
- **THEN** a subtitle reads "No messages in the last {window}"

### Requirement: Throughput auto-refresh

The system SHALL auto-refresh throughput data at a configurable interval.

#### Scenario: Auto-refresh every 30 seconds

- **WHEN** user is viewing the throughput chart
- **THEN** data refreshes automatically every 30 seconds
- **THEN** a small "Last updated: X seconds ago" label is shown

#### Scenario: Pause auto-refresh

- **WHEN** user hovers over the chart (inspecting a data point)
- **THEN** auto-refresh is paused to prevent layout shift
- **THEN** auto-refresh resumes when hover ends

### Requirement: Aggregate throughput overview

The system SHALL show an aggregate throughput summary across all channels on the Channels panel header.

#### Scenario: View aggregate stats

- **WHEN** user opens the Channels panel
- **THEN** the panel header shows total messages in/out across all channels for the last hour
- **THEN** clicking the stats navigates to a detailed per-channel breakdown view
