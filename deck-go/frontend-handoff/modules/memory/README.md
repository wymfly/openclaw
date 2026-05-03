# memory - high-fidelity handoff

**Status:** `implemented`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-memory-hifi-contract-redesign`

This package defines the visual and interaction target for the `memory/` module
rewrite in `frontend-new`. The current panel already reaches the memory contract
chain, but its layout is still an old two-card browser shell. Code and
contracts remain the final authority when this handoff drifts.

## What this module does

`memory/` is the operations workspace for agent-scoped memory files, recall
search, path relationship inspection, memory health diagnostics, and dream-diary
maintenance. Operators use it to answer: which agent memory is visible, which
file or directory is selected, whether recall/search is available, what the
health lane says, and which maintenance action recently ran.

The design keeps agent selection, lane selection, current path, counts, and
selected detail in the first viewport. Search, graph, health, and dream actions
are presented as distinct lanes because the contract chain has two different
sources: Deck BFF browse/search endpoints and Gateway `doctor.memory.*` methods.

## Contract truth

Production and mocks must use the current Deck-facing and Gateway DTOs:

- `DeckGoMemoryFileNode`
- `DeckGoMemoryBrowseResponse`
- `DeckGoMemoryHealthEntry`
- `DeckGoMemoryHealthResponse`
- `DeckGoMemorySearchScope`
- `DeckGoMemorySearchResult`
- `DeckGoMemorySearchResponse`
- `DeckGoMemoryDreamAction`
- `DeckGoMemoryDreamDiaryResult`
- `DeckGoMemoryDreamActionResult`
- `DeckGoMemoryDreamsResult`
- `AgentsFilesListResult`
- `DoctorMemoryStatusResult`
- `DoctorMemoryDreamDiaryResult`
- `DoctorMemoryBackfillDreamDiaryResult`
- `DoctorMemoryDedupeDreamDiaryResult`
- `DoctorMemoryRepairDreamingArtifactsResult`
- `DoctorMemoryResetDreamDiaryResult`
- `DoctorMemoryResetGroundedShortTermResult`

Endpoint/RPC truth:

- `GET /memory/browse` -> Deck BFF, workspace path resolved from `agents.files.list`
- `GET /memory/search` -> Deck BFF search lane, currently returns LanceDB-unavailable fallback when not implemented
- `GET /memory/health` -> `doctor.memory.status`
- `POST /memory/dreams` -> `doctor.memory.dreamDiary` and maintenance methods

Browser code must continue through `frontend-new/src/api.ts` wrappers and the
Deck backend:

- `fetchAgentsList`
- `browseMemory`
- `readMemoryFile`
- `searchMemory`
- `fetchMemoryHealth`
- `runMemoryDreams`

It must not call Gateway RPC directly.

## Workflow constraints

- Visual convergence is the goal of this module pass: mock + frontend should
  become stable against the contract and design system.
- Code truth wins over this handoff when the two disagree.
- Deterministic fixture/API drift may be fixed in this change. Uncertain real
  Gateway memory storage, LanceDB recall quality, search result ranking, dream
  diary repair semantics, and reset side effects must be recorded as follow-up
  instead of invented in the UI.
- Directory clicks must browse; file clicks must read.
- Repair, reset, and reset short-term dream actions must keep confirmation
  guards.
- No new Gateway endpoints, new dependencies, or canonical atom promotion are
  part of this handoff.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Chip`, `Code`, `Input`, `SegmentedControl`,
`Select`, `Spinner`, `Tag`, and `JsonTree` can be used where production fit is
straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- memory metric tile
- lane switcher
- file/path row
- graph relation row
- search result row
- health diagnostic row
- dream action strip
- detail sidecar
- raw payload disclosure
- mock visual evidence banner

## How to implement

1. Open `prototype.html` and inspect ready, file-read, search-unavailable,
   graph, health, dreams, destructive-confirmation, empty, loading, and error
   states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   behavior.
3. Translate the prototype into `frontend-new/src/components/panels/memory/`,
   preserving API wrappers, agent selection, directory navigation, file read,
   search fallback, health loading, dream diary refresh, destructive
   confirmations, and detail sidecar behavior.
4. Move Memory styling out of global `theme.css` into module-local CSS.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.

## Open questions for follow-up

- Whether real `GET /memory/search` will stay a Deck-local LanceDB extension or
  move behind a typed Gateway RPC.
- Whether real search relevance is normalized `0..1` or may use a provider- or
  vector-store-specific score range.
- Whether `doctor.memory.status` will remain single-agent shaped or grow a
  stable multi-entry response.
- Which dream maintenance actions are safe enough for inline execution versus a
  future queued/background operation surface.
- Whether file-tree, graph row, and diagnostics rows should become canonical
  design-system atoms after Memory, Files, Logs, and Sessions converge.
