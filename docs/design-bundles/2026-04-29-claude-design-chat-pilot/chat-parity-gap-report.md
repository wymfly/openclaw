# Chat Parity Gap Report

Class-by-class diff of deck-go chat surfaces against the Claude Design pilot bundle JSX. Per `chat-claude-design-parity` spec the bundle hash is locked at audit time; any future bundle revision invalidates this report and triggers a re-audit.

## Bundle hash lock (audit timestamp 2026-04-30)

| File              | LOC | SHA-256                                                            |
| ----------------- | --: | ------------------------------------------------------------------ |
| `app.jsx`         | 712 | `64cf6032fa32edafff71b492c8543f495ab68cf3bd1e13a8ba43a8bcdbcc336a` |
| `composer.jsx`    | 357 | `a7ca9b6364285594f949b2f5b264c9b4915342fe09d84c47c65a3054edefe829` |
| `right-panel.jsx` | 293 | `9be33537da23e75b92809ce38e67bf2359582b33f1d627478a297e4c340e40f8` |
| `transcript.jsx`  | 361 | `9a8ee02752e69a714c93bebbcda3347792af416bf1171d50856f1b1cbab12460` |
| `blocks.jsx`      | 371 | `45477e5e271338e31239df5bae9014367f989a9877298b6ef5a2b97de5ac9f04` |

## Audit progress

| Surface                                                    | Bundle file       | Status  | Coverage |
| ---------------------------------------------------------- | ----------------- | ------- | :------: |
| Composer + ApprovalDialog                                  | `composer.jsx`    | ✅ done |   100%   |
| Right panel (Canvas + Artifact)                            | `right-panel.jsx` | ✅ done |   100%   |
| Transcript (messages + tool-pair + run-status)             | `transcript.jsx`  | ✅ done |   100%   |
| Blocks (filter / tool-ladder / file / image / code / diff) | `blocks.jsx`      | ✅ done |   100%   |
| App shell (sidebar + context-bar + composer wiring)        | `app.jsx`         | ✅ done |   100%   |

---

## Composer surface (composer.jsx 357 LOC)

**Deck-go file**: `deck-go/frontend/src/components/panels/chat/MessageInput.tsx` (697 LOC + helpers)

### Layout structure differences

#### Two-row layout (`composer-frame` → `composer-field` + `composer-toolbar`)

Bundle splits the composer into 4 vertical stacks inside one frame:

```jsx
<div className="composer-frame">
  {" "}
  // outer
  {showApproval && <ApprovalDialog />} // 1: approval (when active)
  {ctxPct >= 95 && <div className="ctx-warn">…</div>} // 2: context warning
  {files.length > 0 && <div className="attach-bar">…</div>} // 3: attachment chips
  <div className="composer-field">…</div> // 4a: textarea row (incl. attach + tag + ghost + textarea
  + template button INSIDE)
  <div className="composer-toolbar">…</div> // 4b: action toolbar (canvas + artifact toggles +
  char-count hint + send/stop)
</div>
```

Deck-go renders **everything as siblings** of `ds-message-input` (no field/toolbar wrappers):

```jsx
<div className="ds-message-input">
  {approval}
  {warning}
  <FileAttachmentBar />
  <IconButton attach />              // OUTSIDE the field
  <input file />
  <div className="ds-message-input__field">  // ONLY contains palette + ghost + tag + textarea
    <SlashCommandPalette />
    <MentionPopover />
    <Textarea />
    <ds-message-input__tag />
  </div>
  <PromptTemplateMenu />             // OUTSIDE the field
  <CanvasToggle /> <ArtifactToggle />
  <Button send/abort />
</div>
```

**Impact**: visual spacing reads as a single flex-wrap row in deck-go vs the bundle's 2-row stack. The bundle's `composer-toolbar` has `grow` spacer so canvas/artifact chips sit left and send button sits right — deck-go can't replicate this without wrapping.

| Bundle structural class                                            | Deck-go counterpart                                                     | Status       | Notes                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| `composer-frame`                                                   | `ds-message-input`                                                      | port-partial | OK as outer wrapper                                                       |
| `composer-frame.drag-over` modifier                                | (missing)                                                               | **port**     | Visual feedback on file drag-over absent in deck-go                       |
| `composer-field` (wraps attach + tag + textarea + template button) | `ds-message-input__field` (wraps only palette + textarea + ghost + tag) | **port**     | Restructure required — attach + template buttons should move INSIDE field |
| `composer-toolbar` (canvas + artifact + grow + hint + send)        | (missing — children siblings of frame)                                  | **port**     | Add new toolbar wrapper                                                   |

### Missing primitives (deck-go would need to add)

| #   | Bundle (composer.jsx line)                                                                                                                           | Deck-go state                                                                         | Status       | Remediation                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ctx-warn` with `<I.Zap size={11}>` + `<span className="mono small">` (line 73-79)                                                                   | `ds-message-input__warning` is plain text + role="status"                             | **port**     | Add zap icon + mono small class                                                                                               |
| 2   | `attach-bar` ends with `<button className="btn-ghost small">+ add</button>` (line 93-95)                                                             | Attach bar has chips only; "+ add" is a separate IconButton outside                   | **port**     | Move "add more files" affordance inside attach-bar tail                                                                       |
| 3   | `composer-attach` paperclip button **inside** `composer-field` (line 135-137)                                                                        | `ds-message-input__action` IconButton is sibling of field                             | **port**     | Move attach button into field, replace IconButton with bare `<button className="composer-attach">` style or add atom modifier |
| 4   | `cmd-tag` is a 3-element `<span>` (slash icon + mono name + close × button) (line 138-146)                                                           | `ds-message-input__tag` is a single button with `/{name}` text and clickable-to-clear | **port**     | Restructure: outer span + inner slash icon + mono name span + inner close button                                              |
| 5   | `ghost-hint` splits typed prefix + `<span className="ghost-rest">` for completion (line 148-153)                                                     | `ds-message-input__ghost` shows the entire ghost string in one span                   | **port**     | Split into two spans so styling can fade the suggestion portion                                                               |
| 6   | `composer-icon-btn` template button **inside** `composer-field` with `active` modifier (line 166-172)                                                | `<PromptTemplateMenu>` (DropdownMenu atom wrapper) is sibling of field                | **port**     | Move template trigger inside field; align active state                                                                        |
| 7   | `composer-toolbar` row with: `chip-toggle on/off` (canvas+artifact), `grow` spacer, `composer-hint` (`{text.length} ch · ⌘↵ send`), send/stop button | Children are flex-row siblings; no char-count hint anywhere                           | **port**     | Wrap canvas/artifact + send into new toolbar div; add hint span                                                               |
| 8   | `btn-stop` className for streaming abort (line 184-187)                                                                                              | `<Button variant="danger">` from atom                                                 | port-partial | Verify atom variant matches bundle's btn-stop visuals (no border vs danger atom)                                              |
| 9   | `btn-send` + `disabled` modifier (line 189-196)                                                                                                      | `<Button variant="primary" disabled>` from atom                                       | port-partial | Atom likely covers; visual-verify rounded vs square                                                                           |

### Slash palette / mention / template (popovers)

These are already migrated to `ds-command-palette*` / `ds-mention-popover*` per P3 9.8. Audit confirms structural parity:

| Bundle                                               | Deck-go                                                          | Status           |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| `popover slash-pop` / `mention-pop` / `template-pop` | `ds-command-palette` / `ds-mention-popover` / `ds-template-menu` | ✅ done (P3 9.8) |
| `pop-head mono small`                                | `ds-command-palette__section-title` etc.                         | ✅ done          |
| `pop-row` + `active`                                 | `ds-command-palette__option` + `--selected`                      | ✅ done          |
| `pop-empty mono small`                               | (deck-go renders no-results inline; structurally equivalent)     | port-partial     |
| `pop-mode-tag mono small`                            | (deck-go has no mode tag chip per row)                           | **port**         | Bundle shows `tag`/`argOptions`/`immediate` mode chip per command — useful affordance |
| `kbd` (keyboard hint pill)                           | (missing)                                                        | **port**         | Bundle shows `↵` kbd chip on selected row                                             |

### ApprovalDialog (composer-internal — composer.jsx lines 314-353)

Currently rendered above composer-frame in deck-go (already migrated in P3 9.9). Audit confirms most parity but flags structure differences:

