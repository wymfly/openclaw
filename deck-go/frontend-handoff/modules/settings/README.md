# settings — high-fidelity handoff (v2)

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Protocol version:** `protocol-v1`
**Visual target:** [`./prototype.html`](./prototype.html) (multi-file Babel React)
**V1 archive:** [`./prototype-v1-codex.html`](./prototype-v1-codex.html)
**Verification notes:** [`./implementation-notes.md`](./implementation-notes.md)

`settings/` is the **deck-go operator preferences panel**. It pairs identity
& access (token + source provenance), runtime (bundled vs remote Gateway),
appearance, notifications, paired devices, and version into a single
left-rail/right-pane workbench.

The hard rule: in **bundled** runtime mode, every runtime field is
**read-only** — URL, token, command, bind, autoStart all come from `.env`
and the supervisor owns the lifecycle. In **remote** mode, URL/token/tlsVerify
become editable and writes go to `deck-go-settings.json`.

## File inventory

| File                      | Purpose                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prototype.html`          | ~26-line shell loading React + Babel + 6 jsx + 2 css.                                                                                                      |
| `data.js`                 | Mock fixture: settings + bundledRuntime + remoteRuntime + bootstrap status + remoteEndpoint + 3 paired devices + version + 6 sections + 3 recentSaves.     |
| `icons.jsx`               | 24 SVG icons + `SectionIcon` + `StatusPill` (5 tones) + `HealthDot` + `ModeBadge` (bundled/remote) + `SourcePill` (env/json/missing).                      |
| `settings-nav.jsx`        | Left rail: searchable section list + per-section dirty count badge.                                                                                        |
| `setting-group.jsx`       | Per-section curated renderers — Identity / Runtime / Appearance / Notifications / Devices / Version. Bundled mode read-only enforcement lives here.        |
| `dialogs.jsx`             | `TestConnectionDialog` (3-phase wizard) + `RotateTokenDialog` + `UnpairDeviceDialog` + `SaveDialog` + `ModalShell`.                                        |
| `app.jsx`                 | `SettingsApp` orchestrator + draft state + bundled/remote fixture switch + ⌘K + dialog lifecycle.                                                          |
| `styles.css`              | Two-pane workspace + group shells + setting rows + segmented + token field + runtime summary + bundled callout + device list + version grid + modal shell. |
| `tokens.css`              | Mirror of canonical `--ds-*` tokens.                                                                                                                       |
| `tweaks-panel.jsx`        | Design-time state knobs (theme/density/runtimeMode).                                                                                                       |
| `prototype-v1-codex.html` | Original Codex single-file prototype.                                                                                                                      |

## Contract truth

```ts
// from deck-go/contracts/source/deck-api.contract.ts
export interface DeckGoSettings {
  accessTokenConfigured?: boolean;
  accessTokenSource?: string; // "env" | "json" | "missing"
  appearance?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  pairedDevices?: Array<Record<string, unknown>>;
}

export interface DeckGoSettingsResponse {
  ok: boolean;
  settings: DeckGoSettings;
  path: string; // file location of deck-go-settings.json
}

export interface DeckGoSettingsSaveResponse {
  ok: boolean;
  settings: DeckGoSettings;
}

export interface DeckGoSettingsConnectionResponse {
  ok?: boolean;
  error?: string;
}

export interface DeckGoSettingsVersionResponse {
  deck?: string;
  gateway?: string;
  cli?: string;
}

export interface DeckGoBootstrapStatusResponse {
  ok: boolean;
  settings: DeckGoBootstrapSettingsStatus;
  runtime: DeckGoRuntimeGatewayStatus; // mode: "bundled" | "remote"
  gateway: DeckGoBootstrapGatewayStatus;
}

export interface DeckGoRuntimeEndpointResponse {
  url: string;
  tokenConfigured: boolean;
  tlsVerify: boolean;
  source: "env" | "json";
}

