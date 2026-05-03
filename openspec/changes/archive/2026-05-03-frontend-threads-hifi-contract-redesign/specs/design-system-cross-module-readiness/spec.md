## ADDED Requirements

### Requirement: Threads readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Threads-specific evidence before this Threads high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory, and whether thread list row, relationship map, handoff action, and payload detail molecules should remain local or be promoted later.

#### Scenario: Threads redesign completes

- **WHEN** the Threads high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Threads entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence
