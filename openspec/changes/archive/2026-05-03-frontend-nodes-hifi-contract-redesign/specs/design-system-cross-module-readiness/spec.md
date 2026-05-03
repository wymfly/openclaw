## ADDED Requirements

### Requirement: Nodes readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Nodes-specific evidence before this Nodes high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether node metric tiles, inventory rows, lifecycle strips, pairing request rows, remote action forms, permission/capability chips, command/pending-work guards, and raw payload disclosures should remain local or be promoted later.

#### Scenario: Nodes redesign completes

- **WHEN** the Nodes high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Nodes entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, real device pairing, production trust proofing, remote command execution, or remote-control safety assurance
