# Implementation Notes

## Completed In This Ralph Iteration

- Added the parity ledger and scenario matrix in `openspec/changes/deck-go-ui-visual-sync/parity-ledger.md`.
- Generated the visual comparison scaffold at `.omx/artifacts/deck-go-ui-visual-sync/visual-comparison/`.
- Kept the API escalation gate empty; no `deck-go/frontend/src/api.ts` or backend files were changed.
- Kept the dependency checkpoint closed; no frontend dependencies were added.
- Replaced the narrow transcript markdown parser with a shared local renderer used by both transcript text and Artifact markdown.
- Restored visible markdown structures for blockquote, horizontal rule, table, image, emphasis, nested list content, fenced code, links, inline code, headings, and paragraphs.
- Added a direct streaming-to-final Markdown rerender test proving the streaming renderer produces the same final structure as static rendering.
- Restored `ToolResultCard` legacy `<details>` chrome, error default-open behavior, summary-row raw toggle placement, and per-card raw toggle state.
- Restored icon-forward Message avatars, streaming waiting row, Canvas loading spinner, Artifact card icon, and Artifact panel icon actions.
- Restored old Deck-style Composer send/abort mutual visibility; the abort test fixture now explicitly marks the session as streaming.
- Captured en/dark `deck-go` Chat visual-seed screenshots under `.omx/artifacts/deck-go-ui-visual-sync/screenshots/`.
- Filled the Chat rows in `.omx/artifacts/deck-go-ui-visual-sync/visual-comparison/screenshot-matrix.md` with paired old/current artifacts or explicit source-level exception notes, including explicit rows for Artifact panel actions, plain Composer, session sidebar, and tool progress/runtime controls.

## Verification

- `pnpm --dir deck-go/frontend test:deck-ui src/components/panels/chat/__tests__/block-filter-rendering.test.ts src/components/panels/chat/__tests__/message-input.mention-slash.test.tsx src/components/panels/chat/__tests__/message-input.attachments.test.tsx src/components/panels/chat/__tests__/canvas-panel.test.tsx src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
  - Result: 5 test files passed, 45 tests passed.
- `pnpm --dir deck-go/frontend test:deck-ui`
  - Result: 84 test files passed, 624 tests passed.
- `pnpm --dir deck-go/frontend build`
  - Result: build succeeded; Vite emitted the pre-existing chunk-size warning.
- `node scripts/deck-visual-comparison-scaffold.mjs --out .omx/artifacts/deck-go-ui-visual-sync/visual-comparison`
  - Result: scaffold generated 150 rows for 27 panels.
- Playwright browser capture against `http://127.0.0.1:5174/?deckVisualState=chat-rich` and `?deckVisualState=chat-empty`
  - Result: current Chat screenshots captured with deterministic local API mocks, en-US locale, dark theme, and no console/page errors in `.omx/artifacts/deck-go-ui-visual-sync/console-review.md`.
- `.omx/artifacts/deck-go-ui-visual-sync/visual-comparison/verdict-summary.md`
  - Result: Chat summary synchronized to 15 pass, 2 accepted exceptions, 0 needs-capture.
- `.omx/artifacts/deck-go-ui-visual-sync/visual-comparison/backend-gap-audit.md`
  - Result: Chat row records no backend gap for this visual-sync change.

## Exceptions / Residual Risk

- The Chat visual seed does not mount `SubagentTree`, and the old `ChatPanel` does not mount it directly either. The screenshot matrix records `chat-subagent-lineage-card` as a source-level exception instead of a false visual pass.
- The broader full-Deck scaffold contains non-Chat rows that remain `needs-capture`; those rows are explicitly out of scope for this Chat UI OpenSpec change.
