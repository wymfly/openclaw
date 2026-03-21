## ADDED Requirements

### Requirement: Context health indicator

The system SHALL display a context health summary for each session in SessionDetail, including: token usage percentage (tokensIn + tokensOut vs contextWindow), compaction count, and total message count.

#### Scenario: View healthy session context

- **WHEN** user selects a session with 2000/8000 tokens used, 0 compactions, 15 messages
- **THEN** a health bar shows 25% usage (green)
- **THEN** compaction count shows "0" with a checkmark icon
- **THEN** message count shows "15"

#### Scenario: View stressed session context

- **WHEN** user selects a session with 7500/8000 tokens used, 3 compactions, 120 messages
- **THEN** the health bar shows 93.75% usage (red/warning color)
- **THEN** compaction count shows "3" with a warning icon
- **THEN** a tooltip warns "Context is near capacity; compaction may lose earlier messages"

#### Scenario: Context window not available

- **WHEN** a session has no contextWindow field
- **THEN** token usage shows absolute numbers without percentage
- **THEN** the health bar is hidden

### Requirement: Transcript search

The system SHALL allow full-text search within a session's conversation history.

#### Scenario: Search for keyword in transcript

- **WHEN** user enters "error" in the transcript search input
- **THEN** messages containing "error" are highlighted with matching text underlined
- **THEN** a result count badge shows "3 matches"
- **THEN** navigation arrows allow jumping between matches

#### Scenario: No search results

- **WHEN** user searches for a term with no matches
- **THEN** the search input shows "0 matches" and no highlights are applied

#### Scenario: Clear search

- **WHEN** user clears the search input
- **THEN** all highlights are removed and the full transcript is shown normally

### Requirement: Session export

The system SHALL allow exporting a session's transcript in JSON and Markdown formats via client-side download.

#### Scenario: Export as JSON

- **WHEN** user clicks "Export" and selects "JSON"
- **THEN** a JSON file is downloaded containing all session metadata and messages
- **THEN** the filename follows the pattern `session-{key}-{date}.json`

#### Scenario: Export as Markdown

- **WHEN** user clicks "Export" and selects "Markdown"
- **THEN** a Markdown file is downloaded with messages formatted as a readable transcript
- **THEN** user messages are prefixed with `**User:**` and assistant messages with `**Assistant:**`

#### Scenario: Export empty session

- **WHEN** user attempts to export a session with no messages
- **THEN** the export button is disabled with tooltip "No messages to export"