| Bundle                                                                                                                                            | Deck-go                                                                        | Status           | Notes                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approval-dlg`                                                                                                                                    | `ds-approval-dialog`                                                           | ✅ done (P3 9.9) |                                                                                                                                                                                                                  |
| `approval-head` row containing: shield icon + `approval-title` + `grow` + `badge badge-warn` (when pending>1) + `approval-countdown mono`         | `ds-approval-dialog__header` with strong title + countdown                     | port-partial     | Missing pending-count badge                                                                                                                                                                                      |
| `badge badge-warn` (line 322) — pending count chip                                                                                                | (missing)                                                                      | **port**         | Currently `pendingCount` prop accepted but not visualized in header                                                                                                                                              |
| `approval-tool mono` (just the tool name, line 328)                                                                                               | `ds-approval-dialog__body code` chip                                           | port-partial     | Visually equivalent (chip on accent-bg)                                                                                                                                                                          |
| `approval-cmd` `<pre><code>` (line 329-331)                                                                                                       | `ds-approval-dialog__body pre`                                                 | ✅ done          |                                                                                                                                                                                                                  |
| `approval-meta mono small` flat row with `agent: <approval-meta-v>val</approval-meta-v>` + `dot-sep` + `cwd: <approval-meta-v>val` (line 332-340) | `ds-approval-dialog__meta` as `<dl><dt>/<dd>` grid                             | divergence       | **DOM differs but visual intent same**: bundle inline single-row with dot separator, deck-go 2-col grid. Justification: dl/dt/dd is more semantic for screen readers. **Decision: skip — keep deck-go pattern.** |
| `approval-actions` with `btn-success` + `btn-secondary` + `btn-danger-out`                                                                        | `ds-approval-dialog__actions` with `<Button variant=primary/secondary/danger>` | port-partial     | Atom variant naming differs; visually verify primary≈success, danger≈danger-out                                                                                                                                  |

### Things deck-go has that bundle does NOT

These are intentional product features beyond Claude Design's pilot mock; **none require bundle alignment**:

- File size validation + toast on oversize (`MAX_ATTACHMENT_BYTES`)
- Input history (ArrowUp/ArrowDown to recall prior messages)
- Mention selection writes back into textarea
- Suggested-text injection from empty-state suggestions
- Backspace-on-empty clears active slash tag
- Slash command remote/local routing with proper error toasts
- Send-disabled state combines streaming/sending/empty checks

### Composer summary

| Category                                       | Count                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Real gaps requiring port (`port`)              | **9** missing primitives + **2** structural restructures = **11 items** |
| Partial parity (`port-partial`, visual verify) | **5** items                                                             |
| Documented divergences (`skip`)                | **1** (approval-meta dl vs inline)                                      |
| Already done (`✅` from prior P3 atoms)        | **6**                                                                   |
| Bundle stubs / deck-go-only features           | **N/A**                                                                 |

**Composer gap count vs prior §10.2 hypothesis**: prior hypothesis listed 2 items (`cmd-tag` close button + `composer-icon-btn.active`); real audit surfaces 11. Coverage was ~18%. Re-estimating remediation effort: composer was sized for ~1 atom commit; actual scope is ~3 commits (structural restructure + missing primitives + popover polish).

---

## Right panel surface (right-panel.jsx 293 LOC)

**Deck-go files**: `deck-go/frontend/src/components/panels/chat/CanvasPanel.tsx` (342 LOC) + `artifacts/ArtifactPanel.tsx` (76 LOC)

Bundle wraps both in a single `<div className="right-panel">` with a `rp-resize` drag handle and renders either `<CanvasPanel>` or `<ArtifactPanel>` based on `mode`. Deck-go uses the Drawer atom + `chat-right-drawer.css` for the outer wrapper (already migrated in P3 9.7). The two inner panels are independent components.

### Drawer wrapper (.right-panel + .rp-resize)

| Bundle                                | Deck-go                                  | Status           |
| ------------------------------------- | ---------------------------------------- | ---------------- |
| `right-panel` outer with inline width | Drawer atom + `chat-right-drawer.css`    | ✅ done (P3 9.7) |
| `rp-resize` drag handle               | Resize handle in `chat-right-drawer.css` | ✅ done (P3 9.7) |

### CanvasPanel header (`.cp` + `.rp-head`)

| Bundle                                                      | Deck-go                               | Status       | Notes                                                                                                |
| ----------------------------------------------------------- | ------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `<I.Canvas size={13}>` icon at start                        | (missing)                             | **port**     | Bundle leads with a Canvas icon; deck-go has plain text title only                                   |
| `rp-title` "Canvas"                                         | `<span>` with `t("canvasTitle")` text | port-partial | Add `__title` class for typography parity                                                            |
| `rp-sub mono small` "a2ui-bridge · ready in 240ms" subtitle | (missing)                             | **port**     | Bundle shows bridge status / latency under title; deck-go has no subtitle slot. **Real visual gap.** |
| `grow` spacer                                               | Implicit via flex                     | divergence   | OK                                                                                                   |
| `icon-btn active?` Bug toggle                               | `<IconButton>` with bug icon          | port-partial | Verify `active` modifier (currently no `data-active` or aria-pressed link)                           |
| `icon-btn` Refresh button                                   | (missing)                             | **port**     | Deck-go has NO refresh button in canvas header. Real visual gap.                                     |
| `icon-btn` X close                                          | `<IconButton>` X                      | ✅ done      |                                                                                                      |

### CanvasPanel body (`.cp-body` + `.cp-stage`)

| Bundle                | Deck-go                                         | Status       | Notes                                             |
| --------------------- | ----------------------------------------------- | ------------ | ------------------------------------------------- |
| `cp-body` mid-wrapper | (missing — viewport is direct child of section) | divergence   | Deck-go flattens the layer; OK if styling matches |
| `cp-stage` stage host | `ds-canvas-panel__viewport`                     | port-partial | Naming differs but role identical                 |

### CanvasPanel overlays (`.cp-overlay` + `.error` / `.muted`)

| Bundle                                                                                                                          | Deck-go                                         | Status       | Notes                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `cp-overlay` loading: `<span className="spin">` (18×18 inline-styled) + `mono small` text                                       | `<LoaderIcon>` + plain `<span>` text            | port-partial | Switch text wrapper to mono small                                       |
| `cp-overlay error`: `<I.X size={20}>` + `mono` text + `btn-ghost` Reload (icon + label)                                         | Plain text + `<Button variant=secondary>` retry | port-partial | Add X icon at top of error overlay; ensure mono styling                 |
| `cp-overlay muted` (empty): `<I.Canvas size={24}>` (large) + `mono` "No canvas yet" + `mono small` "Waiting for agent…" subtext | Plain `t("canvasEmpty")` text only              | **port**     | Bundle's empty state is richer (large icon + 2-line message). Real gap. |

### CanvasPanel ready state (the `cp-iframe-mock` block — bundle stub vs deck-go real iframe)

Bundle renders a fake iframe-shaped shell when `state === "ready"`, containing decorative cards. Deck-go has a real `<iframe>` always rendered (overlays sit above when not ready). The mock decorations themselves don't apply — deck-go has REAL A2UI content inside the iframe. But the bundle's framing pattern (status bar above iframe area) IS a real visual primitive missing.

| Bundle                                                          | Deck-go                                              | Status     | Notes                                                                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `cp-iframe-mock` outer shell (wraps the iframe area)            | (deck-go renders bare `<iframe>` inside viewport)    | **port**   | Add a wrapper that hosts an above-iframe status bar                                                                                             |
| `cp-iframe-bar mono small` ("a2ui:tree · 14 nodes" status text) | (missing)                                            | **port**   | Real visual gap. Bundle shows live bridge state above the iframe. Deck-go could surface "a2ui:tree · N surfaces · ready" using `useSessionA2UI` |
| `cp-iframe-content` inner area (border + bg)                    | (deck-go iframe sits in `ds-canvas-panel__viewport`) | divergence | OK if iframe + viewport already provide the border/bg                                                                                           |
| `cp-card` (DataTable mock) inside iframe-content                | N/A                                                  | **skip**   | Bundle's mock content is decorative; deck-go's iframe runs real agent UI. **Justified divergence.**                                             |
| `cp-card-h mono` (DataTable header)                             | N/A                                                  | skip       | Same reason                                                                                                                                     |
| `cp-row mono` × N (table rows)                                  | N/A                                                  | skip       | Same reason                                                                                                                                     |
| `cp-actions` (button row at bottom)                             | N/A                                                  | skip       | Same reason — bundle's static "Refresh" / "Export" buttons are mock                                                                             |

### CanvasDebugPanel (`.cp-debug`)

| Bundle                                              | Deck-go                                     | Status           |
| --------------------------------------------------- | ------------------------------------------- | ---------------- |
| `cp-debug mono small` outer                         | `CanvasDebugPanel` (with `ds-canvas-debug`) | ✅ done (P3 9.7) |
| `cp-debug-h` section header (e.g. "Tree inspector") | (verify in CanvasDebugPanel.tsx)            | port-partial     |
| Indented tree rows with `paddingLeft` inline        | (verify)                                    | port-partial     |
| Events list section                                 | `ds-canvas-debug__events`                   | ✅ done          |

### ArtifactPanel header (`.ap` + `.rp-head`)

| Bundle                                        | Deck-go                                          | Status       | Notes                                                                                                              |
| --------------------------------------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `<I.Artifact size={13}>` icon at start        | (missing — no leading icon)                      | **port**     | Bundle has artifact icon; deck-go starts with title text                                                           |
| `rp-title` "ToolPair.tsx" (filename)          | `<strong>{title}</strong>`                       | port-partial | Add `__title` class                                                                                                |
| `rp-sub mono small` "tsx · 38 lines" subtitle | `__language` span (only language, no line count) | port-partial | Bundle subtitle is `<lang> · <N lines>` pattern; deck-go shows language only. Add line count from artifact content |
| `grow` spacer                                 | Implicit                                         | divergence   | OK                                                                                                                 |
| `icon-btn` Download / Copy / Maximize / X     | `<IconButton>` × 4                               | ✅ done      |                                                                                                                    |

### ArtifactPanel tabs (`.ap-tabs` + `.ap-tab.active`) — **MAJOR GAP**

Bundle renders a 5-tab strip (Code / Markdown / JSON / Table / HTML) below the header so users can re-render the same artifact in different formats. **Deck-go has NO tab strip** — `SharedRenderer` picks ONE renderer based on `artifact.language` and that's it.

| Bundle                        | Deck-go            | Status                 | Notes                                                                                                                                                                                                                         |
| ----------------------------- | ------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ap-tabs` row of 5 buttons    | (missing entirely) | **port — feature gap** | Whether deck-go needs this is a product question — does the deck artifact panel need format switching? Bundle's mock supports it; deck-go's real artifacts have detected language. **Recommend: ask product before porting.** |
| `ap-tab` per button           | (missing)          | **port**               | Could reuse Tab atom                                                                                                                                                                                                          |
| `ap-tab.active` accent border | (missing)          | **port**               | Tab atom may already supply this                                                                                                                                                                                              |

