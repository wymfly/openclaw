# chat — interactions

> **⚠️ Reverse-derived artifact.** Reconstructed from real engineering code.

## Keyboard

### Global (anywhere in chat)

| Key             | Action                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `⌘F` / `Ctrl+F` | Open `TranscriptSearch` (in-transcript find)                                                                                                                            |
| `Esc`           | Close any open overlay (TranscriptSearch, MentionPopover, SlashCommandPalette, ApprovalDialog if dismissable, RightPanel) — closes one layer at a time, outermost-first |
| `⌘K` / `Ctrl+K` | (TBD via stack-decisions: command palette? — currently unbound)                                                                                                         |

### Composer (MessageInput textarea focused)

| Key                                        | Action                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `⌘↵` / `Ctrl+↵`                            | Send message (or open approval if currently gated)                                                                                 |
| `↵`                                        | Newline (no send)                                                                                                                  |
| `Shift+↵`                                  | Newline (no send) — explicit                                                                                                       |
| `↑` (when textarea empty + caret at start) | Recall previous user message into composer (`useInputHistory`)                                                                     |
| `↓` (when in history)                      | Recall next                                                                                                                        |
| `/` (at line start, empty textarea)        | Open `SlashCommandPalette`                                                                                                         |
| `@` (at any position)                      | Open `MentionPopover`                                                                                                              |
| `Tab`                                      | Within slash palette: cycle suggestion. Within mention popover: confirm highlighted. Otherwise: indent (default browser behavior). |
| `Esc`                                      | Close palette/popover OR clear composer if no overlay                                                                              |

### Slash command palette

| Key                                                | Action                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `↑` `↓`                                            | Navigate suggestions                                                   |
| `↵`                                                | Insert selected command into composer + close palette + focus composer |
| `Tab`                                              | Same as `↵`                                                            |
| `Esc`                                              | Close palette                                                          |
| `Backspace` (when palette open and only `/` typed) | Close palette + remove `/`                                             |

### Mention popover

Same navigation as slash palette, but selected mention is inserted as a chip rendered inline in the composer (with remove `×` button visible on hover).

### Approval dialog (when present)

| Key                      | Action                                                         |
| ------------------------ | -------------------------------------------------------------- |
| `↵` (when 批准 focused)  | Approve once                                                   |
| `⌘↵` (when 批准 focused) | Approve always                                                 |
| `Esc`                    | Deny                                                           |
| `Tab` / `Shift+Tab`      | Cycle 批准 → 始终批准 → 拒绝 (focus trap via `use-focus-trap`) |

### Sidebar

| Key                                        | Action                                   |
| ------------------------------------------ | ---------------------------------------- |
| `↑` `↓` (when sidebar focused)             | Navigate session rows                    |
| `↵` (when row focused)                     | Select session                           |
| `⌘⌫` / `Ctrl+Backspace` (when row focused) | Delete session (with confirmation toast) |
| `⌘N` / `Ctrl+N`                            | New session (same as 新建会话 button)    |

### Right panel

| Key                                     | Action                |
| --------------------------------------- | --------------------- |
| `⌘1`                                    | Toggle Canvas panel   |
| `⌘2`                                    | Toggle Artifact panel |
| `Esc` (when right panel open + focused) | Close right panel     |

---

## Hover

- **SidebarRow**: background lifts to `var(--ds-bg-hover)`; delete `IconButton` becomes visible (opacity 0 → 1, 120ms ease)
- **MessageActions** (per-message hover toolbar): appears on message hover, fades in 80ms
- **ToolUseCard / ToolResultCard**: subtle border highlight on hover; click → expands to JsonTree view
- **ArtifactCard**: hover lifts shadow from `--ds-shadow-md` to `--ds-shadow-lg`; click → preview in main panel
- **Composer attach button**: tooltip "Attach files" via `Tooltip` atom on 400ms hover delay
- **Send button**: tooltip "⌘↵ Send"; if streaming, label changes to "停止" (Abort) with red accent
- **Block filter toggles**: hovered filter highlights its kind in transcript with subtle outline (preview before toggle)

---

## Focus

