## Context

`frontend-new` already has a functional `MemoryPanel` under the `memory` panel id. It loads agent choices, browses memory files, reads files, searches memory with scoped fallback handling, displays health diagnostics, and runs dream-diary maintenance actions.

The current panel is behavior-rich, but the visual structure is old global `deck-ui-memory` styling: a large control card plus a detail card. It does not clearly separate file navigation, search/graph diagnostics, health state, and destructive dream maintenance workflows.

## Goals / Non-Goals

**Goals:**

- Produce a complete Memory handoff package.
- Rewrite Memory into a high-fidelity memory operations workspace aligned with the current design-system posture.
- Preserve browse/read/search/graph/health/dreams behavior, agent selection, destructive confirmation guards, and detail sidecar semantics.
- Fix deterministic mock Gateway memory payload gaps needed for visual E2E.
- Add focused mock visual coverage for the ready workspace and meaningful interaction states.
- Record Memory-specific design-system feedback without silently promoting atoms.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new Gateway or memory endpoints.
- No direct Gateway RPC from browser code.
- No new dependencies.
- No canonical design-system atom promotion inside this module change.
- No redesign of memory storage, LanceDB search, or dream-diary semantics beyond presenting current contract-shaped data.

## Decisions

1. **Treat Memory as a memory operations workspace.**
   The first viewport should answer which agent is being inspected, what files/nodes are visible, whether memory health/search is available, and which maintenance actions are safe or destructive.

2. **Keep browse/search and doctor lanes explicit.**
   File browse/read/search remains Deck BFF behavior, while health/dreams remains Gateway `doctor.memory.*` behavior. The UI should make these lanes visible without pretending they share identical source semantics.

3. **Use module-local molecules for file rows, graph rows, diagnostics, dream actions, and detail sidecar.**
   These patterns repeat some Sessions/Usage/Logs ideas, but Memory has specific path and safety semantics. Promotion waits for a separate design-system proposal.

4. **Fix only deterministic mock/API drift.**
   The mock Gateway should provide enough memory files, search results, health entries, dream diary, and action results to exercise the normal frontend path. Unknown LanceDB, dream repair, or memory file shape semantics become handoff follow-up.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses behavior.** -> Keep focused unit tests for browse/read, agent selection, directory navigation, search, health, dreams, confirmations, and detail rendering.
- **Risk: Destructive dream actions become too easy.** -> Preserve confirmation guards and visually mark destructive actions.
- **Risk: Mock data hides real Gateway gaps.** -> Label visual E2E as mock-only and document uncertain real memory/search/dream semantics in handoff notes.
- **Risk: Global CSS cleanup affects unrelated panels.** -> Move only `deck-ui-memory` styling to module-local CSS and verify focused Memory tests plus frontend build.