### ArtifactPanel body sub-renderers (`.ap-code` / `.ap-md` / `.ap-json` / `.ap-table` / `.ap-html-stub`)

| Bundle                                                                                                       | Deck-go                                                           | Status               | Notes                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ap-code <pre>` with `code-line` per row + `ln` gutter span                                                  | `ds-artifact-body__code` `<pre>` (plain, no line numbers)         | **port**             | Bundle has line-numbered code view; deck-go lacks gutter. Could reuse `ds-code-view*` family from P3 9.10.10                                                         |
| `ap-md md` markdown viewer                                                                                   | `ds-artifact-body__markdown` + MarkdownRenderer                   | ✅ done (P3 9.10)    |                                                                                                                                                                      |
| `ap-json mono small` `<pre>` (flat indented JSON)                                                            | `ds-json` JsonTree (interactive tree with toggle)                 | **divergence**       | Deck-go has richer tree view; bundle has flat pre. **Decision: skip — deck-go's tree is the deliberate upgrade.**                                                    |
| `ap-table <table>` with `<thead>/<tbody>/<th>/<td>` (`mono` on first col)                                    | `ds-artifact-body__table`                                         | port-partial         | Verify first-column mono modifier renders                                                                                                                            |
| `ap-html-stub` outer + `ap-html-bar mono small` ("srcdoc iframe (sandbox=allow-scripts)") + `ap-html-canvas` | `ds-artifact-body__code` `<pre>` (HTML shows as raw escaped text) | **port — major gap** | Deck-go renders HTML artifacts as escaped pre text; bundle renders inside a sandboxed iframe with a bar showing the security context. **Real feature + visual gap.** |

### Things deck-go has that bundle does NOT (intentional product features)

- Real A2UI bridge with bidirectional event channel (vs bundle's static mock)
- Bridge status persistence (`updateA2UIBridgeStatus`)
- Visual seed canvas HTML for offline E2E
- Real tree-data inspection in CanvasDebugPanel
- Artifact download (`downloadArtifact`)
- Artifact copy-to-clipboard with copied state
- Artifact `data-fullscreen` attr for E2E selectors
- Per-language renderer registry (`SharedRenderer`)

These are **out of scope** for parity — bundle is a static mock; deck-go is a working integration.

### Right-panel summary

| Category                                       | Count                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real gaps requiring port (`port`)              | **CanvasPanel: 6** (Canvas icon, rp-sub subtitle, Refresh button, empty-state icon+subtext, cp-iframe-mock shell, cp-iframe-bar status); **ArtifactPanel: 7** (Artifact icon, rp-sub subtitle restructure, ap-tabs entire structure ×3, ap-code line numbers, ap-html-stub iframe rendering) — **13 total** |
| Partial parity (`port-partial`, visual verify) | **6** (rp-title typography, Bug active state, overlay icons + mono, cp-body flatten OK, cp-debug-h verify, table first-col mono)                                                                                                                                                                            |
| Documented divergences (`skip`)                | **5** (cp-card/-row/-h/-actions mock content, ap-json tree-vs-pre upgrade)                                                                                                                                                                                                                                  |
| Already done (`✅` from prior P3 atoms)        | **5** (Drawer wrapper, rp-resize, X close, ap-md, debug events)                                                                                                                                                                                                                                             |

**Right-panel gap count vs prior §10.2 hypothesis**: prior listed 6 items (cp-iframe-mock + cp-card + cp-row + cp-actions + ap-html-stub + .ap-tab.active). Real audit:

- ✅ cp-iframe-mock — confirmed real gap (cp-iframe-bar status strip is the actionable part)
- ❌ cp-card / cp-row / cp-actions — **SKIP** (bundle mock content not applicable; deck-go has real iframe)
- ✅ ap-html-stub — confirmed real gap (HTML artifact rendering)
- ✅ .ap-tab.active — confirmed but subsumed under "missing entire ap-tabs structure"
- ➕ Surfaced new gaps not in §10.2: Canvas icon + Artifact icon + rp-sub subtitle pattern (×2) + Refresh button + Empty state icon+subtext + cp-iframe-bar status text + ap-code line numbers + ap-tabs entire structure + ap-table first-col mono

Coverage of §10.2 hypothesis: **3 of 6 items (50%) were real**, plus **8 new gaps not anticipated**. Pre-audit hypothesis would have under-fixed the artifact panel by missing the entire ap-tabs feature decision.

## Transcript surface (transcript.jsx 361 LOC)

**Deck-go files**: `MessageList.tsx`, `chat-message.css`, `ChatContextBar.tsx` + `chat-context-bar.css`, `BlockFilterBar.tsx`, `ToolProgressBar.tsx`, `MessageActions.tsx`, `CompactionNotice.tsx`, `SubagentTree.tsx` + `SubagentCard.tsx`, `TranscriptSearch.tsx`, `SSEStatusBanner.tsx`.

This bundle file is the densest — it contains 11 separate components (SSEBanner / ChatContextBar / TranscriptSearch / BlockFilterBar / ToolProgressBar / RunStatusBar / MessageActions / CompactionNotice / SubagentTree / MessageBubble / WaitingPlaceholder). Most were ported in P3 9.x, so the audit focuses on residual structural deltas.

### SSEBanner (`sse-banner` + `reconnecting`/`disconnected`)

| Bundle                                                     | Deck-go                                       | Status            | Notes                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `sse-banner` outer with reconnecting/disconnected modifier | `SSEStatusBanner` composed from `Banner` atom | ✅ done (P2a 4.6) |                                                                                                                                |
| `<I.WifiOff size={12}>` + text                             | Banner atom default icon                      | port-partial      | Verify wifi-off icon used                                                                                                      |
| `dot streaming-dot` pulse marker on reconnecting           | WaitingDots atom                              | ✅ done           |                                                                                                                                |
| `btn-ghost` Retry button on disconnected (line 16-20)      | (verify in SSEStatusBanner)                   | port-partial      | Bundle shows explicit retry button when disconnected; deck-go currently uses Banner default action — verify retry hook exposed |
| `grow` spacer pushing retry to right                       | implicit                                      | divergence (ok)   |                                                                                                                                |

### ChatContextBar — **STRUCTURAL DIVERGENCE**

Bundle renders a single horizontal row with 5 metric cells (Model + Context + Compactions + Reasoning + Send) + optional `chip chip-warn` for fast mode + a `⌘F` ghost button. Deck-go renders **ChatContextBar (just session + pressure + compaction)** PLUS a separate **SessionConfigBar** for model/reasoning/fast/usage/sendPolicy. Visual: bundle has ONE bar with everything; deck-go has TWO bars stacked.

| Bundle ChatContextBar                          | Deck-go counterpart                                                                      | Status                   | Notes                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | --- |
| `context-bar` outer flex row                   | `ds-chat-context-bar` row                                                                | port-partial             | Outer shape OK, but cell composition differs (see below)                                                                                                                                         |
| `ctx-cell` per metric (5 cells)                | `ds-chat-context-bar__session` (1 cell) + `__pressure` (1 cell) + `__compacted` (1 cell) | **divergence**           | Bundle has Model + Context + Compactions + Reasoning + Send. Deck splits Model/Reasoning/Send into `SessionConfigBar`. **Decision: skip — keep two-bar design; document in chat-parity report.** |
| `ctx-key` label + `ctx-val mono` value pattern | (deck doesn't use cell-key/value pattern)                                                | port-partial             | Deck shows `[main]·session·0条消息·idle Badge` — different layout but readable                                                                                                                   |
| `ctx-bar tone-${ok                             | warn                                                                                     | error}`track +`ctx-fill` | `__pressure-track > span` + `[data-pressure]`                                                                                                                                                    | ✅ done (P3 9.5) |     |
| `chip chip-warn` "fast" indicator              | (in SessionConfigBar)                                                                    | divergence (split)       |                                                                                                                                                                                                  |
| `btn-ghost` ⌘F search button + `kbd` chip      | (deck-go has separate TranscriptSearch toggle elsewhere)                                 | port-partial             | Bundle inlines search trigger in context-bar; deck-go puts it elsewhere                                                                                                                          |

### TranscriptSearch (`t-search`)

| Bundle                                                 | Deck-go                           | Status                                                                                   |
| ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `t-search` flex row                                    | `ds-transcript-search`            | ✅ done (P3 9.10.3)                                                                      |
| Search icon + input + `t-search-count mono` count text | `__icon` + Input atom + `__count` | ✅ done                                                                                  |
| `x-btn` for prev/next/close (3 buttons)                | IconButton × 3                    | port-partial — verify `x-btn` styling matches bundle (smaller chrome than IconButton sm) |

### BlockFilterBar

| Bundle                                                                     | Deck-go                                 | Status              | Notes                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `block-filter-bar` row                                                     | `ds-block-filter-bar`                   | ✅ done (P3 9.10.1) |                                                                                                               |
| `bfb-label mono small` "show" leading label with filter icon (line 99-101) | (missing)                               | **port**            | Deck-go's BlockFilterBar has chips only; bundle prefixes them with a "filter" eyebrow label. Real visual gap. |
| `chip-toggle on/off` (3 chips: thinking / tool calls / results)            | Chip atom (active toggle)               | ✅ done             | Visually equivalent                                                                                           |
| Check/X icon prefix per chip toggle state                                  | (Chip atom doesn't include icon prefix) | port-partial        | Bundle shows ✓ when on, ✗ when off — extra affordance.                                                        |

### ToolProgressBar — **DIVERGENCE**

| Bundle                                                                                                    | Deck-go                                                           | Status         | Notes                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tool-progress-bar` flat horizontal flex row                                                              | `ds-tool-ladder` auto-fit grid of cards                           | **divergence** | Bundle is single horizontal scrolling row of compact items; deck-go is multi-line metadata cards (status + name + id + elapsed). **Decision: skip — deck-go's card design carries more metadata for live tool runs.** Document in chat-parity report. |
| `tpb-item` per running tool with `spin` (9px) + `mono small` tool name + `tpb-summary mono small` summary | `__step` card with status label / strong name / id span / elapsed | divergence     | See above                                                                                                                                                                                                                                             |