- **Initial focus on session activation**: composer textarea
- **Focus restoration after dialog close**: returns to last focused element before dialog opened
- **Focus trap inside ApprovalDialog**: tab cycles 批准 → 始终批准 → 拒绝 → 批准 (via `use-focus-trap`)
- **Focus trap inside CompactionSummaryModal**: same pattern
- **Focus indicator**: `:focus-visible` outline `2px solid var(--ds-accent)` with `2px` offset
- **MentionPopover / SlashCommandPalette**: do **not** trap focus — they overlay but composer keeps focus; arrow keys navigate suggestions while the textarea remains focused

---

## Empty / loading / error states

| State                                   | Component                          | Visual                                                                                 |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| **No sessions**                         | `SessionSidebar`                   | "暂无会话" banner with new-session call-to-action                                      |
| **No messages in active session**       | `EmptyState`                       | Centered: greeting + "type a message…" placeholder hint                                |
| **History hydrating**                   | `MessageList`                      | 3 skeleton block placeholders in transcript area; composer disabled with "加载历史中…" |
| **History hydration failed**            | inline `Banner`                    | "无法加载历史 · 重试" link → re-fetches                                                |
| **SSE reconnecting**                    | `SSEStatusBanner`                  | Yellow stripe top of transcript: "重连中…" + spinner                                   |
| **SSE disconnected**                    | `SSEStatusBanner`                  | Red stripe: "已断开 · 检查网络" + retry button                                         |
| **Streaming**                           | inline at end of message           | `WaitingDots` atom + soft cursor at last char                                          |
| **Streaming stalled (no chunk in 10s)** | `SSEStatusBanner` overlay          | "等待更新…" subtle indicator (no error escalation yet)                                 |
| **Run failed**                          | inline `Banner` (in transcript)    | Red banner with error message + "重试" / "新建会话" actions                            |
| **Approval pending**                    | `ApprovalDialog`                   | Modal-like in-flow card; transcript scroll continues but composer send is gated        |
| **Approval expired**                    | `Toast` (`@/stores/notifications`) | "审批已过期" + dismiss; ApprovalDialog disappears                                      |
| **Context near full**                   | `CompactionNotice`                 | Inline banner above composer: "上下文窗口接近满载 · 建议压缩或新建会话"                |
| **Network offline**                     | global Banner (top of transcript)  | "离线" indicator + queue indicator if optimistic send is queued                        |

---

## Visual-state seed (dev only)

URL params for design review (works only when `import.meta.env.DEV` or `MODE === "test"` or `VITE_DECK_VISUAL_STATE === "1"`):

| URL                           | Effect                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `?deckVisualState=chat-rich`  | Seeds 3 sessions + transcript with text/tool/tool_result/approval blocks + canvas state — for **layout / dense state** review |
| `?deckVisualState=chat-empty` | Empty sidebar + empty transcript — for **empty state** review                                                                 |
| `?dsGallery=1`                | Loads Gallery instead of chat (lazy import) — design system inventory                                                         |

The seed bypasses backend fetches; useful for offline / no-Gateway visual review.

---

## i18n note (protocol-v1, change 3 era)

> **⚠️ Temporary state.** chat currently uses `useTranslations("chat")` from `next-intl` via the `compat/next-intl.tsx` shim (Vite-compatible reimplementation of the Next.js API). This is **not a final architectural decision** — see [`../../../docs/project/stack-decisions.md`](../../../docs/project/stack-decisions.md) i18n entry. A future change will pick a real Vite-native i18n library and migrate all 154 `t()` calls. Until then:
>
> - Translation key → English string mapping lives in `frontend-new/src/i18n/en.json` under the `chat.*` namespace
> - Adding new chat strings: add the key in `en.json` and `zh.json`, use `t("yourKey")` — same as today
> - Designers should not block on i18n decision; copy can stay in `interactions.md` / `prototype.html` directly

---

## A11y invariants

- All interactive elements have visible focus indicators (no `outline: none` without alternative)
- All buttons have either visible text or `aria-label`
- ApprovalDialog and CompactionSummaryModal use `role="dialog"` + `aria-modal="true"` + focus trap
- SSEStatusBanner uses `role="status"` for "connected"/"reconnecting" and `role="alert"` for "disconnected"
- `vitest-axe` smoke tests cover atoms; module-level a11y verification is part of reverse sign-off (protocol-v1 #2)
