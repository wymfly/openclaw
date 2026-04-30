## 1. Verification setup

- [x] 1.1 Real-stack confirmed running at session start (port 4174 preview, 19566 backend, 18789 Gateway); production preview rebuilt with `VITE_DECK_VISUAL_STATE=1` for chat-rich seed verification during 9.11.
- [x] 1.2 Bundle JSX SHA-256 hashes captured + recorded in `docs/design-bundles/2026-04-29-claude-design-chat-pilot/chat-parity-gap-report.md` header (composer.jsx `a7ca9b63...`, right-panel.jsx `9be33537...`, transcript.jsx `9a8ee027...`, blocks.jsx `45477e5e...`, app.jsx `64cf6032...`). Audit timestamp 2026-04-30.
- [x] 1.3 Prior change `frontend-design-system-via-chat` confirmed archive-ready: all `[ ]` tasks closed (2.9 + 7.6 marked done with deferred-to-follow-up notes; 9.10/9.11/9.12/9.13 all `[x]`). §10 closeout recorded user-flagged visual gaps as input to this follow-up.

## 2. Cross-module readiness audit (Goal A)

- [x] 2.1 Inventory atoms: 36 atoms confirmed from `deck-go/frontend/src/design-system/atoms/index.ts` — P1a (11): Button/IconButton + Badge/Chip/Tag/Spinner/SkeletonLoader/Banner + StreamingCursor/WaitingDots/ProgressBar; P1b (25): Card/Block/Drawer/Modal + Markdown/Code/DiffView/JsonTree/TableView + Input/Textarea/Select/Toggle/Radio/Slider/FileInput + Tab/SegmentedControl/Breadcrumb/SidebarRow + Popover/DropdownMenu/Tooltip/Toast/ContextMenu. Block atom already exists (referenced in §10).
- [x] 2.2 Panels inventoried — 5 rows: Settings (64 lines, 21 deck-ui-settings-_ + 17 shared shell), Models (145 lines, 60+ deck-ui-models-_ + 25 shared shell), Channels (87 lines, 27 deck-ui-channels-_ + 32 shared shell), Sessions (80 lines, 27 deck-ui-sessions-_ + 24 shared shell), Logs (41 lines, 22 deck-ui-logs-\* + 21 shared shell). Shared shell footprint dominated by `deckgo-card` (58 refs) + `deckgo-selectable-card` (86 refs) + `deckgo-shell-list` (12 refs).
- [x] 2.3 Per-cell classification done across 8 atom-tier sub-matrices. Tier-by-tier counts: Action 100% applies; Status mostly applies (Banner extend×3); Streaming mostly n/a (ProgressBar extend×2 for usage-bar); Container needs Card-extend×5 + Modal-extend×1; Text needs DataTable (missing) + Code-extend×2; Form needs Textarea-extend×2 + Input-extend×1; Nav mostly applies (TreeView missing for Models); Overlay 100% applies. Each cell carries a 1-line note in the matrix.
- [x] 2.4 Worklist aggregated at top: 8 missing atoms (DataTable L, TreeView M, KpiCard S, SparklineChart M, HeroStrip S, EmptyState S, PaginationBar S, KeyValueList S) + 8 atoms needing additive variants (Card hero/selectable/kpi, Banner success, Code copyable+language, Textarea monospace+readonly, Modal lg, Input token-mask, Tab/SegmentedControl validations). Each entry has scope + effort + justification.
- [x] 2.5 `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` written (218 lines, 15K). Includes: header + status legend + 5-panel inventory + worklist + 8 atom-tier matrices + 5 per-panel notes + no-atom-re-architecture guarantee + completed-migrations appendix + maintenance rules. Spec requirements (`design-system-cross-module-readiness`) satisfied: panel migration gate, additive-only atom changes, matrix maintenance triggers all documented.

## 3. Chat parity audit (Goal B — audit phase)

