## ADDED Requirements

### Requirement: API Explorer readiness evidence is recorded for rollout

The cross-module readiness record SHALL include API Explorer-specific evidence before this API Explorer high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads/activity, and whether contract catalog rows, schema tree rows, tabbed inventory, and untyped/raw payload detail molecules should remain local or be promoted later.

#### Scenario: API Explorer redesign completes

- **WHEN** the API Explorer high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an API Explorer entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM or full upstream schema-completeness evidence
