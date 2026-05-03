## Context

The current Docs panel already has a working Deck-facing API facade:
`fetchDocs`, `fetchDoc`, `extractDocs`, and `deleteDoc`. The contract authority is `deck-go/contracts/source/deck-api.contract.ts`, with endpoint classification in `deck-go/contracts/source/deck-endpoints.contract.json`. The Go BFF implements `/docs`, `/docs/{docId}`, `/docs/extract`, and `DELETE /docs/{docId}` against `localstore.GetDocStore()`; extraction reads chat history through the managed runtime and stores generated document entries locally.

This means Docs is not a direct Gateway RPC management surface. It is a Deck-local document registry and chat-history extraction workflow whose source evidence may originate from Gateway chat history. The redesign must preserve that boundary so visual polish does not imply unsupported knowledge-base, editor, ACL, or search semantics.

The old UI is globally styled through `deck-ui-docs*` and shared `deckgo-doc-*` selectors in `theme.css`, which makes module-level visual closure hard to verify as the rollout moves module by module.

## Goals / Non-Goals

**Goals:**

- Produce the full `frontend-handoff/modules/docs/` six-file package before production implementation is complete.
- Rework Docs into a high-density but readable document operations workbench aligned with the settled deck-go design system.
- Preserve the existing Go BFF API facade and panel registry boundaries.
- Use contract-shaped mock/local data through normal frontend/backend paths for visual verification.
- Move Docs-specific styling into module-local CSS and keep text wrapping/layout constraints stable.
- Record design-system readiness evidence without silently promoting local Docs molecules into canonical atoms.

**Non-Goals:**

- No document authoring/editor, collaborative editing, version history, vector search, export/import, ACL, retention policy, or semantic knowledge-base guarantee.
- No new backend API, DTO, or generated contract unless implementation reveals deterministic contract drift.
- No new dependency, router, state-management library, animation library, table library, or code editor.
- No real Gateway/LLM guarantee in mock visual evidence.

## Decisions

- **Keep Docs as a Deck BFF panel.** Browser code will continue to call `fetchDeckJson` wrappers for `/docs*`. Alternative: model Docs as direct Gateway RPC. Rejected because the current contract and backend implementation classify Docs as `deck-go-bff`, and direct Gateway schemas do not define this document registry.
- **Use backend filtering where available, plus local visible-list state for immediate UX.** The wrapper already supports category/query params, but the current panel fetches all documents and filters client-side. The redesign may keep client-side filtering for low-risk continuity or pass filters to `/docs` when doing so does not complicate tests; it MUST NOT invent fields beyond `DeckGoDoc`.
- **Seed visual extraction through mock chat history rather than a test-only docs API.** Mock/local E2E should create docs by calling `/api/docs/extract` against deterministic mock Gateway `chat.history` data. Alternative: add a dedicated seed endpoint. Rejected because it would widen backend behavior only for visual tests.
- **Keep Markdown rendering through `MarkdownText`.** Alternative: introduce a reader/editor component. Rejected because the existing static renderer is sufficient for inspect-only content and avoids new editor/security scope.
- **Use module-local CSS.** Docs-specific layout, chips, rows, source tiles, prose reader, and action evidence styling move into `docs-panel.css`. Shared atoms/tokens remain unchanged unless a clear repeated molecule requires a separate proposal.

## Risks / Trade-offs

- **[Risk] Mock extraction depends on chat-history fixture length and assistant role.** → Mitigation: add deterministic mock chat history with long assistant Markdown content that exercises categories and keywords.
- **[Risk] Docs looks like a full knowledge base.** → Mitigation: copy and handoff docs must label it as local registry/extraction evidence, not search/authoring/source-of-truth knowledge management.
- **[Risk] Long document IDs, source sessions, JSON, or Markdown code blocks overflow.** → Mitigation: constrain every row/tile/prose/payload region with `min-width: 0`, wrapping, truncation, and bounded scroll.
- **[Risk] Moving global styles breaks other panels using shared `deckgo-doc-*` selectors.** → Mitigation: update DocsPanel classes and only remove obsolete `deck-ui-docs*` styling; leave genuinely shared styles untouched unless no consumers remain.
- **[Risk] Delete/extract actions mutate local state during visual tests.** → Mitigation: use isolated E2E temp data directories and assert post-action evidence through normal UI rather than shared persistent state.

## Migration Plan

1. Create the Docs handoff package and record unsupported/uncertain behavior.
2. Refactor DocsPanel into local class names and CSS while preserving API calls and i18n keys.
3. Adjust mock Gateway chat-history fixture only if extraction visual coverage cannot be seeded through existing data.
4. Add focused unit and Playwright coverage for the redesigned panel.
5. Update cross-module readiness evidence.
6. Run OpenSpec validation, focused tests, visual E2E, frontend build, archive the change, and commit.
