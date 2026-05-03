## ADDED Requirements

### Requirement: Webhooks readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Webhooks-specific evidence before this Webhooks high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether webhook inventory rows, delivery rows, event subscription controls, receiver form sections, test-result seams, and raw payload molecules should remain local or be promoted later.

#### Scenario: Webhooks redesign completes

- **WHEN** the Webhooks high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Webhooks entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM or full external receiver delivery evidence
