## Context

`frontend-new` already contains a functional `ThreadsPanel` under the `threads` panel id. It calls `fetchThreads()`, which reaches `GET /api/deck/threads`; the Go BFF forwards agent/channel/status filters to Gateway `deck.threads.list`. The generated Gateway result and Deck-facing DTO agree on the current `DeckGoThreadEntry` shape: `threadId`, `channelId`, `agentId`, `targetSessionKey`, `targetKind`, timestamps, account, bound-by, and optional label.

The current panel loads, filters, sorts, selects, copies session keys, and navigates to Sessions/Agents. The main gap is visual and workflow convergence: the layout is a dense table plus detail card using global `deck-ui-threads` CSS in `theme.css`, and there is no complete `frontend-handoff/modules/threads/` package.

## Goals / Non-Goals

**Goals:**

- Produce a complete Threads handoff package.
- Rewrite Threads into a high-fidelity relationship workspace aligned with the current design-system posture.
- Preserve filter behavior, sorted selection, copy/open handoffs, raw payload inspection, and BFF-only browser boundary.
- Fix deterministic mock Gateway data gaps needed for visual E2E.
- Add focused mock visual coverage for ready and interaction states.
- Record Threads-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new Gateway method or BFF route.
- No browser-side direct Gateway RPC.
- No new dependencies or table/editor libraries.
- No canonical design-system atom/pattern promotion inside this module change.
- No guarantee about unsupported non-Discord thread sources beyond contract-shaped rendering; uncertain upstream semantics become handoff open questions.

## Decisions

1. **Treat Threads as a relationship operations workspace, not a generic table.**
   The first viewport should expose filter state, thread inventory, selected binding identity, and the thread -> session -> agent relationship. This keeps the data contract visible and reduces reliance on a wide dense table.

2. **Preserve `fetchThreads()` and existing navigation helpers.**
   The frontend already respects the contract boundary by calling the BFF wrapper and using shared `navigateToSession` / `navigateToAgent`. The rewrite should keep this path rather than introducing a new client abstraction.

3. **Use module-local molecules for list rows, relationship map, handoff actions, and payload detail.**
   These molecules overlap with Sessions/Memory/Gateway detail patterns, but Threads has relationship-specific semantics. Any promotion to design-system patterns waits for a separate proposal.

4. **Keep filters simple and contract-shaped.**
   Agent id and channel remain text inputs; status remains the `"active" | "all"` contract enum. Do not infer richer status taxonomy that Gateway has not exposed.

5. **Fix only deterministic mock/API drift.**
   The mock Gateway should provide realistic thread bindings for normal frontend visual paths. If real `deck.threads.list` semantics differ for non-Discord channels or missing optional labels, document that as handoff rather than fabricating product guarantees.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses thread selection or handoff behavior.** -> Keep focused unit tests for load/sort/filter/select/copy/open behavior and visual E2E for ready plus interaction states.
- **Risk: Relationship visualization overstates Gateway truth.** -> Render only fields present in `DeckGoThreadEntry`; label missing optional values as unavailable or omit them.
- **Risk: Global CSS cleanup affects unrelated panels.** -> Move only `deck-ui-threads` styling to module-local CSS and verify focused Threads tests plus frontend build.
- **Risk: Mock visual coverage hides real Gateway gaps.** -> Label E2E as mock-only and record upstream thread-source uncertainty in handoff notes.
