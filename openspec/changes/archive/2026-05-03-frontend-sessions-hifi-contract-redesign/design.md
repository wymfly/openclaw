## Context

`frontend-new` already has a functional `SessionsPanel` with session inventory, search/type/time filters, preview overlays, detail/history loading, transcript cache, usage/context diagnostics, compaction checkpoint actions, subagent lineage, transcript search/export, and reset/clear/patch/compact/delete actions. The panel uses Deck BFF endpoints and shared API wrappers; browser code does not call Gateway directly.

The current UI still depends on old `deck-ui-sessions` global styling and shared legacy shell components. Sessions is also denser than settings/logs because it combines an inventory list, selected-session detail, transcript evidence, usage timeline, compaction history, relationship graph, and mutation controls in one surface.

Exploration found the current contract boundaries are intentionally BFF-shaped:

- Session list/detail/history routes use projection and Deck chat shaping.
- Usage routes remain Deck BFF aggregates.
- Subagent lineage is pulled through the Deck subagents action route.
- Session mutations preserve Deck validation/defaulting and response shaping.

## Goals / Non-Goals

**Goals:**

- Produce a complete sessions handoff package.
- Rewrite sessions into a compact high-fidelity session operations workbench aligned with the settled design system.
- Preserve current session inventory, selection, cache, usage, compaction, lineage, transcript, export, and mutation behavior.
- Add contract-shaped mock visual coverage for the ready workbench and at least one interaction state.
- Record session-specific design-system feedback without promoting atoms in this module change.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new server-side pagination contract.
- No change to session mutation semantics.
- No direct Gateway RPC from browser code.
- No new dependencies.
- No design-system atom promotion inside this module change.

## Decisions

1. **Treat Sessions as a three-region operations workbench.**
   The UI should expose inventory, selected-session evidence, and actions as distinct regions. This keeps the dense workflow scannable without inventing a new route or hiding existing actions.

2. **Keep all data through existing API wrappers.**
   `fetchSessions`, `fetchSessionPreviews`, `fetchSessionDetail`, `fetchChatHistory`, usage wrappers, compaction wrappers, lineage, and session mutation wrappers remain the production boundary. If implementation finds deterministic drift, fix only the certain UI/mock/API mismatch; uncertain Gateway semantics become handoff follow-up.

3. **Preserve transcript cache and selected-session behavior.**
   The existing `getCachedTranscript` / `setCachedTranscript` / `invalidateTranscript` behavior protects performance and must survive the visual rewrite. Mutations that modify a session continue to refresh inventory and detail while preserving selection when appropriate.

4. **Keep compaction and delete confirmations inline unless the handoff proves modal necessity.**
   The existing two-step confirmation pattern is low risk and test-covered. A modal may be introduced only if it improves clarity without weakening keyboard access or tests.

5. **Keep session molecules local.**
   Candidate shared patterns include metric tiles, inventory rows, session hero, transcript search/export seam, context timeline, compaction row, and relationship row. They remain local until a dedicated design-system proposal defines stable APIs across more modules.

## Risks / Trade-offs

- **Risk: Behavior regression through a visual rewrite.** -> Preserve focused unit tests for load, selection, filters, transcript cache, usage/context, compaction, lineage, export, and mutations.
- **Risk: Overloaded first viewport.** -> Use a compact inventory/detail/actions layout with metrics and progressive details, not nested decorative cards.
- **Risk: Mock data hides real Gateway gaps.** -> Label visual E2E as mock-only and record uncertain contract gaps in handoff notes.
- **Risk: Shared legacy shell components constrain fidelity.** -> Use design-system atoms where straightforward and keep remaining session-specific rows local for this pass.
- **Risk: Large module diff.** -> Keep the change inside `panels/sessions/`, module-local CSS, mock fixture, E2E, handoff, and readiness docs.