- [x] 3.1 `composer.jsx` (357 LOC) audited — composer surface section in gap report. Findings: 11 real ports + 5 partials + 1 documented divergence. Major: bundle's 4-stack frame (warning / attach-bar / composer-field / composer-toolbar) vs deck-go's 7 flat siblings; cmd-tag 3-element structure (icon + mono + close button); composer-attach + composer-icon-btn move INSIDE composer-field; missing composer-toolbar wrapper with grow + char-count hint; missing drag-over modifier.
- [x] 3.2 `right-panel.jsx` (293 LOC) audited — right-panel section in gap report. Findings: 13 real ports + 6 partials + 5 skips. Major: canvas header missing icon + rp-sub subtitle + Refresh button; cp-iframe-bar status strip missing (cp-card mock content correctly classified `skip` since deck-go has real iframe); ArtifactPanel **missing entire ap-tabs 5-tab format-switcher** (raised as product decision); ap-html-stub HTML rendering missing (currently raw escaped pre); ap-code line-number gutter missing.
- [x] 3.3 `transcript.jsx` (361 LOC) audited — transcript section in gap report. Findings: 4 real ports + 9 partials + 3 documented divergences. Major: ChatContextBar 5-cell-row vs deck-go's 2-bar split (raised as product decision); BlockFilterBar missing `bfb-label` "show" eyebrow; MessageBubble msg-meta-line missing role label + streaming-dot; CompactionNotice missing "view summary" affordance.
- [x] 3.4 `blocks.jsx` (371 LOC) audited — blocks section in gap report. Findings: 1 confirmed port + 19 partial-verifies + 2 skips. Major: bundle uses `.block` shared chrome cascade across all block types vs deck-go's per-block atomized roots (raised as product decision); CanvasInline missing "Open in panel" affordance; many partial items in ToolUseCard (param-grid, badge slots), ToolResultCard (block-head static, ShowRawToggle), ThinkingBlock (cursor-blink, streaming-dot) need DOM-inspect verification.
- [x] 3.5 `app.jsx` (712 LOC) + `sidebar.jsx` (149 LOC) audited — app shell section in gap report. Findings: 0 confirmed ports + 17 partial-verifies + 2 skips. Major: sidebar collapsed-mode layout swap (icon-only + agent-stack + session-mini pills) needs verification (raised as product decision); most shell items already aligned via P2a 4.4 + P3 9.6 but need confirmation; TweaksPanel + StateMatrixView correctly classified `skip` as design-time tooling.
- [x] 3.6 `chat-parity-gap-report.md` aggregated with bundle-hash-locked header + 5 surface sections + cross-surface summary. Total real port items: ~22; partial-verify items: ~56; documented skips: ~13. Verdict on prior §10.2 hypothesis: **~33% coverage** (audit surfaced ~30 unanticipated gaps).
- [ ] 3.7 For every `port` entry in the gap report, capture deck-go-vs-bundle screenshot pair (Playwright at 1440×900 against `?deckVisualState=chat-rich`). **Pending**: defer until §3.8 product decisions resolve (so we screenshot post-decision state).
- [x] 3.8 **5 product decisions resolved** (2026-04-30, user verdict: all in scope, openclaw supports each):
  1. **ChatContextBar 5-cell collapse** → **DO**. Collapse SessionConfigBar into ChatContextBar's row. All 5 metrics (model / context / compactions / reasoning / send + fast chip + ⌘F search) sourceable from existing `SessionMeta` / `useSessionA2UI` / Gateway state. See §5.
  2. **ArtifactPanel ap-tabs 5-tab format switcher** → **DO**. SharedRenderer accepts a `forceLanguage` override; tabs flip between Code/Markdown/JSON/Table/HTML re-renders of the same artifact content. See §7.
  3. **CompactionNotice "view summary" button** → **DO**. openclaw exposes `sessions.compaction.list` RPC (verified at `deck-go/backend/internal/runtime/openclaw/session_commands.go:91`) which returns compaction history with summary text. Build summary modal. See §8.
  4. **`.ds-block` shared base atom** → **DO**. Add additive shared chrome (border + radius + `--ds-bg-elev`) consumed by ToolUse / ToolResult / Thinking / File / CanvasInline / Unknown roots. Backwards-compatible. See §10.
  5. **Sidebar collapsed mode** → **DO**. Implement bundle's icon-only layout swap (agent-stack + rule + session-mini pills, max 8) per `sidebar.jsx` lines 12-42. See §9.

