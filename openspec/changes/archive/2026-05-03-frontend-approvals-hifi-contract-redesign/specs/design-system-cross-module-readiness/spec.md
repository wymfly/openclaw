## ADDED Requirements

### Requirement: Approvals readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Approvals-specific evidence before this Approvals high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether approval queue rows, decision action groups, policy default controls, allowlist rows, plugin approval rows, live stream markers, and raw policy/action evidence should remain local or be promoted later.

#### Scenario: Approvals redesign completes

- **WHEN** the Approvals high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an Approvals entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM or full approval security assurance
