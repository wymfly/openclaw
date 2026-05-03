# identity — interactions (v2)

## Pointer

- **IdentityNav item click** → switches `selectedId`, scrolls main pane
  to top. Hero + sections re-render synchronously.
- **Search input change** → live filter on canonical name + description
  - peer ID + display name + channel.
- **Hero "Link peer"** → opens `LinkPeerDialog`.
- **Hero "Rename"** → opens `RenameCanonicalDialog` (disabled for
  system + when bootstrap not ready).
- **Hero "Delete"** → opens `DeleteCanonicalDialog` (disabled for
  system, non-empty canonicals, and when bootstrap not ready).
- **Per-peer "Unlink"** → stages `unlinkTarget` + opens
  `UnlinkPeerDialog`.
- **Nav "New"** → opens `CreateCanonicalDialog`.
- **Topbar / nav-foot Refresh** → re-fetches identity links (prototype
  bumps `fetchedAt` for relative-time freshness).
- **Modal backdrop click** → closes the dialog (except `running` phase).

## Keyboard

| Key                 | Context                                    | Behavior                                       |
| ------------------- | ------------------------------------------ | ---------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere                                   | Focus the identity-nav search input.           |
| `Esc`               | open dialog                                | Close dialog (except `running` phase).         |
| `Enter`             | inside Link / Rename / Create dialog input | Submit (if valid).                             |
| `Tab` / `Shift Tab` | inside dialog                              | Cycle focus through fields and footer buttons. |
| `Enter` / `Space`   | focused canonical row                      | Select that canonical.                         |

The mutation wizards are **non-cancellable** during the `running` phase —
both Esc and backdrop click are no-ops while the simulated 720ms timer
is in flight. Production must mirror this — the BFF call is in flight
and may have already mutated state by the time we'd want to "cancel".

## Hover

- **IdentityNav item** — bg lifts to `--ds-bg-hover`. Active item keeps
  accent inset shadow + brighter text.
- **Peer row** — border lifts to `--ds-border-2`. Stale rows stay at
  78% opacity (consistent with stale visual cue across panels).
- **Buttons (`ds-btn`)** — bg-2 → bg-hover; primary inverts to filled
  accent on hover; warn keeps warn-bg / warn-1.
- **Modal close button** — bg lifts on hover; disabled state during
  `running` phase doesn't react.

## Density

`compact` (default):

- Peer row padding `12px 14px`.
- IdentityNav item padding `10px 10px`.
- Hero padding `18px 20px`.

`cozy`:

- Peer row padding `16px 18px`.
- IdentityNav item padding `12px 12px`.
- Hero padding `22px 24px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                                        | UI                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `selectedId === null`                           | CanonicalDetail empty card with "Pick a canonical" prompt.                   |
| `selected.peers.length === 0`                   | Peer section: "No peers linked." dashed-border callout with Link CTA prompt. |
| `recentMutations` filtered to selected is empty | Recent mutations section: "No recent mutations."                             |
| Bootstrap not ready                             | Warn banner above sections; all hero actions disabled.                       |
| Link / Unlink / Rename / Delete running         | Dialog footer hidden; phase strip "Linking peer…" / etc.                     |
| Link / Unlink / Rename / Delete done            | Phase strip green check + auto-close after 480ms.                            |
| Link / Unlink / Rename / Delete error           | Phase strip red error message + retry button in footer.                      |

## Focus

- After IdentityNav item click → focus jumps to canonical-detail h1
  (so Tab descends into action buttons immediately).
- After dialog dismiss → focus returns to the trigger button.
- After Link / Rename / Delete commit → focus returns to the trigger
  button (now potentially reflecting new state).
- After Unlink commit → focus jumps to the next peer's Unlink CTA, or
  to the empty callout's CTA if list is now empty.
- After Refresh → focus stays on the Refresh button.
- ⌘K → focus the identity-nav search input from anywhere.
- Focus-visible outline on form controls uses accent ring (browser default).

## A11y semantics

- **IdentityNav**: `<aside>` with `aria-label="Canonical identities"`.
  Items use `role="tab"` + `aria-selected`. List wrapper is
  `role="tablist"`.
- **CanonicalDetail**: `<section>` with descriptive heading hierarchy
  (h1 page → h2 section).
- **Peer row**: each row is an `<article>`. Channel + peerId visible to
  screen readers. Stale state is a visible pill, not color-only.
- **Modal**: `role="dialog" aria-modal="true"` + close button has
  `aria-label="Close"`. Focus trap on mount.
- **Banner**: `role="alert"` for the bootstrap-not-ready callout.
- **Phase strip running**: `role="status"` (live region for "Linking…").
- **Phase strip error**: `role="alert"` (live region for error message).
- **HashChip**: `title` attribute exposes the labeled hash for screen
  readers ("baseHash: identity-hash-visual-2").
- **ActorChip**: `title` exposes full actor string when ellipsized.

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`

Production translation drops the panel entirely; no UI-controlled
runtime mode here (unlike settings — identity is mode-agnostic).

## Mutation behavior

- **Link** is additive — appends the peer to `canonical.peers`.
  The new peer has `lastSeenMs: null` (never seen yet) and
  `lastLinkedMs: now`.
- **Unlink** is hard delete locally + server-side. Server may keep an
  audit trail (recentMutations entry); the link is gone from
  subsequent fetches.
- **Rename** updates the canonical name only. Peers are kept; routing
  / permissions referring to the old name need separate updates
  (production should warn about this — see open question §1 in README).
- **Create** is non-destructive (no drift simulation). Produces an
  empty canonical that can be filled in later.
- **Delete** requires the canonical to be empty
  (`peers.length === 0`). Server should enforce this too.
- **All mutations** advance `configHash` on success — this becomes the
  next `baseHash`.
- **All mutations** record an entry in `recentMutations` regardless of
  success (success → `ok: true`, error → `ok: false` + `error` field).

## Cross-section coupling

- **Identity ↔ Routing**: routing rules reference canonical names. A
  rename mutation here implicitly invalidates routing rules referencing
  the old name. The prototype doesn't surface this; production should
  warn the operator before the rename succeeds.
- **Identity ↔ Permissions**: permissions also reference canonical
  names. Same invalidation concern as routing.
- **Identity ↔ Threads**: threads bind a `targetSessionKey` that is
  derived from canonical + channel + peerId. Unlinking a peer doesn't
  remove existing thread bindings; the threads panel surfaces them as
  "stale".
- **Identity ↔ Agents**: when canonical name === agentId, the
  per-agent `DeckGoAgentIdentityResponse` (avatar/emoji/name) is the
  source of truth for the canonical hero's emoji prefix.