### RunStatusBar (transcript.jsx 142-169) — major detail check

| Bundle                                                                                | Deck-go                                   | Status       | Notes                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ----------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-status-bar mono small` flat row                                                  | `.ds-run-status-bar`                      | ✅ done      | chat-message.css references the bundle target                                                                                                                     |
| Spans separated by `dot-sep` (`·`)                                                    | (verify)                                  | port-partial | Bundle uses inline `<span className="dot-sep">·</span>`; deck-go's selector list shows `__model` etc. — verify whether `dot-sep` separators exist between metrics |
| `<I.Sparkle>` model + tokens (`Hash` icon) + cache % + `Coin` cost + `Clock` duration | RunStatusBar (verify icon set + ordering) | port-partial | All metrics likely present (P3 9.2 chat-message migrated this); verify icon parity                                                                                |
| `streaming-dot` accent-colored pulse appended when streaming                          | (verify)                                  | port-partial |                                                                                                                                                                   |

### MessageActions

| Bundle                                                          | Deck-go                                                  | Status                          |
| --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `message-actions` row of `btn-ghost` buttons (Copy/Retry/👍/👎) | `ds-message-actions` with IconButton × 4                 | ✅ done (P3 9.10.4)             |
| `Copied` confirmation state on Copy button                      | `copied` state + CheckIcon                               | ✅ done                         |
| Bundle uses emoji 👍 / 👎 directly                              | Deck-go uses `ThumbsUpIcon` / `ThumbsDownIcon` SVG icons | divergence (acceptable upgrade) |

### CompactionNotice

| Bundle                                                         | Deck-go                          | Status                    | Notes                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `compaction-notice` row                                        | `ds-compaction-notice`           | ✅ done (P3 9.5 + 9.10.5) |                                                                                                                        |
| `<I.Layers size={11}>` + `mono small` "Compacted X → Y tokens" | `__icon` "cmp" mono pill + spans | port-partial              | Bundle uses Layers icon; deck-go shows mono "cmp" letterpress chip. Equivalent semantically; visual differs.           |
| `btn-ghost small` "view summary" button at end                 | (missing)                        | **port**                  | Bundle has a "view summary" affordance after the count; deck-go has none. Real feature gap (would need summary modal). |

### SubagentTree — **DIVERGENCE (intentional)**

| Bundle                                                                                                          | Deck-go                                                                                                       | Status              | Notes                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subagent-tree` outer                                                                                           | `ds-subagent-tree`                                                                                            | ✅ done (P3 9.10.7) |                                                                                                                                                                                        |
| `sat-head` row with branch icon + "Subagent lineage"                                                            | `__head` row                                                                                                  | ✅ done             |                                                                                                                                                                                        |
| `sat-node` flat row with `paddingLeft: depth * 14` inline + `sat-dot ${status}` + mono name + `sat-status` text | `ds-subagent-card` bordered cards (one per agent) with grid `__row` (status / label / task / badge / elapsed) | **divergence**      | **Documented divergence**: bundle is flat-tree, deck is card-tree. Deck's card design carries more metadata (task / badge / elapsed). **Decision: skip — bundle parity not required.** |
| Recursive `node.children?.map` with depth-padded children                                                       | `__children` UL with margin-left + border-left                                                                | ✅ done             | Recursion structure matches                                                                                                                                                            |

### MessageBubble (`msg-row` + variants)

| Bundle                                                                                                          | Deck-go                                                | Status                                                                     | Notes                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `msg-row align-left/-right` + `is-user`/`is-assistant` modifiers                                                | `ds-chat-message` + `--user` modifier                  | port-partial                                                               | Naming differs but role identical                                                                                                                   |
| `msg-avatar` (User/Bot icon)                                                                                    | `ds-chat-message__avatar`                              | ✅ done                                                                    |                                                                                                                                                     |
| `msg-body` wrapper                                                                                              | `ds-chat-message__body` + extra `__bubble` inner layer | port-partial                                                               | Deck has 2 wrappers (body + bubble) — bubble carries the user-bg color. Bundle puts bg directly on body. **Documented divergence.**                 |
| `msg-meta-line mono small` row with: role text ("you"/"main") + `dot-sep` + time + `streaming-dot` if streaming | `ds-chat-message__time` (just time)                    | **port**                                                                   | **Real gap**: bundle shows role + time + streaming-dot in a mono meta line; deck-go shows time only. Add role label + streaming pulse to meta line. |
| `msg-blocks` container                                                                                          | `ds-chat-message__blocks`                              | ✅ done                                                                    |                                                                                                                                                     |
| `RunStatusBar` rendered ONLY for non-user when `meta` exists                                                    | (verify in MessageList rendering path)                 | port-partial                                                               |                                                                                                                                                     |
| `MessageActions` rendered ONLY for non-user, non-streaming                                                      | (verify hover-reveal in chat-message.css)              | port-partial — `ds-chat-message:hover .ds-message-actions` selector exists |

### WaitingPlaceholder (`msg-row align-left is-assistant waiting`)

| Bundle                                                                         | Deck-go                                                          | Status       | Notes                                                                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `msg-row .waiting` variant with avatar + body                                  | `ds-chat-message-waiting` (separate top-level class)             | divergence   | Bundle reuses msg-row chrome; deck-go has dedicated waiting wrapper                                                       |
| `msg-avatar` showing Bot icon                                                  | (verify)                                                         | port-partial |                                                                                                                           |
| `msg-body` containing `waiting-dots` (3 spans) + `mono small "thinking…"` text | `ds-thinking-inline` (single text "thinking") + WaitingDots atom | port-partial | All primitives exist as separate components; verify rendering composition still produces the avatar + dots + label layout |

### Things deck-go has that bundle does NOT (intentional product features)

- Per-message error / partial state markers (`__error`, `__partial`)
- User message bubble distinct background (`__bubble` inner layer)
- Pinned / favorite / share affordances (verify in MessageActions)
- Time-zone / locale-aware time formatting
- Real SSE backpressure handling (vs bundle stub)
- Real per-tool elapsed time (vs bundle hardcoded "12s ago")

### Transcript surface summary

| Category                                       | Count                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real gaps requiring port (`port`)              | **3** (BlockFilterBar `bfb-label` "show" eyebrow, MessageActions chip-toggle Check/X icon prefix, MessageBubble msg-meta-line role label + streaming dot, CompactionNotice "view summary" button) — total 4                                                                                 |
| Partial parity (`port-partial`, visual verify) | **9** (SSEBanner retry button, ctx-key/val pattern, ctx ⌘F search button, x-btn sizing, chip-toggle icon prefix, RunStatusBar dot-sep + icon set + streaming-dot, message-row naming, msg-body bubble layer, RunStatusBar/MessageActions render conditions, WaitingPlaceholder composition) |
| Documented divergences (`skip`)                | **3** (5-cell context-bar vs 2-bar split, flat vs card subagent tree, flat vs card tool-ladder)                                                                                                                                                                                             |
| Already done (`✅` from prior P3 atoms)        | **18** (SSE banner outer, CompactionNotice outer, ds-subagent-tree outer, ds-block-filter-bar, ds-transcript-search, ds-tool-ladder outer, ds-run-status-bar outer + selectors, message-actions hover-reveal, ds-chat-context-bar pressure track, etc.)                                     |

**Transcript gap count vs prior §10.2 hypothesis**: §10.2 didn't enumerate transcript-specific gaps explicitly (focused on canvas/artifact/composer). Real audit surfaces 4 ports + 9 partial-parity + 3 documented divergences. **Significant findings**:

- ChatContextBar 5-cell vs 2-bar architectural split is a deliberate-but-hidden divergence that should be raised to product before remediation
- BlockFilterBar `bfb-label` is a small but visible miss
- MessageBubble meta-line lacks role + streaming indicator (was overshadowed by avatar styling work in 9.2)
- CompactionNotice "view summary" affordance is a minor feature gap

## Blocks surface (blocks.jsx 371 LOC)

**Deck-go files**: `panels/chat/blocks/*` (TextBlock / ThinkingBlock / ToolUseCard / ToolResultCard / FileBlock / ImageBlock / CanvasEmbed / UnknownBlock + supporting renderers HighlightedCodeView / DiffPreview / RawView).

This bundle file declares all transcript block renderers + ToolPair wrapper. Most were ported in P3 9.3 (tool-pair) + P3 9.10.x (file-block / image-block / code-view / diff-view / json-tree). The audit focuses on residual structural deltas.

### Bundle's `.block` shared chrome — **architectural divergence**

