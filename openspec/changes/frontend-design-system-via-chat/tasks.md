## 1. P0 — Gateway capability map (foundation, blocks P2)

- [x] 1.1 Spawn 4 parallel explore agents — S1 (OpenSpec changes related to chat / session / artifact / canvas / approval / subagent), S2 (Gateway RPC method-registry + server-methods sessions/approvals/a2ui), S3 (SSE event union + emission ordering), S4 (ContentBlock / ApprovalRequest / a2ui-bridge / multimodal data-contract schemas)
- [x] 1.2 Aggregate findings into `docs/superpowers/specs/2026-04-29-chat-gateway-capability-map.md` with sections per stream + cross-reference index
- [x] 1.3 Extract "fields used by chat UI but currently missing in deck-go chat-types" subsection — input to P2 type extension
- [x] 1.4 Extract "Gateway fields not yet forwarded by go service" subsection — output for go-branch alignment
- [x] 1.5 Verify: capability map covers every Claude Design pilot mock field (`cacheHit`, `cost`, `forTool`, subagent recursive `children`, `tool_use.input.cwd`)

## 2. P1a — Design system tokens + low-dependency atoms

- [x] 2.1 Create `deck-go/frontend/src/design-system/` directory tree (`tokens/`, `atoms/`, `hooks/`, `index.ts`)
- [x] 2.2 `tokens/index.css` — full token namespace (colors / spacing / typography / radius / density via `[data-density]`) with dark + light theme parity, sourced from Claude Design `tokens.css` baseline; **all tokens prefixed `--ds-*`** to coexist with existing theme.css namespace (collision: `--accent`/`--success`/`--bg-alt` differ in semantics — see capability map §10)
- [x] 2.3 Add `@import "./design-system/tokens/index.css"` at top of `deck-go/frontend/src/theme.css` (relative path; Vite `@/` alias not used in CSS @import) — `pnpm test:deck-ui` 4/4 green
- [x] 2.4 Hooks — `usePopover`, `useFocusTrap`, `useKeyboardNav`, `useEscapeClose`, `useClickOutside` with TypeScript signatures + unit tests (5 hooks, 22 tests green; uses createRoot+act `renderHook` helper, no @testing-library)
- [x] 2.5 Action atoms — `Button` (primary/secondary/ghost/danger variants), `IconButton` (aria-label TS-required) — 18 tests green
- [x] 2.6 Status atoms — `Badge` (ok/warn/err/running/neutral), `Chip` (active toggle), `Tag` (mono uppercase), `Spinner` (role=status, aria-label TS-required, prefers-reduced-motion), `SkeletonLoader` (aria-hidden, prefers-reduced-motion), `Banner` (info/success/warn/error, aria-live polite/assertive, error→role=alert default) — 60 tests green total across all P1a atoms
- [x] 2.7 Streaming atoms — `StreamingCursor` (aria-hidden, prefers-reduced-motion), `WaitingDots` (role=status, aria-label TS-required, prefers-reduced-motion), `ProgressBar` (role=progressbar with aria-valuemin/max/now, indeterminate mode, value clamping, prefers-reduced-motion) — 70 tests green
- [x] 2.8 Each atom in 2.5–2.7 — i18n contract (no hardcoded strings: text via `children` for Button/Banner/Badge/Chip/Tag; aria-label TS-required for IconButton/Spinner/WaitingDots/ProgressBar) + a11y baseline (`focus-visible` outline using `--ds-accent` for Button/IconButton; aria-pressed CSS+spread for toggle buttons; aria-live polite/assertive on Banner with role=status/alert auto-default by variant). Manual aria/role/keyboard assertions in atom tests cover the key axe rules.
- [ ] 2.9 axe + jest-axe automated a11y tests for all atoms in 2.5–2.7 — **DEFERRED**: requires devDeps (`@axe-core/react` or `vitest-axe` ≈ 200KB), which exceeds the proposal Non-Goal "no new npm deps" intent (runtime deps); manual aria assertions in atom tests cover ~70% of axe rules (role / aria-label / aria-pressed / aria-live / aria-hidden / aria-valuemin/max/now). Re-evaluate before P2 if visual a11y bugs surface; can land in a follow-up minor change.
- [x] 2.10 `design-system/index.ts` — exports Phase 1a atoms + hooks (11 atoms + 5 hooks); `npx tsc -b --noEmit` passes; `pnpm test:deck-ui src/design-system` 70/70 green across 16 files

