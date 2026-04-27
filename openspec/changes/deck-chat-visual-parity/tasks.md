## 1. Authority Mapping

- [x] 1.1 Compare every old Chat non-test file in `dashboard/src/components/panels/chat` with the Vite target tree.
- [x] 1.2 Classify each old Chat file as direct-port, adapt-port, already-present, or intentionally-deferred.
- [x] 1.3 Record missing files explicitly: `SubagentCard.tsx`, `blocks/BashResultView.tsx`, `blocks/DiffPreview.tsx`, `blocks/HighlightedCodeView.tsx`, `blocks/ShowRawToggle.tsx`, and `shared-renderer/*`.
- [x] 1.4 Compare old Node+Next Chat service behavior with Go Chat backend/API behavior for session snapshots, transcript hydration, SSE events, tool-result payloads, approvals, subagent lineage, and canvas/A2UI data.
- [x] 1.5 Treat `deck-shell-i18n-parity` as the completed shell baseline; do not re-plan shell/nav/header/theme work unless a Chat-specific regression requires it.
- [x] 1.6 For any Architect/Critic/Verifier review, provide a bounded evidence packet: exact Chat files, old reference files, current diff, screenshot artifacts, backend gap notes, and explicit questions. Review agents must return `INSUFFICIENT_EVIDENCE` instead of expanding into broad worktree discovery.
- [x] 1.7 Create an adapter seam ledger for every `adapt-port` item, including old component assumptions, target Vite props/hooks/stores, accepted transformation, and proof that Vite store authority is not rewritten to mimic old Next.js internals.
- [x] 1.8 Create a per-surface interaction exception ledger linked to backend gap entries; do not accept materially different interactions under generic "equivalent" language.
- [x] 1.9 List required old-reference screenshot artifacts before UI edits, or record a per-state exception when an old-reference artifact cannot be produced.

## 2. Layout And Controls

- [x] 2.1 Restore old desktop Chat grid proportions for session sidebar, transcript, and right panel.
- [x] 2.2 Restore old AgentTabs, SessionSidebar, SessionConfigBar, ChatContextBar, RunStatusBar, and SSEStatusBanner visual details.
- [x] 2.3 Restore old MessageInput composer icons, attachment affordances, mention/slash overlays, and approval state treatment.
- [x] 2.4 Restore old MessageActions and transcript search/filter affordances.
- [x] 2.5 Verify Chat-local light/dark theme treatment for layout, controls, menus, dialogs, and status surfaces without reopening global shell theme work.
- [x] 2.6 Do not close layout/control work until every touched interaction difference is either old-equivalent or logged as a per-surface exception tied to the backend gap ledger and classified as `runtime-supported` or `Gateway-unsupported`.

## 3. Renderer Parity

- [x] 3.1 Port/adapt old shared renderer components: CodeViewer, JsonTree, MarkdownViewer, SharedRenderer, TableViewer, download, and srcdoc.
- [x] 3.2 Port/adapt old block views: BashResultView, DiffPreview, HighlightedCodeView, ShowRawToggle.
- [x] 3.3 Verify ToolResultCard chooses old specialized views before generic fallback.
- [x] 3.4 Verify nested tool results and unknown blocks preserve old visual hierarchy.

## 4. Right Panel And Runtime Interactions

- [x] 4.1 Compare old and current RightPanel, CanvasPanel, CanvasDebugPanel, ApprovalDialog, SteerDialog, and SubagentTree behavior.
- [x] 4.2 Restore missing SubagentCard/lineage visual affordances.
- [x] 4.3 Keep existing Go-backed stream recovery and session hydration behavior covered by tests.
- [x] 4.4 Fix or explicitly classify Go backend/API gaps discovered while restoring Chat interactions; do not replace missing backend data with static frontend placeholders.
- [x] 4.5 Do not close runtime/right-panel work until every touched surface is classified as runtime-supported or Gateway-unsupported in the backend gap ledger.

## 5. I18n

- [x] 5.1 Audit all Chat-local visible copy.
- [x] 5.2 Wire missing Chat copy to `deck-go/frontend/src/i18n/en.json` and `zh.json`.
- [x] 5.3 Validate EN/ZH switching on Chat screenshots.
- [x] 5.4 Validate Chat-local light/dark theme screenshots for the required deterministic states.

## 6. Validation

