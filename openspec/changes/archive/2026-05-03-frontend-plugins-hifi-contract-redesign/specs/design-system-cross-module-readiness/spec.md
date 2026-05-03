## ADDED Requirements

### Requirement: Plugins readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Plugins-specific evidence before this Plugins high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether plugin metric tiles, inventory rows, selected-detail evidence, capability/action evidence, diagnostic surfaces, related-channel handoff strips, lifecycle limitation notices, and raw payload disclosure should remain local or be promoted later.

#### Scenario: Plugins redesign completes

- **WHEN** the Plugins high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Plugins entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, plugin lifecycle control, marketplace trust, package signature, or production activation assurance
