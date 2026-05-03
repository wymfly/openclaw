## ADDED Requirements

### Requirement: Channels readiness evidence is recorded for rollout

The cross-module readiness record SHALL include channels-specific evidence before this channels high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions, and whether channels introduces diagnostics/settings/access molecules that should remain local or be promoted later.

#### Scenario: Channels redesign completes

- **WHEN** the channels high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a channels entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
