## 1. Contract And Baseline

- [x] 1.1 Record the current Docs contract chain from Deck-facing DTOs, Go BFF handlers, frontend API wrappers, endpoint metadata, localstore extraction behavior, and mock Gateway chat-history fixture coverage.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data for docs inventory, detail, extraction, delete confirmation, source navigation, Markdown rendering, categories, keywords, and empty/no-match states; fix only if found.
- [x] 1.3 Identify unsupported or uncertain authoring/editor, collaborative editing, version history, vector search, ACL, retention policy, import/export, provenance, and knowledge-base completeness semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/docs/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity document operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering document inventory, category/query filtering, selected detail, source navigation, Markdown reader, active-session extraction, delete confirmation, payload disclosure, empty/error/loading/no-match states, and mock/local visual states.

## 3. Production Docs UI

- [x] 3.1 Rewrite or restage `DocsPanel` around the handoff workspace while preserving load, selection, detail fetch, filters, source navigation, active-session extraction, delete confirmation/cancel, Markdown rendering, payload disclosure, action evidence, and i18n behavior.
- [x] 3.2 Restyle document metrics, category filters, inventory rows, selected detail, source evidence tiles, Markdown reader, action seams, payload seams, and empty/error states with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Docs global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Docs unit tests for load, selection, detail fetch, category/query filters, source navigation, extraction, delete confirmation/cancel, empty/no-match/error states, Markdown rendering, payload disclosure, and localization.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Docs mock/local visual coverage if existing mock Gateway setup is insufficient.
- [x] 4.2 Add a focused Docs mock/local visual E2E covering the ready workspace and at least one interaction state such as category/filter detail, extraction result, delete confirmation, or raw payload evidence.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Docs evidence, repeated document/reader/action molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-docs-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Docs unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