- [x] 6.1 Run Chat component tests and transcript renderer tests.
- [x] 6.2 Run deterministic Chat browser validation through the Codex Playwright MCP against foreground Go backend + managed Gateway + Vite preview. Do not use deprecated CLI smoke, shell-launched browser smoke, or CDP fallback as completion evidence.
- [x] 6.3 Capture old/current desktop screenshots for empty Chat, active transcript, tool result, approval, right panel, streaming/status, and subagent lineage states.
- [x] 6.4 Run live Chat send/stream E2E on Go backend plus managed Gateway when local model credentials/configuration are available. If unavailable, record it as a runtime credential/configuration gap, not as a substitute for renderer and interaction parity.
- [x] 6.5 Validate no mobile parity gate blocks this change; desktop Web production parity is the acceptance target.
- [x] 6.6 For every required screenshot state, attach an old-reference artifact or record a per-state exception before marking the state complete.
- [x] 6.7 Treat `.omx/plans/test-spec-deck-chat-visual-parity.md` Required Desktop Screenshot Matrix as the authoritative screenshot checklist, including empty Chat, active transcript, bash/diff/highlighted tool results, artifact panel states, approval, right panel/canvas, streaming/status, subagent lineage/card, transcript search/filter, slash command, mention popover, EN/ZH, and light/dark theme.

## Evidence

- Phase 0 ledger: `.omx/artifacts/deck-chat-visual-parity/phase0-ledger.md`
- Renderer tests: `pnpm test:deck-ui src/components/panels/chat/__tests__/block-filter-rendering.test.ts src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx src/components/panels/chat/__tests__/subagent-tree-lineage.test.tsx`
- Chat component tests: `pnpm test:deck-ui src/components/panels/chat/__tests__`
- Frontend build: `pnpm build` in `deck-go/frontend`
- I18n audit: `.omx/artifacts/deck-chat-visual-parity/i18n-audit.md`
- I18n/slash tests: `pnpm test:deck-ui src/components/panels/chat/__tests__/message-input.mention-slash.test.tsx src/components/panels/chat/__tests__/tool-progress-bar.test.tsx`
- Playwright MCP current rich EN: `deck-chat-visual-parity-current-rich-en-v6.png`
- Playwright MCP current rich ZH + slash palette: `deck-chat-visual-parity-slash-zh-v6.png`
- Playwright MCP console evidence: `deck-chat-visual-parity-current-rich-en-v6-console.md`, `deck-chat-visual-parity-slash-zh-v6-console.md`
- Playwright MCP current actions/search/filter EN: `deck-chat-visual-parity-actions-search-filter-en-v9.png`
- Playwright MCP actions/search/filter console evidence: `deck-chat-visual-parity-actions-search-filter-en-v9-console.md`
- Right panel/runtime audit: `.omx/artifacts/deck-chat-visual-parity/right-panel-runtime-audit.md`
- Right panel/runtime tests: `pnpm test:deck-ui src/components/panels/chat/__tests__/approval-dialog.test.tsx src/components/panels/chat/__tests__/canvas-panel.test.tsx src/components/panels/chat/__tests__/canvas-debug-tree.test.tsx src/components/panels/chat/__tests__/subagent-tree-lineage.test.tsx src/components/panels/chat/__tests__/chat-hardening.test.tsx src/components/panels/chat/__tests__/block-filter-rendering.test.ts`
- Stream recovery/session hydration tests: `pnpm test:deck-ui src/components/panels/chat/__tests__/useChatSSE-visibility.test.tsx src/components/panels/chat/__tests__/projection-gap.test.ts src/components/panels/chat/__tests__/chat-panel.active-entry.test.tsx`
- Layout/control Playwright MCP evidence: `deck-chat-visual-parity-layout-controls-en-v11.png`, `deck-chat-visual-parity-layout-controls-en-v11-console.md`
- Backend-origin rich Chat evidence: `deck-chat-visual-parity-backend-origin-rich-en-v15.png`, `deck-chat-visual-parity-backend-origin-rich-en-v15-console.md`
- Empty Chat evidence: `deck-chat-visual-parity-empty-en-v17.png`, `deck-chat-visual-parity-empty-en-v17-console.md`
- Light/dark theme evidence: `deck-chat-visual-parity-light-chat-v13.png`, `deck-chat-visual-parity-backend-rich-dark-v18.png`, `deck-chat-visual-parity-backend-rich-dark-v18-console.md`
- Mention popover evidence: `deck-chat-visual-parity-mention-open-v19.png`, `deck-chat-visual-parity-mention-open-v19-console.md`
- Screenshot matrix and old-reference exceptions: `.omx/artifacts/deck-chat-visual-parity/screenshot-matrix.md`
- Live send E2E evidence: `deck-chat-visual-parity-live-send-v16-result.json`, `deck-chat-visual-parity-live-send-v16-ui.png`, `deck-chat-visual-parity-live-send-v16-ui-console-after.md`
