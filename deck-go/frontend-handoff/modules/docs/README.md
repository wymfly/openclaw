# Docs

**Status**: ready-for-implementation
**Design completed**: 2026-05-04
**Designer**: design agent (multi-file React rebuild — v2)
**Depends on atoms**: Button, Input, Tag, Code
**New atoms needed**: none (all local molecules — see components.md)
**New tokens needed**: none
**Backend endpoints used**: `GET /api/docs`, `GET /api/docs/{id}`, `POST /api/docs/extract`, `DELETE /api/docs/{id}` — see `api-usage.md`
**Stack decisions**: in-house markdown renderer in prototype; production locks **react-markdown + remark-gfm + rehype-highlight**

## What this module does

The Docs panel is the deck-go **runtime-extracted document reader**. It is _not_ a static documentation site. Operators use it to read, browse, and curate **operational documents harvested from agent sessions** — long assistant messages that the BFF extracts, classifies, and indexes for later reuse.

Each `DeckGoDoc` carries provenance:

- `sourceSession` — the session id this doc came from
- `sourceAgent` — the agent that produced it
- `category` — one of `summary` | `plan` | `spec` | `manual` | `draft`
- `keywords` — tagged terms for filtering and search
- `extractedAt` / `updatedAt` — provenance + freshness

The panel must answer five questions:

1. **What's been extracted?** — left pane categorical tree (Summaries / Plans / Specs / Manuals / Drafts)
2. **Where is X?** — global search bar with ⌘K shortcut and instant snippet results across title / keywords / content / session id
3. **Where did this come from?** — hero provenance row (agent dot + session id chip)
4. **What does this doc say?** — markdown viewer with hero (breadcrumb + title + provenance + meta + keyword chips) + body + on-this-page outline
5. **What's related?** — keyword-overlap related-docs grid + clickable keyword chips for filter-mode browsing

Layout is the **2-pane workspace** with a search overlay that drops below the topbar input, plus an "Extract from session" topbar CTA that opens a popover showing the active session and confirms a new doc extraction.

## Contract truth

- BFF endpoints (live):
  - `GET /api/docs` returns `DeckGoDocsResponse { docs?: DeckGoDoc[] }`
  - `GET /api/docs/{id}` returns a single `DeckGoDoc` (path param matches `DeckGoDoc.id`)
  - `POST /api/docs/extract` with `{ sessionKey: string }` returns `DeckGoDocsExtractResponse { extracted?: number, docs?: DeckGoDoc[] }`
  - `DELETE /api/docs/{id}` removes the doc from the local store
- DTO authority: `DeckGoDoc`, `DeckGoDocsResponse`, `DeckGoDocsExtractResponse`, `DeckGoDocCategory` (`deck-go/contracts/source/deck-api.contract.ts:1459-1481`)
- Body format: GitHub-flavored markdown (GFM) in `DeckGoDoc.content`
- Browser code calls the Go BFF wrappers only — never reach into the docs filesystem or the agent runtime directly

## How to implement

1. Open `prototype.html` (Babel-standalone). Hit ⌘K to focus search, type "webhook", click a result, scroll the body, click a keyword chip to filter the tree, click breadcrumb to return to top, click a related-doc card to navigate, click "Extract from session" to see the extract popover.
2. Read `components.md` — component tree, props contract, local molecules (TagChip, MarkdownView)
3. Read `states.md` — loading / ready / search-active / no-results / keyword-filter / extract-popover / delete-confirm state machines
4. Read `interactions.md` — keyboard (⌘K, Esc), search overlay lifecycle, keyword-filter coupling, breadcrumb scroll, related-docs picking, extract popover lifecycle, delete confirmation
5. Read `api-usage.md` — endpoints, list-vs-detail caching strategy, extract flow, drift gate
6. Hardcoded literal strings come straight out of the prototype; once translated, lift them into `frontend-new/src/i18n/{en,zh}.json` per the prototype-string convention

## Open questions for implementation

- **Extract policy** — should every operator be able to extract, or is it gated to a write/admin scope? Current backend allows the action without an extra gate; UI should make the destination clear ("doc will be added to the local registry").
- **Session picker** — prototype extracts from _the_ active session (single global active). Production likely needs a session picker (which session? what message range?) — defer to v2.
- **Doc-doc cross-references** — current renderer treats markdown links as external. Production may want internal-link detection (`/docs/<doc-id>` → in-app navigation, no full reload).
- **Deletion** — is delete soft (mark archived) or hard (drop from store)? V1 codex reads as hard delete; production should add an Archive bin if needed.
- **Search index source** — prototype scans `content` in-browser (cheap for ~16 docs). Production may have hundreds → switch to BFF-side `GET /api/docs/search?q=...` with a precomputed inverted index.
- **Code-block syntax highlighting** — prototype emits `<code class="md-codeblock--{lang}">` but doesn't actually highlight. Production locks rehype-highlight (Prism-like) for the production pipeline.
- **Edit on source** — `DeckGoDoc.content` is editable in the local store; should the panel offer inline editing (markdown textarea + save) or stay read-only? Current scope = read-only.
- **Frontmatter** — `DeckGoDoc.content` is plain markdown. If we want frontmatter (e.g., `version:`, `deprecated:`), the BFF strips it.