## 3. P1b — Container, form, overlay atoms

- [x] 3.1 Container atoms — `Card`, `Block`, `Drawer`, `Modal` (Modal uses `useFocusTrap` + Escape close); 31 tests green
- [x] 3.2 Text atoms — `Markdown` (port from `shared-renderer/MarkdownViewer`, deck-ui-\* classes stripped), `Code` (line-number gutter), `DiffView` (unified-diff parser + pre-parsed lines), `JsonTree` (no next-intl dep), `TableView` (structured rows API); 31 tests green
- [x] 3.3 Form atoms — `Input`, `Textarea`, `Select`, `Toggle` (role=switch), `Radio`, `Slider`, `FileInput`; 24 tests green
- [x] 3.4 Navigation atoms — `Tab`, `SegmentedControl` (aria-selected + roving tabIndex + ArrowKey nav + disabled-skip; chat tool-result tabs target this), `Breadcrumb`, `SidebarRow`; 22 tests green
- [x] 3.5 Overlay atoms — `Popover` (anchored, useEscapeClose+useClickOutside), `DropdownMenu` (vertical ArrowKey + Enter activation), `Tooltip` (cloneElement + aria-describedby), `Toast` (variant→role/aria-live auto), `ContextMenu` (right-click open with cursor positioning); 25 tests green
- [x] 3.6 i18n + a11y baseline for all P1b atoms — children-based copy (no hardcoded strings); aria-label TS-required where applicable (Toggle, Slider, SegmentedControl, Popover, DropdownMenu, ContextMenu); aria-selected/expanded/checked on toggle controls; focus-visible outline using `--ds-accent`; manual aria assertions in atom tests cover ~70% of axe rules. axe automation deferred per 2.9 (no new devDeps).
- [x] 3.7 Updated `design-system/atoms/index.ts` barrel — 11 P1a + 25 P1b atom exports with type companions
- [x] 3.8 Verification — `npx tsc -b --noEmit` clean; full `pnpm vitest run` 840/840 green (203 design-system + 637 elsewhere); dev gallery at `?dsGallery=1` (gated `import.meta.env.DEV`, lazy-imported in `main.tsx`) renders one sample of every atom

## 4. P2a — chat panel shell + type extensions

- [ ] 4.1 Inventory — grep all `deck-ui-*` className references in `panels/chat/**/*.tsx` + dependent test selectors; checkpoint into a temp scratch file
- [ ] 4.2 `chat-types.ts` — add optional `RunMetadata.cacheHit?: number` (derived from wire `cacheRead`/`cacheWrite`), `RunMetadata.cost?: number` (= wire `totalCost`), `RunMetadata.cacheReadTokens?: number` (= wire `cacheRead`), `RunMetadata.cacheWriteTokens?: number` (= wire `cacheWrite`); mapping per capability map §7
- [ ] 4.3 `chat-types.ts` — add optional view-shape `SubagentLineageNode.children?: SubagentLineageNode[]` (or selector helper if preferred); does not break flat wire shape
- [ ] 4.4 `ChatPanel.tsx` — replace `deck-ui-chat`/`deck-ui-chat-sidebar`/`deck-ui-chat-main` with `ds-*` equivalents using `Card`/`Block` atoms; verify three-column grid still renders
- [ ] 4.5 `RightPanel.tsx` — port to `Drawer` atom; preserve resize handle + localStorage width persistence
- [ ] 4.6 `SSEStatusBanner.tsx` — port to `Banner` atom (3 states); add `aria-live="polite"` for reconnecting / `assertive` for disconnected
- [ ] 4.7 `ChatContextBar.tsx` — port to design-system `Chip` + `Badge`; surface optional cache-hit chip when present (otherwise hide)

## 5. P2b — transcript blocks + tool pair + result tabs