Bundle wraps every block type in a shared `<div className="block ${type}">` (e.g., `block thinking`, `block tool-use`, `block tool-result`, `block file-block`, `block canvas-inline`, `block unknown-block`). The `.block` class likely supplies common border/radius/bg chrome via styles.css; the type modifier overrides per-variant styling.

Deck-go does NOT use a shared `.block` base class — each block type has its own root class (`ds-tool-use-card`, `ds-tool-result-card`, `ds-file-block`, `ds-image-block`, `ds-canvas-embed`, etc.) and Card atom is used selectively.

| Bundle                                         | Deck-go                                    | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<div className="block ${type}">` shared frame | per-block roots without common `.ds-block` | **divergence** | **Decision: skip — keep deck-go's atomized structure**, BUT verify visual chrome consistency: bundle blocks share the same border/radius/bg via the `.block` rule; deck-go must enforce the same look across each block independently. **Risk: visual drift between block types.** Recommend a chat-parity follow-up sub-task to add `.ds-block` base class as a non-breaking shared atom. |

### TextBlock (`md`, `md-user`)

| Bundle                                                         | Deck-go                                                              | Status                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `md` markdown wrapper                                          | Markdown atom (`ds-md`)                                              | ✅ done (P1b 3.2)                                               |
| `md md-user` user-bubble variant                               | `ds-chat-message--user .ds-md` cascade or `--user` class on Markdown | port-partial — verify user-message inline-code accent treatment |
| `inline-code` for inline `<code>`                              | `ds-md code` + atom rules                                            | ✅ done                                                         |
| Tiny markdown subset (bold + inline-code + lists + paragraphs) | MarkdownRenderer with full markdown subset                           | ✅ done (deck-go covers more markdown features)                 |

### ThinkingBlock (`block thinking` + `block-head` + `block-body thinking-body` + `cursor-blink`)

| Bundle                                                                                                                    | Deck-go                                        | Status       | Notes                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `block thinking` outer                                                                                                    | (verify deck-go ThinkingBlock root class)      | port-partial |                                                                                                                  |
| `block-head` collapsible button with brain icon + `block-head-label` "Thinking" + streaming-dot "writing…" + `chev` arrow | (verify)                                       | port-partial | Bundle shows `streaming-dot writing…` with text-3 color when streaming; deck-go's streaming indicator may differ |
| `block-body thinking-body`                                                                                                | (verify)                                       | port-partial |                                                                                                                  |
| `cursor-blink` blinking caret at end of streaming text                                                                    | (verify deck-go uses `<StreamingCursor>` atom) | port-partial | StreamingCursor atom exists in P1a; verify ThinkingBlock uses it                                                 |
| `defaultExpanded` opens automatically when streaming                                                                      | (verify deck-go logic)                         | port-partial |                                                                                                                  |

### ToolUseCard (`block tool-use` + `data-running` + `is-paired-top`/`is-embedded`)

| Bundle                                                                                            | Deck-go                              | Status       | Notes                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------- |
| `block tool-use` outer                                                                            | `ds-tool-use-card` (P3 9.3)          | ✅ done      |                                                                                                          |
| `is-paired-top` modifier (border-radius bottom-flat to seal with tool-result)                     | (verify ds-tool-pair modifier)       | port-partial |                                                                                                          |
| `is-embedded` modifier (no shadow when nested)                                                    | (verify)                             | port-partial |                                                                                                          |
| `data-running={running}` attribute                                                                | `data-tool-status` or class modifier | port-partial | Bundle uses data attribute for CSS hooks; deck-go likely uses class                                      |
| `block-head` clickable to toggle                                                                  | (verify)                             | port-partial |                                                                                                          |
| `<I.Tool>` icon OR `<span className="spin">` running indicator at start of head                   | (verify)                             | port-partial | Bundle swaps icon for spinner when running; deck-go may always show tool icon                            |
| `block-head-label mono` (tool name) + `block-head-summary mono` (summary text)                    | (verify)                             | port-partial |                                                                                                          |
| `block-head-actions` slot containing `badge badge-ok` or `badge badge-running` status pill        | (verify)                             | port-partial | Should leverage Badge atom                                                                               |
| `chev` chevron toggle indicator                                                                   | (verify)                             | port-partial |                                                                                                          |
| `block-body` containing `param-grid` (2-col grid for inputs) + `block-toolbar` (Copy JSON button) | (verify)                             | port-partial | `param-grid` is a key visual primitive — verify deck-go's tool input rendering uses similar 2-col layout |

### ToolResultCard (`block tool-result` + `is-paired-bot` + `is-error`)

| Bundle                                                                                                  | Deck-go                                  | Status                                          | Notes                                                                            |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `block tool-result` outer                                                                               | `ds-tool-result-card` (P3 9.3)           | ✅ done                                         |                                                                                  |
| `is-paired-bot` (border-radius top-flat)                                                                | (verify)                                 | port-partial                                    |                                                                                  |
| `is-error` (red tinting)                                                                                | (verify)                                 | port-partial                                    |                                                                                  |
| `block-head static` (non-clickable, no chevron)                                                         | (verify)                                 | port-partial                                    | Bundle uses `static` modifier to suppress hover/click; deck-go may not need this |
| `result-tabs` `role="tablist"` with `tab` + `tab.active` for raw/bash/read/diff (`disabled` if no data) | `ds-result-tabs` (verify Tab atom usage) | ✅ done (P3 9.3 used SegmentedControl/Tab atom) |
| `block-head-actions` with "Eye" icon + Rich/Raw toggle                                                  | (verify)                                 | port-partial                                    | Verify ShowRawToggle (P3 9.10.13 cleanup) — `ds-raw-toggle` exists               |
| `block-body no-pad` for content area                                                                    | (verify)                                 | port-partial                                    |                                                                                  |

### Sub-renderers — bash / read / diff / image / raw

| Bundle                                                                                                                   | Deck-go                                                       | Status       | Notes                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash` outer + `bash-meta` (exit badge + stderr badge) + `bash-stream stdout/stderr` `<pre>` with `stream-label` prefix  | (verify deck-go bash result renderer)                         | port-partial | Bundle shows exit code + stderr indicator pills above output; deck-go's bash view may differ                                                      |
| `read` outer + `read-bar mono` (file icon + path) + `read-code <pre>` with `code-line` + `ln` gutter                     | `ds-code-view` family (P3 9.10.10)                            | ✅ done      | Bundle's read view IS what 9.10.10 ported. Verify that ToolResultCard `read` view tab routes to ds-code-view.                                     |
| `read err` + `read-bar err` + `err-msg mono`                                                                             | (verify error variant)                                        | port-partial |                                                                                                                                                   |
| `diff` outer + `diff-bar mono` (path + add/del stat) + `diff-body <pre>` with `diff-line add/del/context` + `sym` prefix | `ds-diff` (P3 9.10.11) + `__line--add/--del/--hunk/--context` | ✅ done      | Verify DiffPreview routes through this                                                                                                            |
| `img-result` + `img-bar mono` (path + dimensions) + `img-stub` placeholder                                               | (verify deck-go ImageResultView)                              | port-partial | This is the tool-result image variant (different from standalone `image` block). Bundle has stub placeholder; deck-go may render the actual image |
| `raw-pre` `<pre>` for fallback                                                                                           | `RawView` component                                           | ✅ done      |                                                                                                                                                   |

### FileBlock (`block file-block`) — standalone (NOT inside tool-result)

| Bundle                                                                       | Deck-go                                  | Status              |
| ---------------------------------------------------------------------------- | ---------------------------------------- | ------------------- |
| `block file-block` row                                                       | `ds-file-block`                          | ✅ done (P3 9.10.8) |
| `<I.File size={14}>` + `file-name mono` + `file-size` + `btn-ghost` Download | Card atom + `__name` + `__size` + Button | ✅ done             |

### CanvasInline (`block canvas-inline`)

| Bundle                                                                                           | Deck-go                       | Status       | Notes                                                                               |
| ------------------------------------------------------------------------------------------------ | ----------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `block canvas-inline` outer                                                                      | `ds-canvas-embed` (P3 9.7)    | ✅ done      |                                                                                     |
| `canvas-inline-bar` top bar with Canvas icon + title + grow + `btn-ghost` "Open in panel" button | (verify)                      | port-partial | Bundle has explicit "Open in panel" affordance; deck-go's CanvasEmbed may auto-open |
| `canvas-inline-stub` decorative diagonal-stripe placeholder when iframe unavailable              | (deck-go renders real iframe) | divergence   | Bundle stub vs deck-go real iframe — same as canvas-mock pattern. Skip.             |

### UnknownBlock (`block unknown-block`)

| Bundle                                                                   | Deck-go                            | Status       | Notes                                                             |
| ------------------------------------------------------------------------ | ---------------------------------- | ------------ | ----------------------------------------------------------------- |
| `block unknown-block` row with `<I.Hash>` + mono "unknown block: ${raw}" | `ds-unknown-block` (verify exists) | port-partial | Verify deck-go has fallback renderer for unrecognized block types |

### ToolPair wrapper (`tool-pair` + `is-error`)

| Bundle                                                                    | Deck-go                 | Status  |
| ------------------------------------------------------------------------- | ----------------------- | ------- |
| `tool-pair` outer wrapping ToolUseCard (paired) + ToolResultCard (paired) | `ds-tool-pair` (P3 9.3) | ✅ done |
| `is-error` modifier (when result error)                                   | `--error` modifier      | ✅ done |

### Things deck-go has that bundle does NOT

