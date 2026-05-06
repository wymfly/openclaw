# identity — high-fidelity handoff (v2)

**Status:** `implemented — mock verified; real-stack handoff-blocked by OpenClaw runtime deps staging`
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)

`identity/` is the **deck-go canonical ↔ channel-peer registry**. It maps real-world
people / shared accounts ("canonicals") to channel-specific peer ids
(Telegram chat ids, Discord snowflakes, Slack U-ids, WeCom user ids,
email addresses) so that routing, permissions, and audit can refer to a
single stable name regardless of which channel a message arrives on.

The hard rule: this is a **registry**, not a transcript or profile.
Mutations are guarded by **baseHash** optimistic concurrency, and the
canonical name is the routing-stable identifier (renaming requires
updating dependent routing/permissions separately).

## File inventory

| File                      | Purpose                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~24-line shell loading React + Babel + 6 jsx + 2 css.                                                                                                |
| `data.js`                 | Mock fixture: 5 canonicals + 8 peers across 5 channels + 4 recentMutations + bootstrap status + agent profile.                                       |
| `icons.jsx`               | 24+ SVG icons + per-channel icons (telegram/discord/slack/wecom/email) + `ChannelPill` + `StatusPill` (5 tones) + `HashChip` + `ActorChip`.          |
| `identity-nav.jsx`        | Left rail: searchable canonical list + per-canonical peer count badge + create-canonical CTA.                                                        |
| `canonical-detail.jsx`    | Right pane: canonical hero + peer list + recent-mutations list.                                                                                      |
| `dialogs.jsx`             | `LinkPeerDialog` (3-phase wizard) + `UnlinkPeerDialog` + `RenameCanonicalDialog` + `CreateCanonicalDialog` + `DeleteCanonicalDialog` + `ModalShell`. |
| `app.jsx`                 | `IdentityApp` orchestrator + draft state + ⌘K + dialog lifecycle + 12% simulated 409 baseHash drift on every mutation.                               |
| `styles.css`              | Two-pane workspace + identity nav + canonical hero + peer list + mutation list + modal shell + density variants + light theme stub.                  |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                                                 |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density).                                                                                                             |
| `prototype-v1-codex.html` | Original Codex single-file prototype (430 lines).                                                                                                    |
| `implementation-notes.md` | Implementation matrix, code-truth fixes, smoke evidence, and residual risks from the production rewrite.                                             |

## Contract truth (today)

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export interface DeckGoIdentityPeer {
  channel: string;
  peerId: string;
}

export interface DeckGoIdentityLink {
  canonical: string;
  peers: DeckGoIdentityPeer[];
}

export interface DeckGoIdentityLinksResponse {
  links: DeckGoIdentityLink[];
  configHash?: string;
}

export interface DeckGoAgentIdentityResponse {
  agentId: string;
  name?: string;
  avatar?: string;
  emoji?: string;
}
```

Endpoints in the contract today:

- `GET  /api/deck/identity` → `DeckGoIdentityLinksResponse`
- `POST /api/deck/identity` → updates link set (baseHash-guarded; 409 on drift)
- `GET  /api/agents/{agentId}/identity` → `DeckGoAgentIdentityResponse` (per-agent profile)

The Gateway-typed client surfaces three methods today: `deck.identity.list`,
`deck.identity.link`, `deck.identity.unlink`. **Rename / create / delete
canonical are not yet in the contract** — see open questions below.

## Contract-reality scope correction

The **PRD originally listed** sections "Profile / API Keys (with last-used + revoke)
/ Active Sessions / Audit log". The contract reality:

- **There is no user profile / API key / session / audit-log surface in
  the contract.** That's a SaaS-style identity panel — deck-go's identity
  endpoint is a **peer-mapping registry**.
- **Canonical** is the routing-stable identifier (e.g. `main`,
  `team-builder`, `oncall-rotation`, `system`). It maps to a list of
  channel peers (Telegram chat ids, Discord snowflakes, etc.).
- **Mutations are baseHash-guarded** — same pattern as `config` panel.
  The PRD's "API Keys" model (CRUD with revoke + last-used) doesn't
  apply; the analogue here is "link / unlink peer" with
  optimistic-concurrency guard.
- **Active sessions / audit log** are not in this panel. Audit-style
  data (who linked which peer when) is the **recent-mutations** strip,
  which is BFF-projected from the mutation log — not a contract field.
- **Per-agent profile** (avatar/emoji/name) is a separate endpoint
  (`GET /api/agents/{agentId}/identity`) — the prototype surfaces the
  emoji on the canonical hero when canonical name matches agentId, but
  the broader profile UX lives elsewhere (likely under `agents` panel).

v2 reflects the contract: a two-pane workbench — canonical list (left)

- canonical detail (right) with peers + mutation history.

## Mutation model (baseHash optimistic concurrency)

Every mutation submits the current `configHash` as `baseHash`:

| Mutation           | UI surface            | Required state                       | Server behavior                             | Contract today                                               |
| ------------------ | --------------------- | ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------ |
| `link-peer`        | LinkPeerDialog        | canonical exists, channel + peerId   | append peer to canonical's peer list        | ✅ `deck.identity.link`                                      |
| `unlink-peer`      | UnlinkPeerDialog      | peer must exist on canonical         | remove peer; canonical kept (may go empty)  | ✅ `deck.identity.unlink`                                    |
| `rename-canonical` | RenameCanonicalDialog | canonical exists, new name unique    | update canonical name only; peers unchanged | ⚠️ prototype-assumed (no contract method)                    |
| `create-canonical` | CreateCanonicalDialog | name unique                          | append empty canonical                      | ⚠️ prototype-assumed (implied by POST link of new canonical) |
| `delete-canonical` | DeleteCanonicalDialog | canonical empty (peers.length === 0) | remove canonical                            | ⚠️ prototype-assumed (no contract method)                    |

Server returns the new `configHash` after every successful mutation —
this becomes the next `baseHash`. If client's submitted `baseHash`
doesn't match server's current, server returns 409 → UI re-fetches and
prompts the operator to retry.

The prototype simulates a **12% drift rate** per mutation to exercise
the error path.

`system` canonical is **immutable** in the prototype (cannot rename or
delete) — production must enforce this server-side too.

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState` (used implicitly by topbar + canonical-detail empty card).

