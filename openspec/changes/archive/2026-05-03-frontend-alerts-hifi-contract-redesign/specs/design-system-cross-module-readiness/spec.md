## ADDED Requirements

### Requirement: Alerts readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Alerts-specific evidence before this Alerts high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether alert metric tiles, rule inventory rows, trigger expression cards, action/cooldown evidence, fired-history fallback, policy forms, and destructive confirmation controls should remain local or be promoted later.

#### Scenario: Alerts redesign completes

- **WHEN** the Alerts high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an Alerts entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, alert delivery, webhook delivery, fired history, or production incident assurance