- More extensive markdown features (tables, blockquotes, headings 1-6 with styling)
- Real bash result with parsed exit code + duration extraction
- Real file download with mime type negotiation
- Real image preview with click-to-fullscreen
- Real diff parsing with hunk headers
- Real virtualized scroll for long tool result outputs (`VirtualScrollResult`)
- `data-tool-result-view` attribute for E2E selector contracts
- Token-aware tool result truncation

### Blocks summary

| Category                                       | Count                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real gaps requiring port (`port`)              | **1** (CanvasInline "Open in panel" affordance — small) — but **MANY** items marked `port-partial` actually need verification, and likely 3-5 of those will surface as real ports during implementation                                                                                                                     |
| Partial parity (`port-partial`, visual verify) | **19** items spanning ToolUseCard internals (block-head structure, param-grid, block-toolbar Copy button, badge slot), ToolResultCard internals (block-head static, result-tabs styling, ShowRawToggle eye icon), bash/read/diff/img sub-renderer wiring, ThinkingBlock cursor-blink + streaming-dot, UnknownBlock fallback |
| Documented divergences (`skip`)                | **2** (`.block` shared chrome — keep atomized, but flag visual consistency risk; canvas-inline-stub vs real iframe)                                                                                                                                                                                                         |
| Already done (`✅` from prior P3 atoms)        | **18** (TextBlock md, inline-code, ds-tool-use-card outer, ds-tool-result-card outer, result-tabs, ds-code-view family, ds-diff family, ds-json, ds-file-block, ds-canvas-embed, RawView, ToolPair outer + error, MessageActions, etc.)                                                                                     |

**Blocks gap count vs prior §10.2 hypothesis**: §10.2 didn't enumerate block-level gaps. Real audit surfaces **1 confirmed real port + 19 partials needing implementation-phase verification + 2 documented divergences**. Significant findings:

- Bundle's `.block` shared chrome is a **hidden architectural decision** — deck-go's per-block roots may visually drift between block types over time. Recommend documenting a `.ds-block` base atom as a future hardening pass.
- ToolUseCard's `param-grid` 2-col input rendering is a key primitive worth confirming.
- `block-head-summary` (the truncated tool input preview shown next to tool name) is critical to bundle's compactness — verify deck-go renders this consistently.

## App shell (app.jsx 712 LOC) + Sidebar (sidebar.jsx 149 LOC)

**Deck-go files**: `panels/chat/ChatPanel.tsx`, `chat-shell.css`, `panels/chat/SessionSidebar.tsx` + `session-sidebar.css`.

The bundle's `app.jsx` is mostly the dev-tweaks UI (TweaksUI lines 141-309) and the StateMatrixView (lines 311-712, used only for the design-time state matrix preview). The deck-relevant chat-shell wiring is **lines 73-128** plus the `Sidebar` from `sidebar.jsx`.

### App shell layout (.app-shell + .main-col + .transcript + .composer-zone)

| Bundle                                                                                                 | Deck-go                             | Status            | Notes                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `app-shell` outer 3-col grid (sidebar / main / right-panel + tweaks-panel floating)                    | `ds-chat-shell` 3-col grid          | ✅ done (P2a 4.4) | Bundle's tweaks-panel is dev-only, not in deck-go scope                                                                           |
| `main-col` middle column wrapping SSEBanner + ChatContextBar + transcript + filter/progress + composer | `ds-chat-shell__main`               | ✅ done           |                                                                                                                                   |
| `transcript scroll-y` (scroll container for messages)                                                  | `ds-chat-shell__transcript`         | port-partial      | Verify deck-go's transcript wrapper has equivalent scroll behavior; bundle's `scroll-y` utility class hookup                      |
| `composer-zone` (composer wrapper at bottom)                                                           | `ds-chat-shell__composer`           | ✅ done           |                                                                                                                                   |
| `matrix-shell` view variant                                                                            | (out of scope — design-time only)   | skip              | StateMatrixView is for the design preview tool, not deck-go                                                                       |
| `BlockFilterBar` rendered AFTER transcript, BEFORE composer                                            | (verify deck-go ChatPanel layering) | port-partial      | Bundle order: SSE → context-bar → search? → transcript → BlockFilterBar → ToolProgressBar → composer-zone. Verify deck-go matches |
| `ToolProgressBar` rendered AFTER BlockFilterBar (also between transcript and composer)                 | (verify position in ChatPanel)      | port-partial      |                                                                                                                                   |

### Sidebar collapsed mode (.sidebar.collapsed + .agent-stack + .agent-dot + .session-mini + .rule)

Bundle has a **separate compact sidebar** when collapsed: icon-only "+" New session button + vertical `agent-stack` (3-letter agent dots) + `rule` separator + first 8 sessions as `session-mini` pills.

| Bundle                                                     | Deck-go                                           | Status       | Notes                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `sidebar collapsed` modifier — full layout swap            | (verify deck-go SessionSidebar collapsed support) | port-partial | P3 9.6 mentioned collapsed support; verify the layout actually swaps to icon-only mode |
| `agent-stack` vertical agent dots                          | (verify)                                          | port-partial |                                                                                        |
| `agent-dot` + `active` letter pills (1-char)               | (verify)                                          | port-partial |                                                                                        |
| `rule` horizontal separator                                | (verify)                                          | port-partial |                                                                                        |
| `session-mini` icon-only session pill (8 max in collapsed) | (verify)                                          | port-partial | Bundle limits to first 8; deck-go behavior unverified                                  |
| Streaming dot vs Hash icon per session-mini                | (verify)                                          | port-partial |                                                                                        |

### Sidebar full mode header (.agent-tabs + .sidebar-actions + .sidebar-search)

| Bundle                                                                    | Deck-go                        | Status       | Notes                                                    |
| ------------------------------------------------------------------------- | ------------------------------ | ------------ | -------------------------------------------------------- |
| `agent-tabs` row of agent tabs (active + muted "+")                       | AgentTabs component (P3 9.6)   | ✅ done      |                                                          |
| `agent-tab` per agent + `active` + `muted` ("+" new agent)                | Tab atom + variants            | ✅ done      |                                                          |
| `sidebar-actions` wrapper section                                         | `ds-session-sidebar__actions`? | port-partial | Verify wrapper                                           |
| `btn-primary` "New session" with `<I.Plus>` icon + label                  | Button atom variant=primary    | ✅ done      |                                                          |
| `sidebar-search` row with search icon + input + `x-btn` clear (when text) | `ds-session-sidebar__search`   | port-partial | Verify x-btn clear affordance when search input has text |

### Session list (.session-list + .empty-rows + .session-row + row internals)

| Bundle                                                     | Deck-go                                            | Status           | Notes                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `session-list scroll-y`                                    | `ds-session-sidebar__list`                         | ✅ done (P3 9.6) |                                                                            |
| `empty-rows mono small` ("No matches" / "No sessions yet") | (verify)                                           | port-partial     | Bundle has 2 empty-state messages depending on whether search query is set |
| `session-row` + `active` + `streaming` modifiers           | SidebarRow atom                                    | ✅ done          |                                                                            |
| `row-title-line` (streaming dot + title + trash on hover)  | SidebarRow internals                               | port-partial     | Verify trash button shows on hover                                         |
| `dot streaming-dot` per row when streaming                 | (verify)                                           | port-partial     | Bundle uses inline `style={{ background: var(--accent) }}`                 |
| `rename-input` (inline edit on doubleClick)                | (verify deck-go inline rename via `editing` state) | port-partial     |                                                                            |
| `row-title` ellipsis                                       | SidebarRow atom                                    | ✅ done          |                                                                            |
| `row-trash` (hover-only delete trigger)                    | (verify hover-reveal CSS)                          | port-partial     | Bundle shows trash button only when row is hovered                         |
| `row-preview` (last message preview text)                  | (verify)                                           | port-partial     |                                                                            |
| `row-meta mono` (timestamp)                                | (verify)                                           | port-partial     |                                                                            |

### Sidebar footer (.sidebar-foot + .kbd)

| Bundle                                                     | Deck-go                          | Status       |
| ---------------------------------------------------------- | -------------------------------- | ------------ |
| `sidebar-foot mono small` "Default agent: <kbd>main</kbd>" | (verify deck-go has this footer) | port-partial |
| `kbd` keyboard chip styling                                | (verify)                         | port-partial |

### Delete confirmation modal (.modal-scrim + .modal + .modal-actions)

| Bundle                                          | Deck-go              | Status       | Notes                                                                              |
| ----------------------------------------------- | -------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `modal-scrim` background overlay                | Modal atom (P1b 3.1) | ✅ done      |                                                                                    |
| `modal` content card with h3 + p + actions      | Modal atom           | ✅ done      |                                                                                    |
| `modal-actions` button row with Cancel + Delete | Modal atom or inline | port-partial | Verify Cancel uses `btn-ghost` and Delete uses `btn-danger` (Button atom variants) |

### TweaksPanel + StateMatrixView (out of scope)

The TweaksPanel (lines 141-309) and StateMatrixView (lines 311-712) are **design-time tools** for previewing states with inline tweaks. They are **NOT in deck-go scope** — deck-go has its own runtime state from real Gateway data. **Skip entire region** with justification.

### App shell summary

