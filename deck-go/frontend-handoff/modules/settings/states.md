# settings — states (v2)

## Top-level state

```ts
{
  // Section navigation
  activeSection: "identity" | "runtime" | "appearance" | "notifications" | "devices" | "version",
  navQuery: string,                          // section-nav search filter

  // Draft state
  draftSettings: DeckGoSettings,             // appearance + notifications + pairedDevices edits live here
  draftEndpoint: DeckGoRuntimeEndpointResponse,
  endpointDirty: boolean,                    // tracks whether the endpoint draft diverges from baseline

  // Server-side snapshot
  bootstrap: DeckGoBootstrapStatusResponse,  // includes runtime + gateway connection state
  recentSaves: SaveEvent[],                  // last 8 saves (BFF projection)

  // Mutation lifecycle
  dialog: { kind: "test-connection" | "rotate-token" | "unpair" | "save"; device? } | null,

  now: number,                               // for relative-time formatting
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
  runtimeMode: "bundled" | "remote",         // toggles fixture between bundled/remote runtime
}
```

## Runtime mode states

Two top-level behaviors gate every interactive control in the Runtime
section:

| `bootstrap.runtime.mode` | Locked fields                             | Editable fields                         | Editable destination                |
| ------------------------ | ----------------------------------------- | --------------------------------------- | ----------------------------------- |
| `"bundled"`              | URL, token, TLS, autoStart, command, bind | (none — all 4 settings rows are locked) | n/a (operator edits .env + restart) |
| `"remote"`               | (none)                                    | URL, token, tlsVerify                   | `PUT /api/runtime/endpoint`         |

Switching between fixtures (Tweaks toggle) re-renders the same
`RuntimeGroup` component but feeds different `runtime` + `endpoint` props.
The component reads `runtime.mode` and applies the lock visually +
functionally.

## Per-section dirty composition

`dirtyBySection` is computed from a shallow comparison:

| Section         | Compared keys                                                         | Source                       |
| --------------- | --------------------------------------------------------------------- | ---------------------------- |
| `identity`      | (n/a — token rotation triggers a save event, no field-level diff)     | recent-saves projection only |
| `runtime`       | `endpointDirty` flag (URL / token / tlsVerify diverged from baseline) | `endpointDirty`              |
| `appearance`    | All keys in `draftSettings.appearance`                                | shallow-vs-baseline          |
| `notifications` | All keys in `draftSettings.notifications`                             | shallow-vs-baseline          |
| `devices`       | (n/a — unpair triggers a save event, not a draft)                     | mutation-only                |
| `version`       | (n/a — read-only)                                                     | none                         |

The footer Save button is enabled when `dirtyTotal > 0`. Reset only
clears `appearance` / `notifications` / `endpoint` drafts — pending
unpair / rotate dialogs are not "drafts" and are dismissed via their
own Cancel buttons.

## Bootstrap states

The bootstrap response feeds three independent slots:

- `bootstrap.settings` — file presence, token configured, command
  configured, autoStart. Used to render an EmptyState if `path` is missing
  (production target — prototype always seeds `exists: true`).
- `bootstrap.runtime` — runtime supervisor status (mode/status/health/url/...).
  Drives the RuntimeGroup completely.
- `bootstrap.gateway` — connection-side facts (connected, methodCount,
  schemaVersion). Drives the VersionGroup capability/schema rows.

When `bootstrap.gateway.connected === false`, the topbar shows an error
StatusPill ("Gateway disconnected") and the runtime summary status reads
"connecting…" instead of latency.

## Identity states

| `accessTokenSource` | UI                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `"env"`             | Token row locked + accent SourcePill "from .env" + no Rotate CTA.                                                 |
| `"json"`            | Token row editable-style (still masked) + neutral "from JSON" pill + Rotate CTA visible.                          |
| `"missing"`         | Token row shows "(not configured)" + error SourcePill "missing" + an EmptyState below prompting to set the token. |

