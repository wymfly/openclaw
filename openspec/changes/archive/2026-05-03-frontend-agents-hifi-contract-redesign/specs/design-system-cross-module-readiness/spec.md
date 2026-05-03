## ADDED Requirements

### Requirement: Agents readiness evidence is recorded for rollout

The cross-module readiness record SHALL include agents-specific evidence before this agents high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which agents molecules remain local, and which candidates should be watched during routing/subagents/modules that follow.

#### Scenario: Agents redesign completes

- **WHEN** the agents high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an agents entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** unresolved design-system candidates SHALL be listed as follow-up/watch items rather than silently promoted