| Category                                | Count                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real gaps requiring port (`port`)       | **0** confirmed (most items are partial-verify)                                                                                                                                                                                                                                                   |
| Partial parity (`port-partial`, verify) | **17** items (sidebar collapsed swap, agent-stack/-dot, rule, session-mini, sidebar-actions wrapper, x-btn clear, empty-rows messages, row-title-line, streaming-dot, rename-input, row-trash hover, row-preview, row-meta, sidebar-foot, kbd, modal Cancel+Delete variants, transcript scroll-y) |
| Documented divergences (`skip`)         | **2** (matrix-shell view variant, TweaksPanel + StateMatrixView design tooling)                                                                                                                                                                                                                   |
| Already done (`✅` from prior P3 atoms) | **8** (app-shell 3-col, main-col, composer-zone, agent-tabs, btn-primary, session-row, row-title, modal scrim+content)                                                                                                                                                                            |

**App shell gap count vs prior §10.2 hypothesis**: §10.2 didn't enumerate shell-level gaps (focused on canvas/artifact/composer surfaces). Real audit shows the chat shell is mostly aligned (P2a 4.4 + P3 9.6 covered it well), but flags **17 partial-parity items** that need DOM-inspect verification during remediation. Most are likely already correct but need confirmation.

Significant findings:

- **Sidebar collapsed mode** is the biggest unknown: bundle has a totally different layout (icon-only + agent-stack + session-mini pills); deck-go's collapsed support exists but wasn't visually verified against this pattern in P3 9.6.
- **Trash button hover-reveal** in session rows — bundle shows on `:hover`, deck-go's hover-reveal CSS exists per P3 9.6 commit but composition not verified.
- **`scroll-y` utility class** is bundle's repeated scroll wrapper — deck-go uses inline `overflow: auto`; consider whether to introduce a `ds-scroll-y` utility for parity (small ergonomic win, low priority).

---

## Cross-surface summary (post-audit)

### Verdict on prior §10.2 hypothesis

Prior `frontend-design-system-via-chat` closeout §10.2 identified gaps on canvas / artifact / composer with **6 specific items**. Real audit verdict:

| Hypothesis item                                         | Real status            | Notes                                                                                    |
| ------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `cp-iframe-mock` decorative shell                       | ✅ confirmed gap       | But the actionable port is `cp-iframe-bar` status strip, not the mock card content       |
| `cp-card` / `cp-row` / `cp-actions` mock content        | ❌ **SKIP**            | Bundle stub only; deck-go has real iframe                                                |
| `ap-html-stub` fullscreen state                         | ✅ confirmed gap       | Real visual + feature gap (HTML rendering vs raw pre)                                    |
| `.ap-tab.active` accent border                          | ✅ confirmed gap       | Subsumed under MAJOR `.ap-tabs` entire structure missing                                 |
| `composer-attach` / `composer-icon-btn.active` icon row | ✅ confirmed (partial) | Real gap, but real shape is "buttons inside `composer-field`" not just "active modifier" |
| `cmd-tag` slash-command chip with close button          | ✅ confirmed           | Real shape is 3-element span (icon + mono + button), not single button                   |

Prior §10.2 coverage: **~33% of real gaps were anticipated**. The audit phase's value is high — it surfaced ~30 gaps the hypothesis missed.

### Aggregated remediation list (from all 5 surfaces)

**Real port items (high confidence, must do)**: 22 — composer 11, right-panel 13, transcript 4, blocks 1+, app shell 0 (pending verify).

**Partial-parity items (must verify, likely fix)**: 56 — composer 5, right-panel 6, transcript 9, blocks 19, app shell 17.

**Documented divergences (skip with justification)**: 13 — composer 1, right-panel 5, transcript 3, blocks 2, app shell 2.

### Re-estimating remediation effort

Original proposal §4-6 sized canvas / artifact / composer at **3 commits** based on §10.2's 6-item hypothesis. Real scope:

- **Composer remediation**: 11 ports + 5 verifies = ~3 commits (toolbar restructure, attach/template inside-field, cmd-tag, ghost-rest, ctx-warn details, popover affordances)
- **Right-panel remediation**: 13 ports + 6 verifies = ~3 commits (canvas header icons + sub + refresh, canvas overlays, cp-iframe-bar, artifact header, ap-tabs feature decision, ap-html-stub, ap-code line numbers)
- **Transcript remediation**: 4 ports + 9 verifies = ~2 commits (BlockFilterBar bfb-label, MessageBubble msg-meta-line role+streaming-dot, CompactionNotice view-summary affordance, MessageActions chip-toggle icon prefix)
- **Blocks verification**: 1 port + 19 verifies = ~2 commits (ThinkingBlock cursor-blink, ToolUseCard param-grid, badge slots, sub-renderer wiring, plus optional `.ds-block` shared base atom hardening)
- **App shell verification**: 0 ports + 17 verifies = ~1 commit (sidebar collapsed mode primary; rest are confirmation passes)

