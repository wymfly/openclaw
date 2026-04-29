## 1. Verification setup

- [ ] 1.1 Restart real-stack via `bash deck-go/scripts/dev/run-stack-real.sh restart`; rebuild with `VITE_DECK_VISUAL_STATE=1 pnpm build` so the production preview at port 4174 enables the visual seed.
- [ ] 1.2 Capture bundle JSX SHA-256 hashes for `app.jsx` / `composer.jsx` / `right-panel.jsx` / `transcript.jsx` / `blocks.jsx` (under `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/`); record in `docs/design-bundles/2026-04-29-claude-design-chat-pilot/chat-parity-gap-report.md` header per `chat-claude-design-parity` spec.
- [ ] 1.3 Confirm tasks.md from prior change `frontend-design-system-via-chat` is fully `[x]` and verify the change is archive-ready before starting work here.

## 2. Cross-module readiness audit (Goal A)

- [ ] 2.1 Inventory atoms: list all 36 P1a + P1b atom names + variants from `deck-go/frontend/src/design-system/atoms/index.ts` into the matrix's column headers.
- [ ] 2.2 Inventory next-target panels: identify legacy `deckgo-*` className clusters used by Settings / Models / Channels / Sessions / Logs panels; one row per panel with line-count of its `theme.css` rule footprint and a 1-line "what it does today" summary.
- [ ] 2.3 Per panel × atom cell: classify as `applies` (atom usable as-is), `extend` (atom needs new variant — note which), `missing` (no atom exists — propose new atom name), or `n/a` (panel has no need for this atom). Each cell is one short note.
- [ ] 2.4 Aggregate "atoms needing extension" + "missing atoms" into a Worklist section at top of the matrix; each Worklist item gets a one-line justification and an estimated atom-introduction effort.
- [ ] 2.5 Write `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` with header (date + maintainer + atom version), Worklist section, full matrix, and "no atom re-architecture" guarantee per `design-system-cross-module-readiness` spec.

## 3. Chat parity audit (Goal B — audit phase)

- [ ] 3.1 Read `composer.jsx` (357 LOC); enumerate every `className` and structural primitive into a checklist; mark deck-go counterpart class or "missing" / "diverges as <ds-\*>".
- [ ] 3.2 Repeat 3.1 for `right-panel.jsx` (293 LOC) — covers canvas + artifact panel.
- [ ] 3.3 Repeat 3.1 for `transcript.jsx` (361 LOC) — covers message bubble + tool-pair + run-status.
- [ ] 3.4 Repeat 3.1 for `blocks.jsx` (371 LOC) — covers block-filter / tool-ladder / approval / file-block / image-block / code-view / diff-view.
- [ ] 3.5 Repeat 3.1 for `app.jsx` (712 LOC) — covers shell + sidebar + context-bar + composer wiring.
- [ ] 3.6 Aggregate findings into `docs/design-bundles/2026-04-29-claude-design-chat-pilot/chat-parity-gap-report.md`: per-surface section with class-by-class table, divergence justifications, and prioritized remediation list (P1: visible-in-static-state, P2: interaction-only).
- [ ] 3.7 For every `port` entry in the gap report, capture deck-go-vs-bundle screenshot pair (Playwright at 1440×900 against `?deckVisualState=chat-rich`).

## 4. Composer remediation (Goal B — execution, per D1)

- [ ] 4.1 Add `cmd-tag` slash-command chip with close button: extend `MessageInput.tsx` to render an optional `<CmdTagChip>` when `currentSlashCommand` is set; the chip shows the command name + a close (×) IconButton that clears the slash. CSS in `message-input.css` mirroring bundle `composer.jsx` lines 696-712.
- [ ] 4.2 Implement `composer-icon-btn.active` toggled state: when an icon-button (画布 / 工件 / 提示模板) is currently expanded, it gets `--ds-accent-bg` background + `--ds-accent` glyph (was: hover-only state). Update `IconButton` atom OR add `is-active` modifier in composer-scoped CSS.
- [ ] 4.3 Re-capture `9.11-chat-rich-final.png` + add a `9.11-composer-cmd-tag.png` showing the cmd-tag chip rendered (use Playwright `keyboard.type("/")` to trigger).
- [ ] 4.4 tsc + vitest gauntlet 0 errors; commit per atom workflow ("deck-go: chat-parity 4 — composer cmd-tag + active icon variant").

## 5. Artifact panel remediation (Goal B — execution)

- [ ] 5.1 Add `ap-html-stub` view: when an artifact has language=html and the iframe has not loaded yet (or sandbox disabled), render a stub block with the bundle's diagonal-stripe pattern (`repeating-linear-gradient(135deg, var(--ds-bg-2) 0 8px, var(--ds-bg-3) 8px 16px)`) + center text "HTML artifact preview disabled — open in fullscreen to enable".
- [ ] 5.2 Verify `.ap-tab.active` accent border: inspect the artifact panel's tab strip (`__tabs > button`) in the active state; if it lacks the bundle's `border-bottom: 2px solid var(--ds-accent)` accent, add it. The Tab atom may already supply this — confirm via DOM inspect.
- [ ] 5.3 Re-capture `9.11-chat-rich-final.png` (artifact panel hidden) + add `9.11-artifact-html-stub.png` showing the stub state (toggle artifact panel via composer "工件面板" button, force language=html via dev seed extension if needed).
- [ ] 5.4 tsc + vitest gauntlet 0 errors; commit per atom workflow ("deck-go: chat-parity 5 — artifact ap-html-stub + tab.active accent").

## 6. Canvas panel remediation (Goal B — execution, biggest)

