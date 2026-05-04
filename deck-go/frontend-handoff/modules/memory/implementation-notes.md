# Implementation notes — memory

> Per `frontend-handoff/CLAUDE.md` protocol enhancement #5 (后端契约协商). Records design decisions and contract reconciliations for the v2 multi-file rebuild.

## Stack lock — markdown rendering

**Decision (LOCKED):** production locks `react-markdown` + `remark-gfm` + `rehype-highlight`.

Same rationale as docs panel — the in-house renderer in `icons.jsx` is a stand-in covering enough grammar for visual demonstration (h1-h3, p, code, bold, lists, links, frontmatter block). Do **not** ship the in-house version. At translation time, replace `<MarkdownView source={text} />` with the same canonical `<MarkdownViewer>` wrapper used in the docs panel.

## Stack lock — semantic search backend

**Decision (LOCKED):** production uses LanceDB for vector storage and similarity search; the BFF exposes a thin facade via `POST /api/memory/search`. Falls back to keyword scan when LanceDB unavailable (501 with `unavailableReason`).

Rationale:

- LanceDB is already operational in OpenClaw memory pipeline
- Per-agent + global indexing already separates by scope at storage time
- Tier metadata (`core` / `working` / `peripheral`) and decay scores come from the memory's own bookkeeping — the panel just renders them

The frontend never speaks to LanceDB directly. All search goes through the Go BFF.

## Contract reconciliation — DTO shape

**Discovered:** the original PRD listed contract inputs as `DeckGoMemoryListResponse` and `DeckGoMemoryEntry`. Neither exists in `deck-go/contracts/source/deck-api.contract.ts`. The actual surface is much richer — a 4-tab control plane spanning:

- Browse (`DeckGoMemoryBrowseResponse` + `DeckGoMemoryFileNode`)
- Search (`DeckGoMemorySearchResponse` + `DeckGoMemorySearchResult` + `DeckGoMemorySearchScope`)
- Health (`DeckGoMemoryHealthResponse` + `DeckGoMemoryHealthEntry`)
- Dreams (`DeckGoMemoryDreamsResult` discriminated union: `DreamDiaryResult` ∪ `DreamActionResult`; 6 actions enumerated by `DeckGoMemoryDreamAction`)

**What this changed in framing:** the panel is not a list/detail browser of "memory entries". It is a **memory store control plane** with 4 distinct views, each with its own contract surface. The right pattern is a single-page **tabbed workspace** at the topbar with each tab owning its state machine.

**Resolution applied:**

1. Set up 4 first-class tabs (Browse / Search / Health / Dreams) in the topbar; each renders an independent component
2. Browse uses a 2-pane sub-layout (file tree + content viewer) with breadcrumbs + path-copy chip
3. Search uses a form (input + 3-button scope toggle) feeding a result list with weighted-score display (RelevanceBar + DecayBar + TierBadge + ScopeBadge)
4. Health is a KPI strip + table; tones flag errors at the topbar level (badge on the Health tab + KPI count in red)
5. Dreams uses a 2-pane sub-layout (agent picker + 6-action strip on left, diary content + action result + confirm row on right). Two-step confirm guards `reset` and `resetShortTerm`.
6. Mock fixtures (`SEARCH_FIXTURES`, `BROWSE_TREE`, `FILE_CONTENTS`, `HEALTH`, `DREAMS`) reproduce realistic shapes — provenance reads as if extracted from real session corpus

**Implication for translation (`frontend-new/src/components/panels/memory/`):**

- Use `import type { DeckGoMemory* } from "@/types/deck-api"` for every type
- Wire `browseMemory()` / `searchMemory()` / `fetchMemoryHealth()` / `runMemoryDreams()` from `frontend-new/src/api/memory.ts`
- The `AGENTS` registry stub in data.js should resolve via `fetchAgentsList()` + a memoized name+color lookup against the agents store
- Replace `BROWSE_TREE` map with **lazy fetch on directory expand**. The prototype's pre-loaded tree is only viable for ~16-file demos
- Search results must consume `r.lanceDbEnabled === false` and surface the `unavailableReason` warning verbatim
- Dream actions must wire scope-gating: hide `reset` and `resetShortTerm` below `operator.admin`; hide all write actions below `operator.write`

**No backend change needed.** The contract was correct; the PRD's invented type names were the only friction.

## Pattern emerging — tabbed control plane

The memory panel is the **first deck-go module to need a true tabbed first-class workspace** (vs. inline tabs inside a detail view, like channels' tabs). Per components.md, this is a **promotion candidate** for a canonical `<Tabs>` pattern in `@/design-system/patterns` once a second module needs the same shape.

Other panels likely to need this once they're rebuilt: gateway (already has a control-plane vibe), nodes (cluster overview vs. per-node detail).

## Component reuse cascade

| Molecule                          | Origin            | Reused at                                                                                  |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| `MarkdownView`                    | docs (US-020)     | Browse content viewer + Dreams diary viewer                                                |
| `AgentDot`                        | NEW (this module) | docs panel candidate (provenance row would benefit); promote after second use              |
| `TierBadge`                       | NEW               | Specific to memory tiers; not promotion candidate                                          |
| `ScopeBadge`                      | NEW               | Specific to memory scope; not promotion candidate                                          |
| `RelevanceBar`                    | NEW               | Reusable wherever a 0-1 score gradient bar is needed                                       |
| `DecayBar`                        | NEW               | Reusable wherever decay/staleness needs visual encoding                                    |
| `ConfirmRow` (inline danger gate) | docs (delete)     | dreams (reset / resetShortTerm). **Promote**: the pattern is identical — same UX language. |

## Notes on benign Babel-standalone diagnostics

The TS diagnostic noise about cross-tag globals (`Could not find name 'IconBrain'` etc. in `memory-dreams.jsx`) is the standard Babel-standalone pattern — globals are exported via `Object.assign(window, ...)` in `icons.jsx` and resolved at runtime. They do not affect prototype behavior; the translation step replaces them with real imports.

## Outstanding open questions (carried into Reverse sign-off)

See `README.md#open-questions-for-implementation`. Notable items:

- File tree lazy load (production must paginate, not eager-load)
- Search history persistence
- Search highlighting client-side
- Dream action progress streaming for `reset` / `backfill` (>5s actions)
- Audit-trail integration with Activity feed
- Direct edit of memory file content (currently read-only)
- LanceDB toggle for testing keyword fallback path