**Revised total**: ~11 commits (vs proposal's original ~3). The proposal's tasks.md §4-6 needs to be rewritten with the post-audit remediation backlog.

### Key product decisions raised by audit

These deltas are not pure visual ports — they need product input:

1. **ChatContextBar 5-cell vs 2-bar split**: bundle puts everything in one row (Model + Context + Compactions + Reasoning + Send + fast-mode chip + ⌘F search); deck-go splits into ChatContextBar (state) + SessionConfigBar (config). Should we collapse them? Saves vertical space but may overcrowd the bar.
2. **ArtifactPanel `.ap-tabs` (5-tab format switcher)**: bundle lets users re-render the same artifact as Code/Markdown/JSON/Table/HTML; deck-go renders only the detected language. Add format-switching UX or skip?
3. **CompactionNotice "view summary" button**: bundle has a "view summary" affordance after the count; would require a summary modal feature. Build or skip?
4. **`.ds-block` shared base atom**: bundle uses `.block` chrome cascade across all block types; deck-go atomizes. Worth introducing a shared base for visual consistency hardening, or stay with current approach?
5. **Sidebar collapsed mode pattern**: verify deck-go's collapsed sidebar matches bundle's icon-stack pattern; if not, port or document divergence.

## Post-§4-10 closeout (audit timestamp 2026-04-30, change `frontend-chat-parity-and-foundation-audit`)

After the audit produced the port lists above, §4-10 of `frontend-chat-parity-and-foundation-audit/tasks.md` shipped 9 commits that close every `**port**` entry. The original status markers in the per-surface tables are preserved as a historical record — the table below maps each port group to the commit that closed it, demonstrating zero functionally outstanding `port`-status work.

| Section                           | Port-status entries (audit verdict)               | Closed by commit                                                                                                                                                     | Status    |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| §3.1 Composer                     | 11 ports + 5 partials                             | 4a (4-stack restructure + drag-over + char-count) + 4b (cmd-tag 3-element + ghost-rest + ctx-warn zap) + 4c (active state + popover mode-tag + kbd + attach-bar add) | ✅ closed |
| §3.2 Right-panel — Canvas         | 6 ports                                           | 6a (canvas header sub + Refresh + overlay icons) + 6b (canvas iframe-bar status strip)                                                                               | ✅ closed |
| §3.2 Right-panel — Artifact       | 7 ports + 1 partial                               | 7a (artifact icon + sub + 5-tab format switcher) + 7b (ap-html-stub iframe + ap-code line numbers)                                                                   | ✅ closed |
| §3.3 Transcript                   | 4 ports                                           | 8 (block-filter eyebrow + msg-meta-line role+streaming + compaction summary modal)                                                                                   | ✅ closed |
| §3.4 Blocks                       | 1 port + architectural divergence                 | 10 (shared `.ds-block` base atom + 6 role variants) — closes the cross-block visual consistency port                                                                 | ✅ closed |
| §3.5 App shell                    | 0 ports + sidebar collapsed-mode product decision | 9 (sidebar collapsed mode — agent-stack + session-mini)                                                                                                              | ✅ closed |
| §3.3 Transcript — ChatContextBar  | structural divergence (Decision 1)                | 5 (collapse SessionConfigBar into 5-cell ChatContextBar)                                                                                                             | ✅ closed |
| §3.4 Blocks — `.ds-block` cascade | architectural divergence (Decision 4)             | 10 (shared `.ds-block` base atom + 6 role variants)                                                                                                                  | ✅ closed |

**Cross-cutting: a11y automation** — §11 added `vitest-axe` matcher + `expectNoAxeViolations(container)` assertion to all 36 atom tests. Every atom passes with **zero violations**, providing a regression gate for any future visual changes.

### Verdict

Every `**port**` entry surfaced by the audit either:

1. **Has been functionally closed** by a §4-10 commit (the table above), OR
2. **Has been documented as a `divergence` with skip decision** (e.g., `approval-meta` dl/dt/dd vs flat row, `tool-progress-bar` cards vs row, `sat-node` flat-tree vs cards) — preserved as deck-go intentional product features.

No port-status entries remain functionally outstanding. The per-surface tables above retain their original audit markers as historical evidence; the closure map in this section is the load-bearing summary.

Important scope correction: this verdict is **not** a pixel-level or high-fidelity
visual acceptance verdict. It only means the audited bundle primitives have a
corresponding implementation path or a documented divergence. Visual fidelity
still needs a separate pass against the handoff screenshots.

## 2026-05-03 workbench embedding addendum

Fresh comparison against `frontend-handoff/modules/chat/` confirmed the active handoff package and this archived 2026-04-29 bundle are byte-identical for `composer.jsx`, `right-panel.jsx`, and `styles.css`. The remaining current-code gap was not a missing bundle subcomponent; it was how chat was embedded into the `frontend-new` Deck shell.

### Findings

| Finding                                                        | Evidence                                                                                                                                   | Resolution                                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chat rendered as an inset card inside padded `deck-ui-content` | `/tmp/deck-go-chat-current-fresh.png` measured `deck-ui-content` at x=208/y=48/w=1232/h=912 and `ds-chat-shell` at x=224/y=64/w=1200/h=876 | Added a chat-only workbench content mode; nav/header remain global, `deck-ui-content--workbench` removes padding, and `ds-chat-shell` fills the remaining viewport |
| `SidebarRow` allowed nested interactive controls               | Fresh Playwright console captured React's `<button>` inside `<button>` error from `SessionSidebar` delete action                           | Refactored `SidebarRow` into a non-interactive row container with a dedicated select button and separate trailing action region                                    |
| Mock visual route emitted 502s                                 | Initial `chat-visual.spec.ts` run caught `/api/deck/commands/discover` and `/api/chat/sessions/preview` 502s                               | Added `deck.commands.discover` and `sessions.preview` support to `test/fixtures/mock-gateway.mjs`                                                                  |

### Evidence artifacts

- Current workbench screenshot: `project/screenshots/deck-baseline/15.13-chat-workbench-current.png`
- Handoff workbench screenshot: `project/screenshots/deck-baseline/15.13-chat-workbench-handoff.png`
- Refreshed baselines: `9.11-chat-rich-final.png`, `9.11-chat-empty-final.png`, `9.11-chat-rich-compact-final.png`, `9.11-chat-rich-light-final.png`
- Verification: `pnpm exec playwright test --config deck-go/playwright.config.ts chat-visual.spec.ts` passes and asserts no unexpected `console.error`, `pageerror`, API >=400 responses, or nested `button button` DOM.

## 2026-05-03 a11y and screenshot closeout

### Lighthouse

Audit target: `http://127.0.0.1:4174/?surface=deck-ui&panel=chat&deckVisualState=chat-rich&nav=expanded`, desktop Chromium, accessibility category only.

Initial run scored **97** and found two audit failures:

| Audit                         |    Count | Resolution                                                                                                           |
| ----------------------------- | -------: | -------------------------------------------------------------------------------------------------------------------- |
| `color-contrast`              | 20 nodes | Raised readable meta-token contrast by updating dark `--ds-text-3` to `#8992a3` and light `--ds-text-3` to `#6c7280` |
| `label-content-name-mismatch` |   1 node | Updated the language toggle accessible name to include the visible `EN` / `ZH` label                                 |

Post-fix run scored **100** with **0 failed audits**. Raw report: `/tmp/deck-go-chat-rich-lighthouse-a11y-after.json` (local verification artifact, not committed).

### Keyboard Walkthrough

Automated Playwright walkthrough now runs in `deck-go/test/e2e/chat-visual.spec.ts` against the mock stack:

`pnpm exec playwright test --config deck-go/playwright.config.ts chat-visual.spec.ts`

Result: **2 passed**. Coverage:

- Sidebar new session reached with Tab and activated with Enter.
- Composer textarea reached by keyboard, typed into, and submitted through the Send button.
- Tool-result segmented tabs navigated with ArrowLeft from `read` to `Show Raw`.
- Approval `Approve` and `Deny` actions confirmed keyboard-focusable.
- Canvas drawer closed and reopened through keyboard-triggered controls.
- Artifact card opened by keyboard, artifact tabs confirmed focusable, and artifact drawer closed by keyboard.

No keyboard blockers were found in this deterministic pass.

### Per-gap Screenshot Pairs

The original audit table has many row-level `port` entries that collapse into the §4-10 implementation groups. The screenshot closeout therefore captures one current-vs-handoff pair per shipped port group; each pair covers the row-level port entries listed in the closure map above.

| Port group                                                    | Current implementation                                                    | Handoff/prototype reference                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Composer command chip + toolbar                               | `project/screenshots/deck-baseline/13.2-composer-cmd-toolbar-current.png` | `project/screenshots/deck-baseline/13.2-composer-cmd-toolbar-handoff.png` |
| Canvas header + iframe status strip                           | `project/screenshots/deck-baseline/13.2-canvas-iframe-bar-current.png`    | `project/screenshots/deck-baseline/13.2-canvas-iframe-bar-handoff.png`    |
| Artifact tabs + JSON/code chrome                              | `project/screenshots/deck-baseline/13.2-artifact-tabs-current.png`        | `project/screenshots/deck-baseline/13.2-artifact-tabs-handoff.png`        |
| Artifact HTML stub                                            | `project/screenshots/deck-baseline/13.2-artifact-html-stub-current.png`   | `project/screenshots/deck-baseline/13.2-artifact-html-stub-handoff.png`   |
| Transcript blocks, filter bar, tool result, compaction notice | `project/screenshots/deck-baseline/13.2-transcript-blocks-current.png`    | `project/screenshots/deck-baseline/13.2-transcript-blocks-handoff.png`    |
| Collapsed sidebar                                             | `project/screenshots/deck-baseline/13.2-sidebar-collapsed-current.png`    | `project/screenshots/deck-baseline/13.2-sidebar-collapsed-handoff.png`    |

## 2026-05-03 visual fidelity review reopened

User visual review identified that the current Deck implementation is still not
fully aligned with the Claude Design high-fidelity chat prototype. The current
known mismatches are:

| Area                 | Current mismatch                                                                                                  | Likely cause                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography           | Text weight/scale/rendering does not match the handoff closely enough                                             | Implementation uses self-hosted Inter first, but several host-shell and chat surfaces still inherit legacy `theme.css` sizing/weight rules or use product-specific labels/states that change perceived density |
| Canvas               | Current canvas drawer renders the real visual seed/iframe content, not the prototype's `cp-card` mock composition | Prior closeout intentionally skipped `cp-card`/`cp-row`/`cp-actions` as mock content because deck-go owns a real A2UI iframe; that is a functional divergence, but visually it remains a mismatch              |
| Chat text background | User/assistant message bubble backgrounds do not match the prototype                                              | Deck implementation keeps an extra `ds-chat-message__bubble` layer and product-specific user bubble treatment, while the handoff styles `.msg-body` / `.md-user` directly                                      |

Conclusion: the change is **not archive-ready for high-fidelity chat visual
parity** until a visual fidelity pass either fixes these mismatches or records
explicit product decisions accepting each divergence.

## 2026-05-03 high-fidelity visual parity pass

This pass treats the rendered handoff prototype as the visual source of truth,
with code truth used to explain mismatches. The decisive reference is
`frontend-handoff/modules/chat/prototype.html` plus its byte-identical bundle
files under `project/`.

### Fixes landed

| Area                 | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Evidence                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography           | `ds-chat-shell` now pins the chat workbench to `--ds-font-sans`, `--ds-fs-body`, `--ds-line`, `font-weight: 400`, and `letter-spacing: 0` so host `theme.css` sizing cannot leak into chat. Computed style now matches the handoff root: Inter, 13.5px, 20.25px line-height.                                                                                                                                                                                             | Current screenshot `project/screenshots/deck-baseline/16.4-chat-rich-current.png`; handoff screenshot `project/screenshots/deck-baseline/16.4-chat-rich-handoff.png` |
| Canvas               | The right drawer now gives its content a real `minmax(0, 1fr)` row, so `CanvasPanel` fills the workbench height. The visual-seed iframe now renders the prototype's `cp-card` / `cp-row` / `cp-actions` mock content, while real non-visual-seed sessions still run the A2UI iframe. The wrapper uses the handoff `cp-iframe-mock` margin, border, radius, background, and status-strip treatment.                                                                       | Current `.ds-canvas-panel__iframe-mock`: x=989/y=127/w=423/h=745 at 1440x900 dark; handoff `.cp-iframe-mock` uses the same bg `#1c2028` and border `#1f2530`         |
| User text background | The first audit assumed `.md-user` was the live handoff branch. Re-checking the locked prototype showed `transcript.jsx` calls `renderBlock(... isUser={false})`, so the rendered user text is transparent even though `styles.css` contains an unreachable `.md-user` bubble rule. Deck now follows rendered truth: the user text layer is transparent (`background: transparent`, `padding: 0`, `border: 0`) while keeping right alignment and the accent user avatar. | Current `.ds-chat-message__bubble`: transparent background, 0px padding; handoff first user message renders `.md` without `.md-user`                                 |

### Remaining accepted differences

| Difference                                                                                                 | Reason                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deck global nav/header remain visible                                                                      | This is required by `frontend-new` shell architecture and was already accepted in D7: chat is an edge-to-edge workbench inside Deck, not a full-screen replacement for Deck.                     |
| Visual seed data values differ from handoff (`2 surfaces` / `connecting` vs `14 nodes` / `ready in 240ms`) | Current values are backed by deck-go mock runtime state. The visual treatment now matches; the exact copy is runtime data, not a static design token.                                            |
| `--ds-text-3` is lighter than the original bundle token                                                    | This is an intentional accessibility correction from the Lighthouse pass: dark `--ds-text-3` remains `#8992a3` instead of the bundle's `#6e7585`, preserving Lighthouse accessibility score 100. |

### Refreshed visual artifacts

- Baselines refreshed after this pass: `9.11-chat-rich-final.png`, `9.11-chat-empty-final.png`, `9.11-chat-rich-compact-final.png`, `9.11-chat-rich-light-final.png`
- Updated current canvas pair: `13.2-canvas-iframe-bar-current.png`
- Updated workbench current shot: `15.13-chat-workbench-current.png`
- New high-fidelity comparison pair: `16.4-chat-rich-current.png` and `16.4-chat-rich-handoff.png`
