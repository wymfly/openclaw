## ADDED Requirements

### Requirement: Run metadata bar per assistant message

The system SHALL display a compact metadata bar below each assistant message showing run-level execution information: model name, token usage, and duration.

#### Scenario: Complete run with full metadata

- **WHEN** an assistant message's run completes and the SSE agent event provides model, usage (input_tokens, output_tokens, cache_read_tokens), and duration
- **THEN** a metadata bar SHALL appear below the message showing: model badge (e.g., "opus-4"), token summary (e.g., "1.2k in / 3.4k out / 0.8k cache"), and duration (e.g., "12.3s")

#### Scenario: Streaming run (in progress)

- **WHEN** an assistant message is currently streaming
- **THEN** the metadata bar SHALL show: model badge (if known from first delta), a spinning token counter updating in real-time, and an elapsed timer

#### Scenario: Partial metadata available

- **WHEN** the agent event does not include all metadata fields (e.g., missing cache_read_tokens or model)
- **THEN** the metadata bar SHALL display available fields and show "—" for missing fields; the bar SHALL NOT be hidden entirely

#### Scenario: No metadata available

- **WHEN** no run-level metadata is available for an assistant message (e.g., loaded from history without metadata)
- **THEN** the metadata bar SHALL NOT be rendered for that message

### Requirement: Token usage formatting

The system SHALL format token counts in a human-readable compact form.

#### Scenario: Token count under 1000

- **WHEN** a token count is less than 1000
- **THEN** it SHALL be displayed as the exact number (e.g., "847")

#### Scenario: Token count 1000 or above

- **WHEN** a token count is 1000 or above
- **THEN** it SHALL be displayed with "k" suffix rounded to one decimal (e.g., "1.2k", "15.0k")

#### Scenario: Zero tokens

- **WHEN** a token count is 0
- **THEN** it SHALL be displayed as "0"

### Requirement: Duration formatting

The system SHALL format run duration in a human-readable form.

#### Scenario: Duration under 60 seconds

- **WHEN** run duration is less than 60 seconds
- **THEN** it SHALL be displayed as seconds with one decimal (e.g., "12.3s")

#### Scenario: Duration 60 seconds or above

- **WHEN** run duration is 60 seconds or above
- **THEN** it SHALL be displayed as minutes and seconds (e.g., "2m 15s")

#### Scenario: Duration unknown during streaming

- **WHEN** the run is still in progress
- **THEN** the elapsed time SHALL update every second showing a live counter
