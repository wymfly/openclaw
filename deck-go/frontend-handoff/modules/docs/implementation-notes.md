# Implementation notes — docs

> Per `frontend-handoff/CLAUDE.md` protocol enhancement #5 (后端契约协商). Records the contract reconciliation made during the v2 multi-file rebuild.

## Stack lock — markdown rendering

**Decision (current code truth):** production uses the existing `MarkdownText` / shared renderer path in `frontend-new/src/components/panels/chat/MarkdownText.tsx`.

Rationale:

- `frontend-new/package.json` does not declare `react-markdown`, `remark-gfm`, or `rehype-highlight`.
- The current OpenSpec change explicitly forbids adding new frontend dependencies without approval.
- The shared renderer already serves Chat and can render the Docs body without adding a new stack.

The prototype's in-house renderer in `icons.jsx` remains a visual stand-in. Production should not claim full GFM/syntax-highlighting fidelity until the dependency decision is made through a separate approved change.

The earlier handoff claim that production was locked to `react-markdown + remark-gfm + rehype-highlight` was corrected because it was not backed by the installed dependency set.

## Contract reconciliation — DTO shape

**Discovered:** v1 prototype design (and the original `prd.json` task description) modeled docs as a static documentation tree with topical categories (`concepts` / `runtime` / `contracts` / `howto`) and per-doc fields like `slug`, `bodyMd`, `summary`, `tags`. None of these match the actual `DeckGoDoc` contract in `contracts/source/deck-api.contract.ts:1459-1481`.

**Real shape (authoritative):**