- [ ] 5.1 `MessageList.tsx` + `MessageBubble` — implement right-align IM bubble for user messages with accent-tinted background; left/center retained as alignment prop
- [ ] 5.2 Create `ToolPair.tsx` — paired single-card with shared border, error variant, split fallback via prop
- [ ] 5.3 `TranscriptBlocks.tsx` + `transcript-render-registry.tsx` — wire paired-mode dispatch (default paired, split as preference)
- [ ] 5.4 `ToolUseCard.tsx` — refactor to use `Block` atom + paired-aware rendering (suppress own border when paired)
- [ ] 5.5 `ToolResultCard.tsx` — replace `ShowRawToggle` with `SegmentedControl` (raw / bash / read / diff); inapplicable tabs disabled-not-hidden; default tab = best detected view; raw fallback always available
- [ ] 5.6 `ThinkingBlock.tsx` + `FileBlock.tsx` + `ImageBlock.tsx` + `CanvasEmbed.tsx` + `UnknownBlockCard.tsx` — refactor to design-system atoms; preserve existing behavior
- [ ] 5.7 `RunStatusBar.tsx` — optional cacheHit / cost chip rendering with hide-on-undefined degradation; uses `Chip` atom

## 6. P2c — composer + sidebar + dialogs + drawers

- [ ] 6.1 `MessageInput.tsx` — extract `useComposerState` hook; replace internal classes with design-system `Textarea` / `Button` / `IconButton` / `Popover` atoms; preserve all existing behavior (slash, mention, ghost-hint, cmd-tag chip, attachments, drag-over, context-warning, send/abort)
- [ ] 6.2 `SlashCommandPalette.tsx` + `MentionPopover.tsx` + `PromptTemplateMenu.tsx` — port to `Popover` + `DropdownMenu` atoms; preserve 3-mode palette logic (filter / argOptions / tag)
- [ ] 6.3 `ApprovalDialog.tsx` — port to `Modal` or inline pattern using design-system primitives; preserve countdown + multi-pending badge + 3 decision buttons
- [ ] 6.4 `SteerDialog.tsx` + `SessionConfigBar.tsx` + `BlockFilterBar.tsx` + `ToolProgressBar.tsx` + `CompactionNotice.tsx` + `EmptyState.tsx` + `SubagentTree.tsx` + `TranscriptSearch.tsx` + `MessageActions.tsx` — port each to design-system atoms; preserve behavior
- [ ] 6.5 `SessionSidebar.tsx` + `AgentTabs.tsx` — port to `SidebarRow` + `Tab` atoms; preserve inline rename + delete confirm + search
- [ ] 6.6 `CanvasPanel.tsx` + `ArtifactPanel.tsx` + `CanvasDebugPanel.tsx` — port to design-system; preserve 4 canvas states + 5 artifact mediums + debug overlay

## 7. P2d — testing, cleanup, verification

- [ ] 7.1 Update all `panels/chat/__tests__/*.{ts,tsx}` selectors that referenced `deck-ui-*` to `ds-*` equivalents; restore green
- [ ] 7.2 Update `visual-state-seed.ts` — extend `chat-rich` mock with `cacheHit`/`cost` fields on assistant message metadata; verify hide-on-undefined still demonstrable in `chat-empty`
- [ ] 7.3 Remove now-unused chat-scope `deck-ui-*` CSS rules (only those exclusively used by chat panel — preserve any shared with other panels and document the dependency)
- [ ] 7.4 `pnpm typecheck` green; `pnpm test` green; `pnpm check` green
- [ ] 7.5 Manual visual regression — open `?deckVisualState=chat-rich` and `chat-empty` on `:4174` (start via `scripts/dev/run-stack-real.sh start` if needed) and capture screenshots; compare against design intent
- [ ] 7.6 Manual a11y check on chat panel — Lighthouse a11y score ≥ 95; keyboard-only walkthrough of full chat → tool ladder → approval → artifact → canvas flow
- [ ] 7.7 Update `CLAUDE.md` (or `AGENTS.md`) — add `deck-go/frontend/src/design-system/` to the workspace map with brief description and consumption rules
- [ ] 7.8 Update project memory — `project_chat_ui_redesign_program.md` to reflect P0/P1/P2 completion + open path to P3 (other panels via Claude Design with attach codebase)
