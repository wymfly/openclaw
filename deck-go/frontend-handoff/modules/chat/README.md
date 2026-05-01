# chat — handoff package

> **⚠️ Reverse-derived artifact.** This package was reconstructed from real engineering code (`frontend-new/src/components/panels/chat/`) rather than produced through a forward design → engineering flow. Sister modules (agents, settings, etc.) MUST be produced through the **forward** flow per protocol-v1; do **not** copy this package's "engineering-first" shape as the design template.

**Status:** migrated (sha ef59017130)
**Protocol version:** `protocol-v1`
**Migrated to:** `frontend-new/src/components/panels/chat/` (101 source files + 10 test files)
**Bundle reference:** [`./prototype.html`](./prototype.html) (single-file Babel-standalone prototype, self-contained with sibling `tokens.css` / `styles.css` / `data.js` / 8 .jsx files)

---

## What this module does

`chat/` is the workspace where the user converses with one of the runtime's agents (`main`, `ops`, etc.). It surfaces:

- **Session sidebar** — list of past sessions (sorted by recency, searchable, agent-tabbed) with active-session highlight + delete affordance
- **Transcript** — virtual-scrolled list of `ChatMessage`s rendered as discrete content **blocks** (`text` / `tool_use` / `tool_result` / `thinking` / `image` / `bash_result` / `unknown`), with streaming dots and metadata footers
- **Composer** — multi-line textarea with slash-command palette, mention popover, attach files, prompt template menu, abort/send buttons, char-count, context-window hint, pre-warned compaction notice
- **Steer dialog** — a soft inline channel for redirecting the running agent without aborting
- **Right panel** — toggleable artifact browser (recently emitted file/diff artifacts) and canvas (a2ui rendered surface)
- **SSE banner** — connection state indicator (connected · reconnecting · disconnected)
- **Approval dialog** — guarded shell-command / tool-use prompts (approve / always-approve / deny)

Behind the surface, chat owns 9 stores and orchestrates SSE streaming, history hydration, transcript caching, slash-command discovery, agent-switching, and visual-state seeding for design review.

---

## Depends on atoms (`@/design-system/atoms/*`)

```
Badge · Banner · Block · Button · Card · Chip · Drawer · DropdownMenu ·
IconButton · Input · Markdown · Modal · SegmentedControl · SidebarRow ·
Tab · Textarea · WaitingDots
```

(17 of the 36 canonical atoms.) See `frontend-new/src/design-system/atoms/index.ts` for the authoritative list.

---

## Depends on hooks (`@/design-system/hooks/*` + `@/hooks/*`)

```
@/design-system/hooks: use-click-outside · use-escape-close · use-focus-trap · use-keyboard-nav · use-popover
@/hooks:               use-command-discovery · useMention · useSlashCommand
```

---

## Depends on stores (`@/stores/*`)

```
chat · chat-dispatchers · chat-hooks · chat-preferences · chat-types
agents · approvals · notifications · sessions
```

The `chat-*` cluster is chat-private; `agents` / `approvals` / `notifications` / `sessions` are cross-module and stay shared.

---

## Depends on lib (`@/lib/*`)

```
command-registry · command-types · context-utils · deck-client ·
format-utils · tool-result-parser · transcript-adapter · transcript-cache
```

`deck-client` is the typed Gateway client surface (over `deck-transport-core` / `deck-ws-transport`); chat is its largest consumer.

---

## Backend endpoints used

| Endpoint                                                              | Direction | Purpose                                                                                 |
| --------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `GET /api/sessions`                                                   | request   | List sessions for an agent (`fetchSessionList`)                                         |
| `POST /api/chat/sessions/preview`                                     | request   | Bulk preview overlays for sidebar (`fetchSessionPreviews`)                              |
| `GET /api/chat/history`                                               | request   | Hydrate full transcript for a session (`fetchChatSnapshot`)                             |
| `POST /api/chat/send`                                                 | request   | Submit user message + steer / cmd payload                                               |
| `POST /api/chat/sessions/patch`                                       | request   | Mutate session metadata (`patchSession`)                                                |
| `POST /api/chat/sessions/reset`                                       | request   | Reset session state (`resetChatSession`)                                                |
| `POST /api/chat/sessions/clear`                                       | request   | Clear messages + metadata (`clearChatSession`)                                          |
| `POST /api/chat/compact`                                              | request   | Trigger context compaction (`fetchCompactionList`)                                      |
| `POST /api/canvas/preview` / `/api/canvas/index` / `/api/canvas/<id>` | request   | a2ui canvas surface                                                                     |
| `POST /api/media`                                                     | request   | Inline media upload                                                                     |
| `GET /api/stream`                                                     | SSE       | All push events: chunks · tool_use · tool_result · approval · session_meta · sse status |
| `GET /api/deck/commands/discover`                                     | request   | Slash command discovery                                                                 |

Detailed request/response shapes live in [`./api-usage.md`](./api-usage.md).

---

## How to read this package

1. **Browser-open `prototype.html`** — feel the visual + interaction reference. Note: prototype reflects an **earlier design intent** (Claude Design pilot, 2026-04-29); the implemented `frontend-new/src/components/panels/chat/` has evolved past it in some details.
2. **Read [`components.md`](./components.md)** — component tree + props contract derived from real code
3. **Read [`states.md`](./states.md)** — state shape (sessions Map · activeSessionKey · messages · streaming · approval · sse) + transition rules + edge cases
4. **Read [`interactions.md`](./interactions.md)** — keyboard / hover / focus / empty / error / streaming behavior spec
5. **Read [`api-usage.md`](./api-usage.md)** — endpoint contracts + SSE protocol

For the engineering source: `frontend-new/src/components/panels/chat/` is canonical.