- `id` (not `slug`)
- `content` (not `bodyMd`; no separate `summary` field)
- `keywords` (not `tags`)
- `category: DeckGoDocCategory` enum: `summary` | `plan` | `spec` | `manual` | `draft` (not topical groupings)
- `sourceSession`, `sourceAgent` (provenance — fundamental to the panel's purpose)
- `extractedAt`, `updatedAt`, `language`

**What this changed in framing:** the docs panel is for **runtime-extracted documentation** harvested from agent sessions, not a static doc site. The whole hero needs a provenance row (agent dot + session id chip), the topbar needs an "Extract from session" CTA, and the panel needs a Delete action (per V1 codex).

**Resolution applied:**

1. Rewrote `data.js` with 16 docs across the 5 actual `DeckGoDocCategory` values
2. Renamed every component-level identifier: `slug→id`, `bodyMd→content`, `tags→keywords`, `tagFilter→keywordFilter`, `onCopySlug→onCopyId`, `selectedSlug→selectedId`, `onSelectSlug→onSelectId`
3. Added `<DocViewer>` provenance row with `AGENTS` registry lookup (agent dot in agent's brand color + session id chip)
4. Added topbar `Extract from session` CTA + popover (idle → running → done flow), seeding extracted docs from the in-memory `ACTIVE_SESSION` stub
5. Added Delete button in `<DocViewer>` hero meta row with two-step confirm (Delete → "Confirm delete" / "Cancel")
6. Replaced "summary" derivation: derive a hero excerpt from `content`'s first non-heading paragraph when needed (hides if empty)
7. Search algorithm now scores `keywords` and `sourceSession` instead of `tags` and `summary`
8. Related-docs computation uses keyword overlap instead of tag overlap

**Implication for translation (`frontend-new/src/components/panels/docs/`):**

- Use `import type { DeckGoDoc, DeckGoDocCategory } from "@/types/deck-api"` directly — no remapping layer
- Wire `fetchDocs()` / `fetchDoc()` / `extractDocs()` / `deleteDoc()` from `frontend-new/src/api.ts`
- The `AGENTS` registry stub in `data.js` should be replaced with a real selector against the agents store (whatever store library wins per stack-decisions)
- The `ACTIVE_SESSION` stub should be replaced with a selector against the sessions store
- Scope-gating: the current panel has no exposed per-action operator scope signal. `Extract from session` is disabled when no active session exists; `Delete` is confirmation-gated. Future operator scopes can hide these actions when the BFF exposes the effective grants.

**No backend change needed.** The contract is correct; the prototype was misaligned and has been fixed in-place. The api-discrepancy.md path was unnecessary because there was no real divergence to negotiate — only a prototype catch-up.

## Outstanding open questions (carried into Reverse sign-off)

See `README.md#open-questions-for-implementation`. Notable items:

- Session picker for Extract (current prototype uses _the_ active session; production may need a picker)
- Soft delete vs. hard delete (V1 codex reads as hard delete)
- Inline editing of `content` (current scope = read-only)
- Frontmatter handling

## Notes on benign Babel-standalone diagnostics

The TS diagnostic `Could not find name 'IconClose'` (and similar) on `search-results.jsx` is the standard Babel-standalone cross-script-tag global resolution noise — these globals are exported via `Object.assign(window, ...)` in `icons.jsx` and resolved at runtime. They do not affect functional behavior of the prototype and are removed by the translation step (real `import` statements in `frontend-new`).

## Codex implementation closeout — 2026-05-04

### Contract chain matrix

| Workflow               | Frontend facade                                                                      | BFF / runtime truth                                                                                         | Capability classification                                           |
| ---------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| List docs              | `fetchDocs({ category?, query? })` in `frontend-new/src/api.ts`                      | `GET /api/docs`, localstore list, optional `category` and `q` filters                                       | supported                                                           |
| Detail                 | `fetchDoc(docId)`                                                                    | `GET /api/docs/{docId}`, localstore lookup, 404 when absent                                                 | supported / empty-valid 404                                         |
| Local search overlay   | `DocsPanel` scans `DeckGoDoc` title, content, keywords, source session, source agent | No server-side search endpoint required                                                                     | supported frontend-local                                            |
| Keyword filter         | `DocsPanel` filters `DeckGoDoc.keywords`                                             | Contract field only                                                                                         | supported frontend-local                                            |
| Extract                | `extractDocs(activeSessionKey)`                                                      | `POST /api/docs/extract`, managed runtime `chat.history`, long assistant-message extraction into localstore | environment-dependent; no extractable history is empty-valid        |
| Delete                 | `deleteDoc(docId)`                                                                   | `DELETE /api/docs/{docId}`, hard delete from localstore; wrapper now treats 404 as already gone             | supported with confirmation; real E2E uses safe non-existent delete |
| Markdown render        | `MarkdownText` shared renderer                                                       | `DeckGoDoc.content` Markdown string                                                                         | supported with bounded renderer fidelity                            |
| Related docs / outline | `DocsPanel` computes from `keywords` and `content` headings                          | Contract-backed fields only                                                                                 | supported frontend-local                                            |
| Source handoff         | `navigateToSession` / `navigateToAgent` buttons                                      | Source ids come from `DeckGoDoc.sourceSession/sourceAgent`                                                  | supported when ids exist                                            |
| BFF-only access        | Browser calls `/api/docs*` through deck-go                                           | No direct Gateway HTTP/WebSocket from Docs UI                                                               | supported; mock and real E2E verified                               |

### Fixes applied

- Refactored production `DocsPanel` into the v2 workbench: topbar search, extract popover, category tree, selected document hero, keyword filtering, related docs, outline rail, source actions, raw payload, and inline delete confirmation.
- Corrected Markdown dependency drift: no new Markdown/highlight dependency was added; production uses the installed shared renderer.
- Corrected delete drift: the frontend `deleteDoc` wrapper accepts current `200`, future `204`, and current `404 already gone` as safe outcomes.
- Updated focused tests and mock/real E2E to exercise the production facade rather than the prototype fixture directly.
- Corrected handoff API notes so the source of truth is `frontend-new/src/api.ts`, current BFF success shape, and current access-token-only scope behavior.

### Verification evidence

- Prototype smoke: `python3 -m http.server 4935` + Playwright open of `prototype.html`; title `docs — high-fidelity v2`; no browser console/page errors.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/docs/DocsPanel.test.tsx src/api.chat-helpers.test.ts` passed, 51 tests.
- Focused backend: `cd deck-go/backend && go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_DocsRoutes|TestMountAdminRoutes'` passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/docs-visual.spec.ts --config playwright.config.ts` passed.
- L2 real stack: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/docs-real-gateway.spec.ts --config playwright.config.ts` passed, 2 tests.
- Contract classification: `cd deck-go && make endpoint-classification-check` passed.
- Frontend build: `cd deck-go && make frontend-build` passed.
- OpenSpec: `openspec validate frontend-docs-real-contract-verification --strict` passed.

### Residual risks

- No session picker exists; extraction uses the globally active session key from the chat store.
- No per-action operator scope signal is exposed to the panel, so Extract/Delete cannot yet hide based on `operator.write` / `operator.admin`.
- Markdown fidelity remains bounded by the current shared renderer; full GFM and syntax highlighting require a separate dependency decision.
- Real extraction quality depends on actual Gateway chat history; the real E2E validates route shape and safe operation, not LLM document quality.
- Delete is currently hard delete in localstore; archive/soft-delete behavior is a future product decision.

## Contract-chain completion closeout — 2026-05-05

### Contract evidence update

- Added the Deck-facing `DeckGoDocDeleteResponse` DTO so Delete has a named product boundary instead of an ad hoc frontend object.
- Added action-level mutation evidence for `docs.extract` and `docs.delete`; both remain `skipped-safe` for real mutation fixtures until disposable extract/delete fixtures are proven.
- Routed `extractDocs()` and `deleteDoc()` through the shared mutation evidence helper. `deleteDoc()` now tolerates current `200`, future `204`, and current `404 already gone` outcomes while preserving route `docId` target evidence.
- Regenerated Deck API and mutation evidence artifacts from contract sources.

### Current truth

- Docs list/detail/local search/extract/delete are contract-known through Deck BFF routes and frontend facades.
- Server-side semantic search, session picker, soft delete/archive policy, inline editing, full GFM/highlight fidelity, and extraction-quality scoring remain out of scope for this completion.
- Code truth remains authoritative over this note; if source contracts or BFF routes change, update the contract source and regenerate artifacts first.

### Additional verification

- `cd deck-go && make deck-api-check mutation-evidence-contract-test mutation-evidence-contract-check` passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/docs/DocsPanel.test.tsx src/components/panels/memory/MemoryPanel.test.tsx` passed, 78 tests.
- `cd deck-go/backend && go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_DocsRoutes|TestGatewayFacade_MemoryRoutes|TestMountAdminRoutes|TestContractAdapters|TestMemory|TestDocs'` passed.

## Prototype parity remediation closeout - 2026-05-05

Code truth remains authoritative over these notes.

### Active visual target

- Active prototype: `frontend-handoff/modules/docs/prototype.html`.
- Reference-only prototype: `frontend-handoff/modules/docs/prototype-v1-codex.html`.
- Visual verdict: pass-with-exceptions, score 91, recorded in `.omx/state/docs-prototype-parity/ralph-progress.json`.

### Deterministic fixes and evidence

- Mock Gateway fixture now produces 12 extracted docs across the real `DeckGoDocCategory` values through `POST /api/docs/extract`, rather than relying on a sparse static reader state.
- `docs-visual.spec.ts` now enters from Chat -> Docs, captures the reader-ready state, no-match search, payload details, delete confirmation, extract popover, and zh/light reader evidence.
- `docs-real-gateway.spec.ts` now creates a run-scoped main session with `gpt-5.4`, waits for real chat history, extracts a run-scoped doc, verifies list/detail/extract route shapes, runs all four theme/locale combinations, clicks the source-session affordance, records unexpected errors, blocks direct Gateway browser transport, and cleans up only the run-scoped doc/session.
- Real evidence status was `passed`: one doc was extracted from `deckgo-e2e-mosp1vfa-w0-r0-docs-session`, then deleted with `DELETE /api/docs/{id}`; the run-scoped session was deleted through `sessions.delete`.

### Accepted exceptions

- The production screenshot includes Deck shell chrome while the prototype is standalone.
- Mock evidence has 12 extracted fixture docs instead of the prototype's 16 static docs.
- Timestamps, source session, and source agent fields are generated by the BFF/mock contract and therefore differ from prototype literals.
- Server-side search/indexing, inline editing, soft archive/bin, durable audit feed, internal markdown routing, and richer markdown rendering remain follow-up product/contract decisions.

### Verification evidence

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/docs/DocsPanel.test.tsx src/api.chat-helpers.test.ts` passed, 59 tests.
- `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
- `cd deck-go && pnpm exec playwright test test/e2e/docs-visual.spec.ts --config playwright.config.ts --output .local/docs-remediation-mock-visual --reporter=line` passed, 1 test.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/docs-real-gateway.spec.ts --config playwright.config.ts --output .local/docs-remediation-real-e2e --reporter=line` passed, 1 test.
- `cd deck-go && make frontend-build` passed with the existing Vite chunk-size warning.
