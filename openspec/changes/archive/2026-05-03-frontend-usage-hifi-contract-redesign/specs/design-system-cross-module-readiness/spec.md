## ADDED Requirements

### Requirement: Usage readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Usage-specific evidence before this Usage high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models, and whether chart, KPI, quota, table, session-detail, and context-pressure molecules should remain local or be promoted later.

#### Scenario: Usage redesign completes

- **WHEN** the Usage high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Usage entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence
