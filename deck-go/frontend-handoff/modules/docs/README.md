# Docs Handoff

Status: ready for production rewrite under `frontend-docs-hifi-contract-redesign`.

## Contract Truth

- Browser entry points:
  - `fetchDocs(params?)` -> `GET /api/docs`
  - `fetchDoc(docId)` -> `GET /api/docs/{docId}`
  - `extractDocs(sessionKey)` -> `POST /api/docs/extract`
  - `deleteDoc(docId)` -> `DELETE /api/docs/{docId}`
- Deck-facing DTO authority:
  - `DeckGoDocCategory`
  - `DeckGoDoc`
  - `DeckGoDocsResponse`
  - `DeckGoDocsExtractResponse`
- Backend chain:
  - Go route file: `deck-go/backend/internal/server/docs.go`
  - Storage: `localstore.GetDocStore()`
  - Extraction source: managed runtime `ChatHistory` followed by local document insertion
- Endpoint metadata:
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - category `deck-go-bff`
  - migration target `Keep fetchDeckJson`

## Product Frame

Docs is an inspect-and-extract document operations workbench. Operators can review documents extracted from chat history, inspect category/source/keyword evidence, navigate back to source session or agent, and delete local entries. It is not a document editor, shared knowledge base, semantic search engine, or production compliance archive.

## Workflow Constraints

- Keep all browser traffic behind the Go BFF. Do not call Gateway directly.
- Treat `/api/docs/extract` as local document extraction from chat history evidence, not as a real LLM completeness guarantee.
- Keep source session and source agent as evidence only; missing source values must render as unavailable.
- Keep destructive delete confirmation-gated.
- Keep raw payload disclosure available for contract/debug alignment.
- Label mock/local visual tests as mock/local evidence only.

## Implementation Notes

- First viewport should expose:
  - load state and document count
  - active session and extraction control
  - category counts and query filter
  - document inventory with selected row, category, source, keyword, and timestamp evidence
  - selected document metadata, source navigation, Markdown reader, and raw payload disclosure
- Filtering must use only `DeckGoDoc` fields: title, content, category, and keywords.
- Extraction result and delete result should be visible as raw last-action evidence.

## Open Questions

- Whether future Docs should add authoring/editing and version history.
- Whether source provenance should include richer Gateway run/message IDs.
- Whether search should graduate from simple text/category filtering to a typed backend search contract.
- Whether retention, ACL, export/import, and audit behavior should become separate governance capabilities.