export interface DeckGoRuntimeEndpointTestResponse {
  ok: boolean;
  latencyMs?: number;
  gatewayVersion?: string;
  tlsVerified: boolean;
  error?: string;
}
```

Endpoints:

- `GET  /api/settings` → `DeckGoSettingsResponse`
- `PUT  /api/settings` → `DeckGoSettingsSaveResponse`
- `POST /api/settings/test-connection` → `DeckGoSettingsConnectionResponse`
- `GET  /api/settings/version` → `DeckGoSettingsVersionResponse`
- `GET  /api/bootstrap/status` → `DeckGoBootstrapStatusResponse`
- `GET  /api/runtime/endpoint` → `DeckGoRuntimeEndpointResponse`
- `PUT  /api/runtime/endpoint` → updates remote endpoint config
- `POST /api/runtime/endpoint:test` → `DeckGoRuntimeEndpointTestResponse`

## Runtime-mode contract (CRITICAL)

The settings panel is on the front line of the runtime-mode decoupling
refactor (see `docs/superpowers/specs/2026-04-28-runtime-mode-decoupling-design.md`).
Two sharp rules govern behavior:

| Mode      | What's read-only in UI                               | What's editable                           | Persistence                                             |
| --------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `bundled` | URL, token, command, bind, autoStart, restart-policy | Appearance, notifications, paired devices | `.env` (operator runs deck-go from a configured shell). |
| `remote`  | (nothing forced read-only)                           | URL, token, tlsVerify + everything else   | `deck-go-settings.json` (overrides .env defaults).      |

Bundled mode reads `RUNTIME_MODE=bundled` plus all the bundled-required
env vars (gateway command/args, token, bind, autoStart) at boot. The UI
observes the supervisor; it does not control it.

Remote mode reads `RUNTIME_MODE=remote` + endpoint env defaults; the UI
can edit URL/token/tlsVerify and the writes flow through to the JSON
config.

## Contract-reality scope correction

The **PRD originally listed** sections "General/Appearance/Runtime/Keybindings/Privacy".
The contract reality:

- **Identity & access** is a first-class section because the contract has
  `accessTokenConfigured` + `accessTokenSource` and the runtime-mode
  refactor makes token provenance a UX concern.
- **Keybindings** has no contract surface; deferred to a future panel
  (likely lives under `appearance.keybindings: Record<string, unknown>` in
  the open Record).
- **Privacy** also has no contract surface; deferred.
- **Devices** is first-class because `pairedDevices: Array<Record<string,
unknown>>` exists in the contract.
- **Version** is first-class because `DeckGoSettingsVersionResponse` is its
  own endpoint.

v2 reflects the contract: 6 sections (Identity / Runtime / Appearance /
Notifications / Devices / Version).

## Depends on canonical patterns / icons

`@/design-system/patterns`:

- `PageShell`, `EmptyState`, `SectionHeader` (used implicitly by topbar +
  group shells).

`@/design-system/icons`:

- `IconKey`, `IconRuntime`, `IconAppearance`, `IconBell`, `IconDevices`,
  `IconVersion`, `IconRefresh`, `IconSave`, `IconUndo`, `IconClose`,
  `IconCheck`, `IconAlert`, `IconLock`, `IconEye`, `IconEyeOff`,
  `IconArrowOut`, `IconClock`, `IconUser`, `IconSearch`, `IconCopy`,
  `IconWand`, `IconLink`, `IconUnlink`.

`SectionIcon`, `StatusPill`, `HealthDot`, `ModeBadge`, `SourcePill` stay
local to `settings/`. `ModeBadge` is a strong promotion candidate —
GatewayPanel and runtime-related panels need the same bundled/remote
visual cue.

## How to implement

1. Open `prototype.html` in a static server. Walk every state via the Tweaks
   panel (theme; density; runtimeMode bundled↔remote).
2. Translate to `frontend-new/src/components/panels/settings/` keeping the
   class-name shape (`setting-row__*`, `runtime-summary__*`,
   `device-row__*`, `version-grid__*`, `mode-badge--*`).
3. Wire real fetcher in `frontend-new/src/api/settings.ts`:
   - `fetchSettings()` → `GET /api/settings`
   - `saveSettings(draft)` → `PUT /api/settings`
   - `testSettingsConnection(url, token)` → `POST /api/settings/test-connection`
   - `fetchVersion()` → `GET /api/settings/version`
   - `fetchBootstrap()` → `GET /api/bootstrap/status`
   - `fetchRuntimeEndpoint()` → `GET /api/runtime/endpoint`
   - `setRuntimeEndpoint({url, token, tlsVerify})` → `PUT /api/runtime/endpoint`
   - `testEndpoint(payload?)` → `POST /api/runtime/endpoint:test`
4. Hardcoded literal strings get extracted to `frontend-new/src/i18n/{en,zh}.json`.
5. **Bundled mode read-only enforcement** must happen in the
   `RuntimeGroup` component AND on the BFF — UI is not a source of truth.
   Even if a hand-crafted PUT bypasses the locked input, the BFF must
   reject the mutation in bundled mode.
6. Source pill (`SourcePill`) reads `accessTokenSource` from settings; this
   determines whether the rotate-token CTA renders.

## Open questions for follow-up

1. **Recent saves** is BFF-projected — there is no contract for a settings
   audit log. Should the contract add `GET /api/settings/saves?limit=N`?
2. **`pairedDevices`** is `Array<Record<string, unknown>>`. The prototype
   assumes `{ id, name, lastSeen, ip, platform, version }`. Should the
   contract declare a typed `DeckGoPairedDevice`?
3. **Access-token rotation** has no contract endpoint. Device-token
   rotation is supported through `POST /api/devices/token/rotate`, but
   rotating the deck access token itself remains a future contract.
4. **Quiet hours** — the prototype assumes `notifications.quietHoursEnabled
/ quietHoursStart / quietHoursEnd` keys. The contract is open
   (`Record<string, unknown>`). Should hours be normalized to a single
   `{ enabled, range: [start, end] }` object?
5. **Bundled-mode supervisor commands** — to restart bundled supervisor or
   change `.env`-sourced fields, the user is told to "edit .env and
   restart". Is there a lighter-touch surface (e.g. `POST
/api/runtime/bundled/restart`) for supervised restart without a manual
   shell session?

## Reverse sign-off

| Field                          | Value                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `needs-revision`                                                                                                                |
| Reviewer                       | Codex                                                                                                                           |
| Date                           | 2026-05-06                                                                                                                      |
| Prototype reference            | `frontend-handoff/modules/settings/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/settings/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`settings`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`settings`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`settings`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/settings/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.
