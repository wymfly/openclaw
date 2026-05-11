## MODIFIED Requirements

### Requirement: Agents model-policy handoff SHALL be durable

The Models completion work SHALL leave a durable handoff for Agents model-policy editing, and once `deck-go-agents-model-policy-convergence` is implemented the handoff SHALL be marked promoted or resolved rather than remaining an untracked chat-only decision.

#### Scenario: Models convergence completes

- **WHEN** Models displays usage-policy references for text, image, image generation, video generation, music generation, PDF, compaction, memory search, or subagents
- **THEN** `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` SHALL name the OpenClaw source fields, product decisions, and acceptance hints for editing the supported Agents-owned policy fields
- **AND** Models SHALL keep those entries read-only.

#### Scenario: Future Agents work begins

- **WHEN** the Agents module convergence uses the Models handoff
- **THEN** it SHALL distinguish model asset ownership in Models from model strategy ownership in Agents without rediscovering the OpenClaw config boundary
- **AND** it SHALL verify each editable role against current OpenClaw config truth before exposing a write control.

#### Scenario: Agents model-policy convergence completes

- **WHEN** `deck-go-agents-model-policy-convergence` is implemented and verified
- **THEN** the Models handoff SHALL be updated to `promoted` or `resolved`
- **AND** any policy field that remains unsupported or outside Agents ownership SHALL be moved into a dated follow-up with fact evidence and suggested next OpenSpec scope.
