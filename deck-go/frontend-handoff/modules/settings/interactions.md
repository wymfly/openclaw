# settings — interactions (v2)

## Pointer

- **SettingsNav item click** → switches `activeSection`, scrolls main pane
  to top. Section title + description update synchronously.
- **Field control change** (input / select / toggle / segmented) → live
  updates draftSettings or draftEndpoint; per-section dirty count + topbar
  pill update in real time.
- **Identity "Reveal" / "Hide"** → toggles masked vs styled-masked render.
  Even on Reveal, the actual token never leaves a stylized form
  (`"openclaw_at_••••3a91"`).
- **Identity "Rotate"** → opens `RotateTokenDialog` (only when source = json).
- **Runtime "Test connection"** → opens `TestConnectionDialog` (remote-only).
- **Device "Unpair"** → opens `UnpairDeviceDialog`.
- **Footer "Reset"** → drops all draftSettings + draftEndpoint changes.
  No confirmation dialog (lower-stakes than apply config).
- **Footer "Save"** → opens `SaveDialog`.
- **Modal backdrop click** → closes the dialog (except `running` phase).

## Keyboard

| Key                 | Context                  | Behavior                                   |
| ------------------- | ------------------------ | ------------------------------------------ |
| `⌘K` / `Ctrl K`     | anywhere                 | Focus the section-nav search input.        |
| `Esc`               | open dialog              | Close dialog (except `running` phase).     |
| `Enter` / `Space`   | focused segmented option | Select that option.                        |
| `Tab` / `Shift Tab` | inside group             | Cycle through field controls in DOM order. |

The dialog wizards are **non-cancellable** during the `running` phase —
both Esc and backdrop click are no-ops while the simulated 720ms timer
is in flight. Production must mirror this — server has likely already
mutated state by the time we'd want to "cancel".

## Hover

- **SettingsNav item** — bg lifts to `--ds-bg-hover`. Active item keeps
  accent inset shadow + brighter text.
- **Setting row controls** — input/select focus uses `--ds-accent-1`
  border + 2px accent-bg ring.
- **Segmented option** — text brightens; selected stays bg-0 with accent
  inset border.
- **Buttons (`ds-btn`)** — bg-2 → bg-hover; primary inverts to filled
  accent on hover; warn keeps warn-bg / warn-1.
- **Bundled callout** — no hover state (decorative info banner).
- **Locked setting rows** — no hover; cursor stays default. The
  `readOnly` inputs surface a `cursor: default` instead of text caret.

## Density

`compact` (default):

- Setting row padding `12px 14px`.
- SettingsNav item padding `10px 10px`.
- Inputs `6px 9px`.

`cozy`:

- Setting row padding `16px 16px` + 8px gap.
- SettingsNav item padding `12px 12px`.
- Inputs `8px 11px`.

The Tweaks panel toggles between the two via `data-density` on the root.

## Empty / loading / error

| Scenario                         | UI                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dirtyTotal === 0`               | Footer Save + Reset buttons disabled.                                                                                                                                                 |
| Bundled mode, all runtime fields | Each setting row shows a `read-only` StatusPill + locked styling.                                                                                                                     |
| Bundled mode banner              | Info-tone callout below runtime rows: "All runtime fields are managed by .env. To rotate the token, change the bind interface, or disable auto-start, edit .env and restart deck-go." |
| Section search zero results      | SettingsNav: "No sections match." inline empty row                                                                                                                                    |
| Test connection running          | Dialog footer hidden; "Connecting…" phase pill shown                                                                                                                                  |
| Test connection done (success)   | Footer offers Test again / Done; phase shows OK + latency + version                                                                                                                   |
| Test connection error            | Footer offers Test again / Done; phase shows red error message                                                                                                                        |
| Save running                     | Dialog footer hidden; "Saving…" phase pill shown                                                                                                                                      |
| Save done                        | Green check + "Saved. Closing…" then closes                                                                                                                                           |
| Token rotate running             | Dialog footer hidden; "Rotating…" pill shown                                                                                                                                          |
| Empty paired devices             | Devices group: "No devices paired." EmptyState (production target — prototype seeds 3)                                                                                                |
| Token source = "missing"         | Identity row "(not configured)" placeholder + error SourcePill                                                                                                                        |

## Focus

- After SettingsNav item click → focus jumps to group `<h2>` (so Tab
  descends into fields immediately).
- After dialog dismiss → focus returns to the trigger button.
- After Save → focus stays on the Save button (now disabled).
- After Reset → focus returns to SettingsNav search input.
- After expanding a `details` element via keyboard (if any are added
  later) → focus stays on summary.
- Focus-visible outline on form controls uses accent ring (browser default).

## A11y semantics

- SettingsNav: `<aside>` with `aria-label`. Items use `role="tab"` +
  `aria-selected`.
- SettingGroup: `<article>` with descriptive heading hierarchy
  (h1 page → h2 section).
- Setting row: `<label>` for the field; `aria-describedby` points at hint
  paragraph; locked rows use the visible "read-only" pill rather than
  `aria-readonly` so SR users hear the state explicitly.
- Modal: `role="dialog" aria-modal="true"` + close button has
  `aria-label="Close"`.
- Status pills: text content names the state (no color-only signal).
- Health dot: `aria-label="Health: healthy"` on the wrapper span (the dot
  itself is decorative).
- Mode badge: text label `BUNDLED` / `REMOTE` is part of accessible name.
- Source pill: text + icon both used; SR users hear "from .env" / "from
  JSON" / "missing".
- Bundled callout: information-tone icon + paragraph; not a `role="alert"`
  (it's persistent state, not a transient announcement).

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`
- `runtimeMode` ∈ `bundled | remote` — switches the runtime fixture so
  reviewers can see both lock states without code changes.

Production translation drops the panel entirely; equivalent state arrives
from `/api/bootstrap/status` (mode comes from server, not from a UI
toggle).

## Mutation behavior

- **Save** is idempotent — re-saving the same draft is a no-op on the
  server but records a save event regardless. UI silently de-dups when
  `dirtyTotal === 0`.
- **Reset** is non-destructive in spirit: it discards the draft, but the
  server-side state (the last applied snapshot) is unchanged. There is
  no undo for the discard itself; users would need to re-edit.
- **Rotate token** is destructive — the previous token is revoked and any
  paired devices using it are disconnected. The new token must be copied
  before the dialog closes (production should let users copy once via a
  one-time reveal that disappears on next page load).
- **Unpair device** is hard delete locally + server-side. To restore, the
  device must re-pair from scratch.
- **Test connection** is read-only; it does not mutate any state. Safe
  to spam.
- **Endpoint PUT** is idempotent on success; on 409 (concurrent edit), the
  UI must refetch and present the conflict.

## Cross-section coupling

- **Identity ↔ Devices**: rotating the token disconnects every paired
  device. The DeviceGroup shows them as `stale` until they re-pair.
- **Runtime ↔ Version**: when `bootstrap.runtime.gatewayVersion`
  diverges from `version.gateway` (BFF reported), the VersionGroup
  surfaces a drift pill on the Gateway row.
- **Bundled mode ↔ Topbar**: bundled-mode topbar subtitle hardcodes
  the path to the `.env` file (`bootstrap.settings.path` + ".env hint")
  so operators know exactly where to edit.