## 4. Composer remediation (3 commits — covers 11 ports + 5 partials from §3.1)

### 4a. Composer structural restructure (commit 1)

- [x] 4.1 `MessageInput.tsx` restructured into 5 vertical stacks (column flex on `.ds-message-input`): approval / ctx-warn / FileAttachmentBar / composer-field (row) / composer-toolbar (row). Added `ds-message-input__toolbar` wrapper holding canvas chip + artifact chip + char-count hint + send/abort. Template menu moved INSIDE `__field` (right edge).
- [x] 4.2 Inside `ds-message-input__field`: paperclip attach IconButton at left → `ds-message-input__ta-wrap` (column for ghost overlay + cmd-tag chip + Textarea) → PromptTemplateMenu at right. Slash palette + mention popover remain inside field as positioned overlays. Matches bundle `composer-attach` + `ta-wrap` + `composer-icon-btn` row.
- [x] 4.3 Added `useState` for `dragOver` + `--drag-over` modifier class. Border switches to `--ds-accent-dim` and bg to `--ds-accent-bg` on dragenter/dragover; resets on dragleave (only when leaving the frame itself, not bubbled from children) and drop. Drop also calls existing `addFiles`.
- [x] 4.4 New `ds-message-input__hint` span in toolbar (`{input.length} ch · ⌘↵ {send}`), mono via `--ds-font-mono`, `--ds-fs-meta` size, `margin-left: auto` so the send/abort button is pushed to the toolbar's right edge. Hidden on `max-width: 720px`.
- [x] 4.5 Gauntlet green: `pnpm tsc --noEmit` clean, `pnpm vitest run` 840/840 pass (125 files). Ready to commit "deck-go: chat-parity 4a — composer 4-stack restructure + drag-over + char-count".

### 4b. cmd-tag + ghost-rest + ctx-warn polish (commit 2)

- [x] 4.6 cmd-tag refactored from `<button>` to `<span>` chip with 3 children: leading `SlashIcon` (10px) + `__tag-name` mono command name + trailing `IconButton` close with `XIcon`. Outer span is non-interactive; only the close IconButton calls `slash.clearTag()`. Mirrors bundle `composer.jsx` 138-146.
- [x] 4.7 Ghost split into 2 spans: `__ghost-prefix` (`/{slash.slashFilter} `, color `--ds-text-2` for the matching prefix) + `__ghost-rest` (`{slash.ghostHint}`, color `--ds-text-4` + opacity 0.6 for the args/completion remainder). Switched ghost to `--ds-font-mono` per bundle `.ghost-hint.mono`.
- [x] 4.8 ctx-warn now renders `ZapIcon` (11px, `--ds-warn` colored) + `__warning-text` mono span. Bundle `.ctx-warn` Zap+small-mono pattern reproduced.
- [x] 4.9 Added `SlashIcon` to `deck-go/frontend/src/deck-ui/icons.tsx` (Lucide-style 22→2,2→22 single 45° line). Gauntlet green: tsc clean + vitest 840/840 pass. Ready to commit "deck-go: chat-parity 4b — cmd-tag 3-element + ghost-rest split + ctx-warn zap".

### 4c. Composer popover affordances + active state (commit 3)

