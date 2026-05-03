## Why

Docs is the last non-chat Deck panel still sitting on the old dense `deck-ui-docs*` shell. It is contract-backed, but the contract is a Deck-local document registry and chat-history extraction surface rather than a direct Gateway RPC panel, so the high-fidelity rollout needs to make that boundary explicit before future frontend work treats docs as a knowledge-base product.

## What Changes

- Create a complete high-fidelity Docs handoff package under `deck-go/frontend-handoff/modules/docs/`.
- Redesign `deck-go/frontend-new/src/components/panels/docs/` into a compact document operations workbench:
  - document inventory rail with category counts, query/filter controls, source evidence, keywords, timestamps, selected state, empty/no-match/error states, and delete confirmation
  - selected document detail surface with category/language/source metadata, session/agent navigation, Markdown rendering, raw payload disclosure, and last action evidence
  - extraction action for the active chat session using the existing `/api/docs/extract` route with clear local/mock evidence labeling
- Preserve current API wrappers for `fetchDocs()`, `fetchDoc()`, `extractDocs()`, and `deleteDoc()`; browser code continues to call the Go BFF only.
- Confirm deterministic mock/local visual data for docs list/detail/extract/delete coverage; fix only deterministic mock/local drift needed for visual coverage.
- Move obsolete global `deck-ui-docs*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready document workspace, filtering/detail, extraction, delete confirmation, and raw payload evidence where feasible.
- Update cross-module readiness evidence with Docs-specific findings and document/Markdown/evidence molecule candidates.

## Capabilities

### New Capabilities

- `frontend-docs-hifi-redesign`: Covers the Docs handoff package, production UI rewrite, mock/local visual verification, and contract/drift findings for document inventory, category filtering, active-session extraction, selected document detail, source navigation, Markdown rendering, delete confirmation, action evidence, and raw payload disclosure.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Docs implementation evidence and classifies whether document inventory rows, category chips, Markdown reader surfaces, source evidence tiles, action result seams, and raw payload disclosures remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/docs/`
- `deck-go/frontend-new/src/components/panels/docs/`
- `deck-go/frontend-new/src/theme.css` Docs global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` deterministic chat history data if needed for docs extraction
- `deck-go/test/e2e/` focused Docs mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-docs-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