Reveal toggle never reveals the actual token value — only a stylized
masked form `"openclaw_at_••••3a91"`. Production should also avoid
returning the raw token; mask in BFF if possible.

## Dialog flows

### TestConnectionDialog

```
opened ─[Cancel]─▶ closed
       ─[Run test]─▶ running ─(820ms)─▶ done   ─[Done]─▶ closed
                                       └─▶ error (18% simulated TLS fail) ─[Test again]─▶ running
                                                                          └─[Done]─▶ closed
```

Production: POST `/api/runtime/endpoint/test` with the current draft.
Returns `DeckGoRuntimeEndpointTestResponse`. Render `latencyMs`,
`gatewayVersion`, `tlsVerified`.

### RotateTokenDialog

```
opened ─[Cancel]─▶ closed
       ─[Rotate]─▶ running ─(720ms)─▶ done ─(600ms)─▶ closed (parent records save event)
```

Production: POST `/api/settings/rotate-token` (TBD endpoint — see open
question §3 in README). Server returns the new token; UI may surface it
once for copying, then never again.

### UnpairDeviceDialog

Stateless. Confirm or cancel. On confirm, parent removes the device from
`draftSettings.pairedDevices` and posts the change as part of a Save.

### SaveDialog

```
opened ─[Cancel]─▶ closed
       ─[Save]──▶ running ─(720ms)─▶ done ─(480ms)─▶ closed (parent commits draft + records save event)
```

Production: POST `/api/settings` with the full draft. If endpointDirty,
also PUT `/api/runtime/endpoint`. Both must succeed — if endpoint write
fails, settings save still records but runtime row regains its dirty
flag with an error banner.

## Error states (production target)

| Error                                          | UI                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| GET `/api/settings` 5xx                        | full-width retry overlay                                                     |
| POST `/api/settings` 4xx/5xx                   | dialog stays open in `phase--error`; retry button surfaces                   |
| PUT `/api/runtime/endpoint` 409                | endpoint row inline error: "Endpoint changed concurrently. Refresh & retry." |
| Test connection failure                        | dialog `phase--error`; runtime summary shows last-error sentence             |
| Bundled mode but `runtime.status === "failed"` | Runtime summary shows error tone + lastError + "Edit .env and restart" hint  |
| Token rotate failure                           | dialog `phase--error`; suggests Refresh & try again                          |

## A11y / focus rules

- After SettingsNav item click → focus jumps to the group's title h2.
- After dialog dismiss → focus returns to the trigger button.
- After Save → focus returns to the Save button (which is now disabled).
- After Reset → focus returns to the section nav search.
- ⌘K → focus the section nav search input from anywhere.
- Bundled-mode locked rows still receive Tab focus on labels (so screen
  readers can read the description), but the inputs are `readOnly` /
  `disabled` — they don't receive focus.

## Boundary cases

- **bundled with `runtime.status === "failed"`**: the Runtime summary
  cells show `failed · unhealthy`, the bundled callout banner adds an
  error tint, and the Auto-start row reads "Disabled". No edit lane.
- **remote with `runtime.status === "failed"`**: the URL/token rows are
  editable, and the Test button is enabled — operator must repair the
  endpoint to recover.
- **`pairedDevices.length === 0`**: DevicesGroup shows an EmptyState card
  ("No devices paired. Pair a device by entering this access token in the
  mobile app.").
- **`recentSaves.length === 0`**: footer omits the "Last saved" status.
- **`endpointDirty === true && bundled`**: cannot happen — all bundled
  inputs are `readOnly`. If somehow encountered (URL race), the dirty
  flag is reset on the next bootstrap fetch.

## Theme variants

- `data-theme="dark"` (default) — uses canonical `--ds-*` palette.
- `data-theme="light"` (Tweaks demo only) — overrides body via the
  `[data-theme="light"]` block. Production will flip the entire token
  set, not just body — this is a visual sanity stub, not a complete
  theme.