- [x] 4.10 Active state via composer-scoped CSS rule (no atom change): `.ds-message-input__action[aria-pressed="true"]` and `.ds-template-menu > button[aria-expanded="true"]` get `--ds-accent-bg` + `--ds-accent` + `--ds-accent-dim`. Canvas/artifact toggles already wired aria-pressed; PromptTemplateMenu's Button atom already wires aria-expanded. Attach button skipped (no toggle semantics; remains a one-shot trigger).
- [x] 4.11 SlashCommandPalette renders `__mode-tag` chip per command using `resolveSelectMode(command)` (returns "tag" / "argOptions" / "immediate"; deck's "remote" execMode resolves to "tag"). Inline mono-small chip inside `__primary`, after name+args. Selected option's mode-tag picks up `--ds-accent` color.
- [x] 4.12 Selected SlashPalette option renders `__kbd ↵` chip in the 3rd grid column (right edge). Skipped MentionPopover since it has no selectedIndex tracking in current implementation; adding kbd there requires a wider refactor (out of scope for §4c — deferred to follow-up).
- [x] 4.13 FileAttachmentBar accepts new `onAdd` + `addLabel` props; renders trail "+ add" `__add` ghost button when `onAdd` provided. MessageInput wires it to `fileInputRef.current?.click()`. New i18n keys `attachAdd` (en: "add", zh: "添加") + `cmdModeTagTitle` (en: "Command interaction mode", zh: "命令交互模式").
- [x] 4.14 Gauntlet green: tsc clean (only pre-existing `MutableRefObject` deprecation warnings) + vitest 840/840 pass. Ready to commit "deck-go: chat-parity 4c — composer active state + popover mode-tag + kbd + attach-bar add".

## 5. ChatContextBar 5-cell collapse (Decision 1, 1 commit)

- [x] 5.1 ChatContextBar fully rewritten with bundle's 5-cell layout (Model / Context bar+% / Compactions count / Reasoning / Send) + a 6th Usage cell (deck-specific extension since `responseUsage` toggle has no bundle equivalent). Each cell uses `__key` label + `__val` mono value via `--ds-font-mono`. Reasoning + Send + Usage cells become `__cell--button` modifiers and call patchSession via the cycle/toggle handlers moved from SessionConfigBar.
- [x] 5.2 Inline fast chip rendered as `__chip--warn` (active state with `--ds-warn-bg` background + ZapIcon) when `meta.fastMode === true`, or `__chip--ghost` otherwise so the affordance stays clickable to enable fast mode. Both states fire `handleToggleFast` → `patchSession({ fastMode })`.
- [x] 5.3 New `__search-btn` ghost button at end of bar (after `__grow` spacer + optional compact action) with SearchIcon + `__kbd ⌘F` chip. ChatContextBar accepts new `onToggleSearch` prop wired in ChatPanel to `setShowSearch(c => !c)`, mirroring the existing TranscriptSearch overlay state.
- [x] 5.4 `SessionConfigBar.tsx` deleted; `<SessionConfigBar />` render site removed from `ChatPanel.tsx`; `.ds-session-config*` rules deleted from `chat-widgets.css` (kept `.ds-steer-dialog__button` shared rule). All four behaviors (cycle thinking / toggle fast / cycle usage / toggle send-policy) preserved as ChatContextBar cell handlers wired to the same `useChatStore.setState` + `patchSession` flow.
- [x] 5.5 i18n: added `configCompactions` (en: "Compactions", zh: "压缩次数"). All other config\* keys reused from existing `chat` namespace (no consolidation needed). Tests rewritten — `session-config-bar.test.ts` deleted, replaced by `chat-context-bar.test.ts` (5 cases incl. new search-button toggle). `chat-panel.active-entry.test.tsx` updated: dropped "Context window nearly full" assertion (only renders at composer ctx-warn pct ≥ 95) and "Compacted N times" assertion (collapsed into `Compactions` cell). Gauntlet green: tsc clean, vitest 841/841 (+1 new test). Ready to commit "deck-go: chat-parity 5 — collapse SessionConfigBar into 5-cell ChatContextBar".

## 6. Canvas panel remediation (2 commits — covers 6 ports + 6 partials from §3.2)

### 6a. Canvas header + overlay polish (commit 1)

- [x] 6.1 Canvas header now has `MonitorDotIcon` (the canvas glyph) + `__title-stack` (column flex) holding `__title` (font-weight 600) + `__sub` mono-small subtitle reading `a2ui-bridge · ${bridgeStatusLabel}`. Subtitle pulls live bridge state from `useSessionA2UI()` (`bridgeStatus: "ready" | "connecting" | "error"`), with `disconnected` fallback when no a2uiState yet. `data-bridge` attribute drives color (success/warn/error/text-3 tones).
- [x] 6.2 New Refresh IconButton between Bug toggle and X close, wired to existing `handleRetry`. Replaces previous reliance on the error-overlay-only retry button — user can now refresh canvas anytime.
- [x] 6.3 Canvas overlays restyled: error uses `XIcon` (large 28px) + mono "Bridge handshake failed" + retry ghost-button; empty uses `MonitorDotIcon` (28px) + mono "No canvas yet" + mono-small `__overlay-hint` waiting subtext. Loading retains the spinner but now uses `__overlay-text` mono class for text consistency.
- [x] 6.4 New i18n keys: `canvasEmptyHint`, `canvasErrorMessage`, `canvasBridgeReady`, `canvasBridgeConnecting`, `canvasBridgeError`, `canvasBridgeDisconnected`, `canvasRefresh` (en + zh both). Gauntlet: tsc clean + vitest 841/841 pass. Ready to commit "deck-go: chat-parity 6a — canvas header sub + Refresh button + overlay icons".

### 6b. cp-iframe-bar status strip (commit 2)

- [x] 6.5 New `ds-canvas-panel__iframe-bar` mono-small status strip rendered ABOVE the iframe with three pills separated by `__iframe-bar-sep`: `a2ui:tree`, `${surfaces.length} surface(s)`, and `${bridgeStatusLabel}`. `data-bridge` attribute drives color (text-2 for ready, warn for connecting, error for error, text-3 default), surfacing connection health without opening the debug panel.
- [x] 6.6 Iframe + status bar wrapped in `__iframe-mock` shell (column flex) per bundle's `cp-iframe-mock` pattern. `cp-card`/`cp-row`/`cp-actions` mock content correctly skipped — deck-go runs the real A2UI iframe, divergence documented in `chat-parity-gap-report.md`.
- [x] 6.7 Gauntlet green: tsc clean + vitest 841/841 pass. Ready to commit "deck-go: chat-parity 6b — canvas iframe-bar status strip".

## 7. Artifact panel remediation (Decision 2, 2 commits — covers 7 ports + 1 partial from §3.2)

### 7a. Artifact header + ap-tabs format switcher (commit 1)

- [ ] 7.1 Add Artifact icon at start of `ds-artifact-panel__head` + restructure title to bundle pattern: `__title` (filename / artifact title) + `__sub` mono small subtitle showing `<lang> · <N lines>` (compute lines via `artifact.content.split("\n").length`). Mirrors bundle `right-panel.jsx` 124-128.
- [ ] 7.2 Add `ds-artifact-panel__tabs` 5-tab strip below head per bundle 142-158 — Code/Markdown/JSON/Table/HTML buttons. Use Tab atom or `ap-tab` styling with `--ds-accent` border-bottom on active.
- [ ] 7.3 Add `forceLanguage` override prop to `SharedRenderer`: tabs flip the prop, SharedRenderer routes to the matching renderer regardless of `artifact.language`. JSON/Table tabs gracefully degrade with error state if content unparseable.
- [ ] 7.4 tsc + vitest gauntlet; commit "deck-go: chat-parity 7a — artifact icon+sub + 5-tab format switcher".

### 7b. ap-html-stub + ap-code line numbers (commit 2)

- [ ] 7.5 Add `ApHtmlStub` renderer for HTML artifacts: srcdoc iframe with sandbox=allow-scripts inside `ds-artifact-body__html-stub` wrapper + mono-small bar above ("srcdoc iframe (sandbox=allow-scripts)") per bundle 276-289. Replace current behavior of escaped pre.
- [ ] 7.6 Replace `ds-artifact-body__code` plain pre with line-numbered `ds-code-view*` rendering (reuse 9.10.10 atom): wrap each line in `__line` div + `__ln` gutter span. Mirrors bundle `ap-code` 192-201.
- [ ] 7.7 tsc + vitest gauntlet; commit "deck-go: chat-parity 7b — ap-html-stub iframe + ap-code line numbers".

## 8. Transcript widget polish (Decision 3, 1 commit — covers 4 ports + selected partials from §3.3)

- [ ] 8.1 Add `bfb-label` "show" eyebrow to `BlockFilterBar`: leading `<span className="ds-block-filter-bar__label mono small"><I.Filter size=10/> show</span>` per bundle `transcript.jsx` 99-101.
- [ ] 8.2 Update `MessageBubble` `__time` slot into `__meta-line mono small`: render role label ("you" / "main") + `dot-sep` + time + (when streaming) `dot-sep` + `streaming-dot` accent-colored "streaming" pill. Mirrors bundle 268-280.
- [ ] 8.3 Add Check/X icon prefix to `Chip` atom toggle states or BlockFilterBar inline: bundle line 112 shows `{prefs[k] ? <I.Check/> : <I.X/>} {label}` — visual confirmation of toggle state.
- [ ] 8.4 Add "view summary" button to `CompactionNotice`: `<Button variant="ghost" size="sm">view summary</Button>` after the count text. Click opens new `<CompactionSummaryModal>` that fetches `sessions.compaction.list` (deck-go backend wrapper exists at `deck-go/backend/internal/runtime/openclaw/session_commands.go:91`) and renders the compaction history with summary text per entry. Use Modal atom.
- [ ] 8.5 Wire `CompactionSummaryModal` to backend RPC: extend `chat-api.ts` with `fetchCompactionList(sessionKey)` + render entries with timestamp + before/after tokens + summary content (markdown via Markdown atom).
- [ ] 8.6 tsc + vitest gauntlet; commit "deck-go: chat-parity 8 — block-filter eyebrow + msg-meta-line role+streaming + compaction summary modal".

## 9. Sidebar collapsed mode (Decision 5, 1 commit — covers 6 partials from §3.5)

- [ ] 9.1 Add `--collapsed` modifier to `SessionSidebar`: when sidebar collapsed (existing state), swap layout to bundle `sidebar.jsx` 12-42 pattern — icon-only `+` New session button + `agent-stack` (vertical 1-letter agent dots from `agentsStore`, max 3 visible + "+" overflow) + `rule` separator + first 8 sessions as `session-mini` icon-only pills (Hash icon by default, streaming-dot pulse if `session.isStreaming`).
- [ ] 9.2 Wire `agent-dot` active class to `useChatStore.activeAgentId`. Wire `session-mini` active class to `activeSessionKey`.
- [ ] 9.3 Add CSS rules to `session-sidebar.css`: `.ds-session-sidebar--collapsed` overrides — flex-column gap-6 + 56px width + center-align + small min-height each row.
- [ ] 9.4 tsc + vitest gauntlet; commit "deck-go: chat-parity 9 — sidebar collapsed mode (agent-stack + session-mini)".

## 10. `.ds-block` shared base atom (Decision 4, 1 commit — covers blocks §3.4 architectural divergence)

- [ ] 10.1 Add new atom `deck-go/frontend/src/design-system/atoms/Block.tsx` (or reuse if exists at `block.css`): `<div className="ds-block ds-block--${variant}">` with variants `default | thinking | tool-use | tool-result | file | canvas | unknown`. Common chrome: 1px `--ds-border-subtle` + `--ds-radius-md` + `--ds-bg-elev`. Per-variant override classes for accent / error / muted bg.
- [ ] 10.2 Update consumers (ToolUseCard / ToolResultCard / ThinkingBlock / FileBlock / CanvasEmbed / UnknownBlock) to spread `<Block variant="...">` wrapper, replacing per-block ad-hoc root classes.
- [ ] 10.3 Verify visual consistency: all block types now share the same border + radius + bg outside their inner content, matching bundle `.block` cascade pattern.
- [ ] 10.4 tsc + vitest gauntlet (840+ tests + new Block atom test). Commit "deck-go: chat-parity 10 — shared `.ds-block` base atom + 6 variants".

## 11. axe a11y automation (1 commit)

- [ ] 11.1 Install `vitest-axe` as devDep: `cd deck-go/frontend && pnpm add -D vitest-axe`. Verify it lands in `package.json` `devDependencies` and `pnpm-lock.yaml` updates.
- [ ] 11.2 Add a top-of-file import + matcher extension in `deck-go/frontend/src/design-system/atoms/__tests__/setup.ts` (create if missing) — `expect.extend({ toHaveNoViolations: vitestAxe.toHaveNoViolations })` plus the JSDOM polyfills `vitest-axe` needs.
- [ ] 11.3 Add `await expect(container).toHaveNoViolations()` to every P1a atom test (`Button` / `IconButton` / `Badge` / `Chip` / `Tag` / `Spinner` / `SkeletonLoader` / `Banner` / `StreamingCursor` / `WaitingDots` / `ProgressBar`) — 11 files, ~1 assertion each.
- [ ] 11.4 Add the same to every P1b atom test (`Card` / `Block` / `Drawer` / `Modal` / `Markdown` / `Code` / `DiffView` / `JsonTree` / `TableView` / `Input` / `Textarea` / `Select` / `Toggle` / `Radio` / `Slider` / `FileInput` / `Tab` / `SegmentedControl` / `Breadcrumb` / `SidebarRow` / `Popover` / `DropdownMenu` / `Tooltip` / `Toast` / `ContextMenu`) — 25 files. Plus the new `Block` atom from §10.
- [ ] 11.5 Run full `pnpm vitest run` — investigate any axe failure. Each failure is a small atom fix or test-only `disableRules: ["color-contrast"]` override with a justification comment.
- [ ] 11.6 Commit "deck-go: chat-parity 11 — axe automation across 37 atoms".

## 12. Lighthouse + keyboard walkthrough (user-driven)

- [ ] 12.1 Run Lighthouse a11y audit against the production preview at `?deckVisualState=chat-rich`; target score ≥ 95. Record score + violations in `chat-parity-gap-report.md` "Lighthouse" section.
- [ ] 12.2 Keyboard walkthrough: from sidebar 新建会话 → composer focus → type → send → tool result tab navigation → approval allow/deny → artifact open/close → canvas open/close. Every step must be reachable via Tab/Shift+Tab/Enter/Escape with visible focus ring. Record any blockers in the gap report.
- [ ] 12.3 If Lighthouse < 95 or keyboard walkthrough finds blockers, treat each as a follow-up sub-task (small fixes inline; large fixes split into separate change). Do not gate this proposal on perfect score — gate on "user accepts" with documented violations.

## 13. Visual baseline refresh (1 commit)

- [ ] 13.1 Re-capture the 4 deck-baseline PNGs (`9.11-chat-rich-final.png`, `9.11-chat-empty-final.png`, `9.11-chat-rich-compact-final.png`, `9.11-chat-rich-light-final.png`) post-remediation; archive into `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/deck-baseline/`.
- [ ] 13.2 Add per-gap screenshot pairs from §3.7, §4-10 work (composer-cmd-tag, composer-toolbar, artifact-html-stub, artifact-tabs, canvas-iframe-bar, sidebar-collapsed, etc.) into the same deck-baseline directory with descriptive filenames.
- [ ] 13.3 Commit "deck-go: chat-parity 13 — refresh visual baselines + add per-gap pairs".

## 14. Closeout

- [ ] 14.1 Re-run gap-report audit: confirm zero `port`-status entries remain (every bundle primitive is either reproduced or has a documented `skip`/`deferred` justification).
- [ ] 14.2 Update `cross-module-readiness.md` Worklist with any new atoms added during chat remediation (e.g., `Block` atom from §10).
- [ ] 14.3 Mark this change archive-ready in tasks.md; produce a summary commit listing what shipped.
- [ ] 14.4 Run `openspec validate frontend-chat-parity-and-foundation-audit` to confirm 0 outstanding `[ ]` items, then `/opsx:archive frontend-chat-parity-and-foundation-audit`.