`@/design-system/icons`:

- `IconRefresh`, `IconPlus`, `IconMinus`, `IconLink`, `IconUnlink`,
  `IconEdit`, `IconTrash`, `IconClose`, `IconCheck`, `IconAlert`,
  `IconSearch`, `IconHash`, `IconClock`, `IconUser`, `IconUsers`,
  `IconShield`, `IconCopy`.

Per-channel icons (`IconTelegram`, `IconDiscord`, `IconSlack`,
`IconWecom`, `IconMail`) and `ChannelPill` / `HashChip` / `ActorChip`
stay local to `identity/` initially. **`ChannelPill` is a strong
promotion candidate** — channels, threads, and routing panels all need
the same per-channel visual cue.

## How to implement

1. Open `prototype.html` in a static server. Walk every state via the
   Tweaks panel (theme; density). Fire each mutation; observe the 12%
   simulated 409 surface.
2. Translate to `frontend-new/src/components/panels/identity/` keeping
   the class-name shape (`identity-nav__*`, `peer-row__*`,
   `canonical-detail__*`, `mutation-row__*`, `channel-pill--*`).
3. Wire real fetcher in `frontend-new/src/api/identity.ts`:
   - `fetchIdentityLinks()` → `GET /api/deck/identity`
   - `linkIdentityPeer(canonical, channel, peerId, baseHash)` → `POST /api/deck/identity` with `action: "link"`
   - `unlinkIdentityPeer(canonical, channel, peerId, baseHash)` → `POST /api/deck/identity` with `action: "unlink"`
   - On 409, refetch and surface conflict UI.
4. Hardcoded literal strings get extracted to
   `frontend-new/src/i18n/{en,zh}.json`.
5. **Rename / create / delete canonical** require contract additions
   (see open questions §1). Until then, surface those CTAs as disabled
   with explanatory tooltip, OR stage as "synthetic" mutations layered
   over link/unlink primitives (rename = create-new + relink-all +
   delete-old; risky under concurrency).
6. **Per-channel icons** should be promoted to
   `@/design-system/icons` as a sub-namespace
   (`IconChannelTelegram` etc.) — channels and threads panels need the
   same set.
7. **System canonical immutability** — UI disables rename/delete on
   `system`, but BFF must reject these mutations server-side too. The
   UI is not a source of truth.

## Open questions for follow-up

1. **Rename / create / delete canonical** are not in the contract.
   Production needs at minimum:
   - `POST /api/deck/identity` with `action: "rename"` (params: `canonical`, `newName`, `baseHash`)
   - `POST /api/deck/identity` with `action: "create"` (params: `canonical`, optional description, `baseHash`)
   - `POST /api/deck/identity` with `action: "delete"` (params: `canonical`, `baseHash`; must error if peers.length > 0)
     These extend the existing `POST /api/deck/identity` action surface.
2. **Atomic batch mutations** — the prototype models each
   link/unlink/rename as a single mutation. Production may want
   transaction-style batched updates ("link these 3 peers as part of
   one rename"). Should the contract gain a `POST
/api/deck/identity/batch` endpoint?
3. **`recentMutations`** is BFF-projected — there is no contract for an
   identity audit log. Should the contract add `GET
/api/deck/identity/mutations?limit=N`?
4. **`peer.lastSeenMs` / `lastLinkedMs` / `actor`** are not in
   `DeckGoIdentityPeer`. The prototype assumes BFF enriches each peer
   with these fields. Should the contract declare a
   `DeckGoIdentityPeerWithActivity` extension, or stay minimal at the
   wire and add a sibling `GET /api/deck/identity/activity` endpoint?
5. **Channel taxonomy lock** — the prototype hardcodes 5 channels
   (telegram/discord/slack/wecom/email). The contract leaves `channel`
   as `string`. Should the contract enum the supported channels, or
   keep it open for plugin-provided channels?
6. **System canonical immutability** is a UI-only assumption. Should
   the contract declare a `system` reserved name, or use a `protected:
true` flag on each link?
