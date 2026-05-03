# threads — high-fidelity handoff (v2)

**Status:** `revised v2 — pending implementation`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`threads/` is the **channel ↔ agent binding registry**. Each entry maps a
channel account (Discord / Telegram / WeCom / Slack / QQ) to a deck-go agent
running against a specific session key. Threads is **not** a transcript or
chat surface — the conversation lives in the `Chat` panel; threads exposes
binding metadata, projected recent activity, and audit history.

## File inventory

| File                      | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `prototype.html`          | ~30-line shell loading React + Babel + 7 jsx + 2 css.                     |
| `data.js`                 | Mock fixture: 10 thread bindings × 5 channel kinds × 3 target kinds.      |
| `icons.jsx`               | 25 SVG icons + `ChannelTile` + `TargetKindPill` + `ActivityKindBadge`.    |
| `list-view.jsx`           | KPI strip + 4-axis filter toolbar + 6-col binding rows.                   |
| `detail-view.jsx`         | Hero + 4 tabs (Overview / Recent activity / Audit / Raw).                 |
| `dialogs.jsx`             | UnbindDialog + RebindDialog + RenameDialog + RawEntryDialog + ModalShell. |
| `app.jsx`                 | `ThreadsApp` orchestrator + Tweaks host + state.                          |
| `styles.css`              | Linear-inspired list↔detail page transition + channel/target chips.       |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                      |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density/listState/detailState).            |
| `prototype-v1-codex.html` | Original Codex single-file prototype.                                     |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export type DeckGoThreadEntry = {
  threadId: string;
  channelId: string;
  agentId: string;
  targetSessionKey: string;
  targetKind: string; // "claude-code-session" | "agent-loop" | "external-bot"
  boundAt: number; // ms timestamp
  lastActivityAt: number;
  accountId: string;
  boundBy: string; // "operator:..." | "auto-binding" | "manual:..."
  label?: string;
};

export type DeckGoThreadsResponse = {
  threads?: DeckGoThreadEntry[];
};
```

Endpoint:

- `GET /api/deck/threads?channelKind=&agentId=&status=` → `DeckGoThreadsResponse`

## Contract-reality scope correction

The **PRD originally asked** for "full transcript view with chronological
message bubbles, branch indicators". That contract does not exist:
`DeckGoThreadEntry` is a binding record, not a conversation transcript. The
v2 scope reflects the contract:

- **Detail view shows binding metadata + BFF-projected recent activity +
  audit + raw entry**, not message bubbles.
- An **Open chat** cross-link CTA jumps the operator to the `Chat` panel
  scoped to `targetSessionKey`. Transcripts are owned there.

The "branch indicators" concept also has no contract source. Each binding is
a flat record; there is no parent/child linkage in `DeckGoThreadEntry`. If
upstream introduces thread reparenting, the panel can grow that surface
later.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState`, `SectionHeader` (used implicitly by hero + cards).

`@/design-system/icons`:

- Generic: `IconSearch`, `IconRefresh`, `IconClose`, `IconChevronLeft`,
  `IconLink`, `IconUnlink`, `IconArrowOut`, `IconUser`, `IconClock`,
  `IconTag`, `IconTerminal`, `IconLoop`, `IconBot`, `IconChat`,
  `IconActivity`, `IconAudit`, `IconCheck`, `IconAlert`.
- Channel glyphs: `IconChannelDiscord`, `IconChannelTelegram`,
  `IconChannelWecom`, `IconChannelSlack`, `IconChannelQq` — 5 channel-specific
  marks.

The `ChannelTile`, `TargetKindPill`, and `ActivityKindBadge` molecules stay
local to `threads/`. `ChannelTile` is a strong promotion candidate — channels
panel uses a similar tile shape.

## How to implement

1. Open `prototype.html` in a static server. Walk every state via the Tweaks
   panel (list ready/loading/error, detail tabs, dialogs).
2. Translate to `frontend-new/src/components/panels/threads/` keeping the
   class-name shape (`thread-row__*`, `detail-view__*`, `channel-tile--*`).
3. Wire real fetcher in `frontend-new/src/api/threads.ts`. Mutations
   (unbind / rebind / rename label) go to BFF mutation endpoints — see
   `api-usage.md` for the assumed shapes (these are BFF-side, not raw
   contract).
4. Hardcoded literal strings get extracted to `frontend-new/src/i18n/{en,zh}.json`
   in one pass.
5. The "Open chat" cross-link must reach the `Chat` panel scoped to
   `targetSessionKey`. Use the existing in-app routing helper.
6. Stale threshold (`> 24h since lastActivityAt`) is a UI choice — not a
   contract field. Keep it configurable.

## Open questions for follow-up

- Are mutation endpoints (unbind / rebind / rename) part of the typed
  contract or BFF-only? `api-usage.md` documents the assumed shape.
- Should `boundBy` get a typed enum instead of `string` so the UI can group
  "auto" vs "operator" without parsing the prefix?
- Should the contract carry a `deletedAt` field for unbound-but-archived
  bindings, or is hard delete the right model?
- Should `label` be an indexed field for full-text search, or stay
  client-filtered?
