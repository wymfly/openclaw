## ADDED Requirements

### Requirement: Skills readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Skills-specific evidence before this Skills high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether skill inventory rows, requirement evidence rows, config editors, install-option rows, ClawHub catalog rows, agent skill matrix cells, and raw action detail molecules should remain local or be promoted later.

#### Scenario: Skills redesign completes

- **WHEN** the Skills high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Skills entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, real ClawHub marketplace, or production install safety evidence
