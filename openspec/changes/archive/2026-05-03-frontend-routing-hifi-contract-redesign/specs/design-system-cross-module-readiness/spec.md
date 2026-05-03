## ADDED Requirements

### Requirement: Routing readiness evidence is recorded for rollout

The cross-module readiness record SHALL include routing-specific evidence before this routing high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents, and which candidates remain watch items for subagents and later modules.

#### Scenario: Routing redesign completes

- **WHEN** the routing high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a routing entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** any repeated agents/routing molecules SHALL be classified as local, promote-later, or follow-up rather than silently becoming canonical design-system behavior
