# Agents impact session truth source

- **Source**: Claude Code review `docs/superpowers/specs/2026-05-12-deck-go-agents-section-ia-convergence-implementation-review.md`, F-Rev2.
- **Category**: contract-chain / real-e2e / product-read-model.
- **Status**: deferred.
- **Facts**:
  - `deck.agents.detail` still has legacy top-level `sessionCount` and `activeSubagentCount` fields required by the current response schema.
  - The current deck namespace handler does not have a verified Gateway truth source for per-agent session totals and active subagent session totals.
  - Returning nested `impact.sessions.total = 0` would incorrectly present "unknown" as "known zero".
- **Current resolution**:
  - Nested impact session fields are omitted when unavailable.
  - `impact.available` is `false` with `unavailableReason: "session-truth-unavailable"`.
  - Legacy top-level count fields remain compatibility placeholders until the detail response can be evolved more deeply.
- **Suggested next step**:
  - Create a dedicated proposal only after choosing a Gateway truth source for session attribution. Candidate sources include a deck namespace session index, a Gateway session listing method with agent attribution, or a server-side read model shared with Sessions.
- **Needs new OpenSpec**: yes, when implementing real per-agent session impact.
- **Acceptance clues**:
  - The future implementation must prove counts from real isolated Gateway data, not from mock fixture assumptions.
  - Nested `impact.sessions` should only be present when the source can prove `total`, `active`, and optional `truncated` semantics.
