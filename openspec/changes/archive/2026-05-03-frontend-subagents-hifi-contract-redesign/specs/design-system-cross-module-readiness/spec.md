## ADDED Requirements

### Requirement: Subagents readiness evidence is recorded for rollout

The cross-module readiness record SHALL include subagents-specific evidence before this subagents high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents and routing, and which candidates are now ready for a separate promotion proposal.

#### Scenario: Subagents redesign completes

- **WHEN** the subagents high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a subagents entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated agents/routing/subagents molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
