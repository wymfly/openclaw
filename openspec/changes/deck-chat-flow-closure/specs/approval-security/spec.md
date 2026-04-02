## MODIFIED Requirements

### Requirement: Pending Approvals Management

Pending approvals SHALL be routable to both the dedicated Approvals panel and the chat session that triggered them.

#### Scenario: Approval event carries session routing context

- **WHEN** the backend emits an approval-requested event
- **THEN** the event delivered to Deck consumers SHALL include the originating `sessionKey`

#### Scenario: Chat panel shows inline approval for active session

- **WHEN** the active session receives a pending approval
- **THEN** the chat panel SHALL display an inline approval UI for that session in addition to the dedicated Approvals panel entry

#### Scenario: Approval resolved in one surface clears the other

- **WHEN** the user resolves an approval from either the chat panel or the Approvals panel
- **THEN** the pending approval SHALL be cleared in both surfaces without requiring a manual refresh
