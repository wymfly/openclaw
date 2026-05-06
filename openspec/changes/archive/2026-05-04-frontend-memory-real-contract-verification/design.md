## Context

`memory` already has a production panel and an existing hifi redesign spec, but the current implementation predates the refreshed v2 handoff. The v2 package under `deck-go/frontend-handoff/modules/memory/` defines a four-tab Memory store control plane: Browse, Search, Health, and Dreams. The current `frontend-new` panel exposes a broader five-lane layout including a derived graph lane, uses a GET-only search wrapper, renders Markdown mostly as raw text/code, and has mock visual coverage but not bounded real-stack coverage.

Verified route chain for the proposal baseline:

- `GET /api/memory/browse?agentId={id}&path={path}` -> Go BFF -> `agents.files.list` workspace resolution -> filesystem directory browse.
- `GET /api/memory/browse?agentId={id}&path={path}&read=1` -> same workspace resolution -> filesystem file read.
- `GET /api/memory/health` -> Go BFF -> Gateway `doctor.memory.status`.
- `POST /api/memory/dreams` -> Go BFF -> Gateway `doctor.memory.dreamDiary`, `doctor.memory.backfillDreamDiary`, `doctor.memory.dedupeDreamDiary`, `doctor.memory.repairDreamingArtifacts`, `doctor.memory.resetGroundedShortTerm`, or `doctor.memory.resetDreamDiary`.
- `GET /api/memory/search?q=...` -> currently a BFF degraded route returning `501 Not Implemented` when LanceDB search is unavailable.

Observed deterministic drift at proposal time:

- The refreshed handoff declares `POST /api/memory/search` with `{ query, scope?, agentId? }`, while `frontend-new/src/api.ts`, endpoint classification, server routes, and tests still use only `GET /api/memory/search?q=...`.
- The handoff says the production tab set is Browse/Search/Health/Dreams, while the current production panel exposes an extra Graph lane from earlier work.
- The handoff describes inline confirmation rows for dangerous dream actions, while the current production panel uses `window.confirm`, and also treats `repair` as dangerous despite the v2 handoff classifying only `resetShortTerm` and `reset` as destructive-confirm actions.
- The handoff asks for production Markdown rendering but the project has not approved a new Markdown dependency for this module.

## Goals / Non-Goals

**Goals:**

- Verify Memory from handoff prototype through frontend wrappers, Go BFF routes, OpenClaw Gateway methods, mocks, and real-stack behavior.
- Make `POST /api/memory/search` the canonical frontend and BFF route while preserving existing GET search as a compatibility alias.
- Translate the v2 handoff into production code as far as current contracts and existing dependencies allow: four first-class tabs, lazy browse/read, semantic-or-degraded search warning, health diagnostics, dream-diary viewer, guarded destructive actions, Markdown-like content rendering, loading/empty/error states, and BFF-only browser access.
- Add bounded real-stack evidence without requiring real LanceDB availability, non-empty memory files, or successful destructive dream maintenance.
- Record unsupported or ambiguous claims for final review instead of hiding them in code.

**Non-Goals:**

- Add a Markdown, search, table, or charting dependency without explicit approval.
- Guarantee LanceDB semantic quality, search ranking correctness, or non-empty search results.
- Add memory file editing, note authoring, dream progress streaming, Activity audit rows, persisted search history, or cross-module deep-linking.
- Add new Gateway methods or change upstream Gateway schemas.
- Replace the auth/scope enforcement model; this change may document current scope assumptions but not redesign authorization.

## Decisions

- **Use POST search as canonical and keep GET as a compatibility alias.** The handoff's POST body is the stronger product/API shape for non-trivial search text and explicit scope. Keeping GET preserves existing tests, visual fixtures, and any older callers while allowing the production panel to move forward.
- **Keep LanceDB unavailable as a degraded state, not a hard UI failure.** The current BFF can legitimately return `501` when semantic search is unavailable. The wrapper must normalize that into `DeckGoMemorySearchResponse { results: [], lanceDbEnabled: false, unavailableReason }`, and the panel must render the warning.
- **Implement a four-tab Memory workspace.** The v2 handoff supersedes the earlier graph lane. Relationship/count evidence can remain inside Browse details when backed by loaded file nodes, but Graph is not a first-class tab in this change.
- **Use module-local Markdown rendering with existing dependencies.** The handoff mentions `react-markdown` for production, but the dependency is not declared and repo rules prohibit adding dependencies without approval. A small module-local renderer for headings, paragraphs, lists, code fences, links-as-text, and frontmatter blocks is acceptable for read-only memory content; fidelity gaps are recorded.
- **Use inline confirmation for destructive dream actions.** `resetShortTerm` and `reset` require an explicit in-panel confirm/cancel row. `repair` remains a non-danger maintenance action unless the backend or policy layer later classifies it as destructive.
- **Separate real capability from real data volume.** L2 real-stack tests must verify route shape, Gateway method reachability where applicable, UI rendering, and browser-to-BFF-only behavior. Empty directory listings, missing dream diaries, search 501, or unavailable LanceDB can be valid evidence after bounded attempts.

## Risks / Trade-offs

- **Real memory files may be absent or workspace resolution may fail** -> Verify route shape and render empty/degraded states; record service-unavailable evidence instead of fabricating data.
- **Search may remain 501 without LanceDB** -> Normalize as a warning and keep L1 mock visual coverage for result rows and relevance/decay bars.
- **POST search may diverge from existing GET tests** -> Preserve GET alias and add focused tests for both canonical POST and compatibility GET.
- **Markdown rendering may not match a mature GFM parser** -> Keep the renderer module-local, avoid unsafe HTML, and record dependency-blocked Markdown fidelity for later review.
- **Dream actions can mutate user memory** -> Real-stack verification should favor `read` and route-shape checks. Destructive actions remain mock/focused-test verified unless explicitly approved for real execution.
- **Auth/scope assumptions may be incomplete** -> UI should not claim fine-grained scope enforcement beyond current BFF behavior; unsupported scope/audit claims are documented in handoff notes.
