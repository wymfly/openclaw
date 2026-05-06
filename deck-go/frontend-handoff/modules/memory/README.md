# Memory

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Design completed**: 2026-05-04
**Designer**: design agent (multi-file React rebuild — v2)
**Depends on atoms**: Button, Input, Tag, Code, Badge
**New atoms needed**: none (all local molecules — see components.md)
**New tokens needed**: none
**Backend endpoints used**: `GET /api/memory/browse`, `POST /api/memory/search`, compatibility `GET /api/memory/search`, `GET /api/memory/health`, `POST /api/memory/dreams` — see `api-usage.md`
**Stack decisions**: in-house markdown renderer in the prototype; production uses the existing dependency-free design-system Markdown atom unless a future proposal approves a markdown dependency; LanceDB embedding-backed semantic search remains degraded until the backend extension exists

## What this module does

The Memory panel is the deck-go **memory store control plane**. It lets operators inspect, search, diagnose, and maintain the embedding-backed memory used by every agent.

The panel must answer four questions:

1. **What's in memory?** — Browse tab: file-system tree (`global/`, `agents/<id>/`, `session-corpus/`) + content viewer
2. **Where is X?** — Search tab: semantic search over the entire memory store with relevance + tier + scope + decay metadata
3. **Is the embedding pipeline healthy?** — Health tab: per-agent embedding-provider status (ok / error / unknown) + LanceDB enabled flag
4. **Can I run a maintenance cycle?** — Dreams tab: per-agent dream-diary viewer + 6 maintenance actions (`read` / `backfill` / `dedupe` / `repair` / `resetShortTerm` / `reset`)

Layout is a **single-page tabbed workspace** (4 tabs at the topbar), with the Browse tab using a 2-pane (tree + viewer) and the Dreams tab using a 2-pane (agent picker + diary content).

## Contract truth

- BFF endpoints (live):
  - `GET /api/memory/browse?agentId={agentId}&path={path}` returns `DeckGoMemoryBrowseResponse { files?, content?, path? }` — set `path=` to a directory to list entries; use `read=1` for file content reads
  - `POST /api/memory/search` with `{ query, scope?, agentId? }` returns `DeckGoMemorySearchResponse { results?, unavailableReason?, lanceDbEnabled? }`
  - `GET /api/memory/search?q={query}&scope={scope}&agentId={agentId}` is a compatibility alias for old callers
  - `GET /api/memory/health` returns `DeckGoMemoryHealthResponse { entries?, lanceDbEnabled?, ... }`
  - `POST /api/memory/dreams` with `{ agentId, action }` (action: `DeckGoMemoryDreamAction`) returns `DeckGoMemoryDreamsResult` (a discriminated union of diary-result and action-result)
- DTO authority: `DeckGoMemoryFileNode`, `DeckGoMemoryHealthEntry`, `DeckGoMemoryBrowseResponse`, `DeckGoMemoryHealthResponse`, `DeckGoMemorySearchScope`, `DeckGoMemorySearchResult`, `DeckGoMemorySearchResponse`, `DeckGoMemoryDreamAction`, `DeckGoMemoryDreamDiaryResult`, `DeckGoMemoryDreamActionResult`, `DeckGoMemoryDreamsResult` (`deck-go/contracts/source/deck-api.contract.ts:1623-1705`)
- Body format: GitHub-flavored markdown (GFM) for memory file content
- Browser code calls the Go BFF wrappers only — never reach into LanceDB or the memory filesystem directly
- Code truth caveat: current OpenClaw Gateway `doctor.memory.*` methods resolve the default configured agent and do not accept an `agentId` parameter. deck-go sends `agentId` through the BFF for UI/contract stability, but per-agent dream execution remains a Gateway capability gap.
- Code truth caveat: semantic search currently returns a normalized 501/degraded response until a LanceDB-backed deck-go search adapter is implemented.

## How to implement

1. Open `prototype.html` (Babel-standalone). Click each of the 4 tabs (Browse / Search / Health / Dreams). In Browse, expand `agents/main/` and click `core.md` — read the markdown. In Search, type "runtime mode" or "test strategy" and watch the relevance bars. In Health, note the spec-writer error row. In Dreams, pick `main`, then click `Read` for a no-op confirmation, click `Reset all` to see the dangerous-action confirm.
2. Read `components.md` — component tree, props contract, local molecules (TierBadge, ScopeBadge, RelevanceBar, DecayBar, AgentDot, MarkdownView)
3. Read `states.md` — initial-load / ready / search lifecycle / dreams action lifecycle / per-tab state machines
4. Read `interactions.md` — keyboard, hover/focus, animations, tab navigation, file-tree expand, scope toggle, dream-action confirms
5. Read `api-usage.md` — endpoints, payload shapes, scope, drift gate
6. Hardcoded literal strings come straight out of the prototype; once translated, lift them into `frontend-new/src/i18n/{en,zh}.json` per the prototype-string convention

## Open questions after implementation

- **File tree depth lazy load** — prototype loads all directory entries up-front. Production should fetch on directory expand (`GET /api/memory/browse?path=/agents/main`).
- **Search history** — should recently-run queries persist? Local + per-operator? Defer to v2.
- **Search highlighting** — prototype emits the snippet verbatim from the BFF; should we client-side highlight query terms inside the snippet? This remains dependency-gated because production intentionally avoided adding `react-markdown`.
- **Dream action progress** — `reset`/`backfill` can take >5s. Production should stream progress via SSE or polled status; prototype mocks 600ms.
- **Audit trail** — destructive dream actions (`reset`/`resetShortTerm`) should appear in the Activity feed. Confirm with backend team.
- **Direct edit** — current scope is read-only on file content. Editing memory files in the panel raises questions (markdown editor? frontmatter validator? scope gating?) — defer to v2.
- **LanceDB toggle** — when `lanceDbEnabled=false`, search falls back to keyword-only. UI surfaces this; should there be a "force keyword mode" toggle for testing? Defer.
- **Dreams diary write-back** — currently the diary is read-only in the UI; should operators add notes? Out of scope.

## Reverse sign-off

| Field                          | Value                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `needs-revision`                                                                                                              |
| Reviewer                       | Codex                                                                                                                         |
| Date                           | 2026-05-06                                                                                                                    |
| Prototype reference            | `frontend-handoff/modules/memory/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/memory/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`memory`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`memory`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`memory`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/memory/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.
