## ADDED Requirements

### Requirement: Budget readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Budget-specific evidence before this Budget high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether budget metric tiles, rule inventory rows, threshold progress bars, scoped rule forms, evaluation status evidence, and destructive confirmation controls should remain local or be promoted later.

#### Scenario: Budget redesign completes

- **WHEN** the Budget high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Budget entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, billing accuracy, usage enforcement, or production quota assurance