- [ ] 6.1 Introduce `<CpIframeMock>` sub-component: a wrapper around the canvas iframe that renders bundle's `cp-iframe-bar` (browser-chrome-style top bar with close/refresh/forward fake icons) + `cp-iframe-content` (border + bg-1 inner). When iframe is empty or loading, the mock shell is visible; when iframe loads, the bar stays + content slides under. CSS in `chat-canvas.css`.
- [ ] 6.2 Introduce `<CpCard>` + `<CpRow>` + `<CpActions>` sub-components: bundle uses these to render structured app cards inside the canvas (`cp-card-h` header + `cp-row` content rows + `cp-actions` footer button row). Map deck-go's existing canvas-overlay states (loading / error / empty) to these primitives so the canvas panel can render structured content per the bundle, not just a raw iframe stage.
- [ ] 6.3 Update `CanvasPanel.tsx` to use `<CpIframeMock>` for the iframe + `<CpCard>` for the loading/error/empty overlays. Preserve existing seed and runtime behavior.
- [ ] 6.4 Re-capture `9.11-chat-rich-final.png` + add `9.11-canvas-iframe-mock.png` (empty state) + `9.11-canvas-cp-card.png` (loading state, force via seed extension or runtime hook).
- [ ] 6.5 tsc + vitest gauntlet 0 errors; commit per atom workflow ("deck-go: chat-parity 6 — canvas iframe-mock + cp-card primitives").

## 7. axe a11y automation

- [ ] 7.1 Install `vitest-axe` as devDep: `cd deck-go/frontend && pnpm add -D vitest-axe`. Verify it lands in `package.json` `devDependencies` and `pnpm-lock.yaml` updates.
- [ ] 7.2 Add a top-of-file import + matcher extension in `deck-go/frontend/src/design-system/atoms/__tests__/setup.ts` (create if missing) — `expect.extend({ toHaveNoViolations: vitestAxe.toHaveNoViolations })` plus the JSDOM polyfills `vitest-axe` needs.
- [ ] 7.3 Add `await expect(container).toHaveNoViolations()` to every P1a atom test (`Button` / `IconButton` / `Badge` / `Chip` / `Tag` / `Spinner` / `SkeletonLoader` / `Banner` / `StreamingCursor` / `WaitingDots` / `ProgressBar`) — 11 files, ~1 assertion each; if any atom triggers violations, fix the atom and re-run.
- [ ] 7.4 Add the same to every P1b atom test (`Card` / `Block` / `Drawer` / `Modal` / `Markdown` / `Code` / `DiffView` / `JsonTree` / `TableView` / `Input` / `Textarea` / `Select` / `Toggle` / `Radio` / `Slider` / `FileInput` / `Tab` / `SegmentedControl` / `Breadcrumb` / `SidebarRow` / `Popover` / `DropdownMenu` / `Tooltip` / `Toast` / `ContextMenu`) — 25 files.
- [ ] 7.5 Run full `pnpm vitest run` — expect 840 + 36 = 876 assertions green; investigate any axe failure (likely contrast or aria-hidden order). Each failure is a small atom fix or test-only `disableRules: ["color-contrast"]` override with a justification comment.
- [ ] 7.6 Commit ("deck-go: chat-parity 7 — axe automation across 36 atoms").

## 8. Lighthouse + keyboard walkthrough (user-driven)

- [ ] 8.1 Run Lighthouse a11y audit against the production preview at `?deckVisualState=chat-rich`; target score ≥ 95. Record score + violations in `docs/design-bundles/2026-04-29-claude-design-chat-pilot/chat-parity-gap-report.md` "Lighthouse" section.
- [ ] 8.2 Keyboard walkthrough: from sidebar 新建会话 → composer focus → type → send → tool result tab navigation → approval allow/deny → artifact open/close → canvas open/close. Every step must be reachable via Tab/Shift+Tab/Enter/Escape with visible focus ring. Record any blockers in the gap report.
- [ ] 8.3 If Lighthouse < 95 or keyboard walkthrough finds blockers, treat each as a follow-up sub-task (small fixes inline; large fixes split into separate change). Do not gate this proposal on perfect score — gate on "user accepts" with documented violations.

## 9. Visual baseline refresh

- [ ] 9.1 Re-capture the 4 deck-baseline PNGs (`9.11-chat-rich-final.png`, `9.11-chat-empty-final.png`, `9.11-chat-rich-compact-final.png`, `9.11-chat-rich-light-final.png`) post-remediation; archive into `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/deck-baseline/` — preserve historical names so prior commits remain comparable via git history.
- [ ] 9.2 Add the new screenshot pairs from §3.7, §4.3, §5.3, §6.4 (composer-cmd-tag, artifact-html-stub, canvas-iframe-mock, canvas-cp-card) into the same deck-baseline directory with descriptive filenames.
- [ ] 9.3 Commit ("deck-go: chat-parity 9 — refresh visual baselines + add per-gap pairs").

## 10. Closeout

- [ ] 10.1 Re-run the gap-report script: confirm zero `port`-status entries remain (every bundle primitive is either reproduced or has a documented `skip`/`deferred` justification).
- [ ] 10.2 Update `cross-module-readiness.md` Worklist with any new atoms added during chat remediation (e.g., if `<CpCard>` becomes a generic atom).
- [ ] 10.3 Mark this change archive-ready in tasks.md; produce a summary commit listing what shipped (visual remediation atoms + 2 verification artifacts + axe automation + a11y user verification + refreshed baselines).
- [ ] 10.4 Run `openspec validate frontend-chat-parity-and-foundation-audit` to confirm 0 outstanding `[ ]` items, then `/opsx:archive frontend-chat-parity-and-foundation-audit`.
