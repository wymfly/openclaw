## ADDED Requirements

### Requirement: Cron readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Cron-specific evidence before this Cron high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether scheduler status tiles, job catalog rows, form sections, run-history rows, heartbeat detail, and raw action detail molecules should remain local or be promoted later.

#### Scenario: Cron redesign completes

- **WHEN** the Cron high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Cron entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM or full upstream scheduler-completeness evidence
