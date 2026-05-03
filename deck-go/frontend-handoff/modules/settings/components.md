# settings — components (v2)

## Tree

```
SettingsApp                                       [app.jsx]
├─ Topbar
│  ├─ eyebrow / title / subtitle (settings file path)
│  ├─ unsaved/saved StatusPill
│  └─ ⌘K kbd hint
├─ SettingsNav (left rail)                        [settings-nav.jsx]
│  ├─ search input
│  └─ section item × 6 (icon + label + description + dirty badge)
└─ Main column                                    [app.jsx]
   ├─ Per-section group (mounted by activeSection)
   │  ├─ IdentityGroup       — token + source pill + reveal/rotate
   │  ├─ RuntimeGroup        — mode badge + summary + read-only callout (bundled) or editable + Test (remote)
   │  ├─ AppearanceGroup     — theme + density segmented + font size + reduced motion
   │  ├─ NotificationsGroup  — desktop + sound + quiet hours pair
   │  ├─ DevicesGroup        — paired device list + last-seen + Unpair
   │  └─ VersionGroup        — KV grid (Deck / Gateway / CLI / capability snapshot / schema version)
   └─ Footer (Reset / Save)
```

## Dialogs

| Component              | Trigger                      | Body                                                        |
| ---------------------- | ---------------------------- | ----------------------------------------------------------- | ------- |
| `TestConnectionDialog` | Runtime "Test connection"    | URL/TLS/token KV + 3-phase wizard (idle → running → done    | error). |
| `RotateTokenDialog`    | Identity "Rotate" (json src) | New-token preview + 2-phase wizard (idle → running → done). |
| `UnpairDeviceDialog`   | Device row "Unpair"          | KV with IP/platform/version + warn-tone confirm.            |
| `SaveDialog`           | Footer "Save"                | Per-section dirty list + 2-phase wizard.                    |

All dialogs share `ModalShell` (Esc + backdrop click to close, focus trap on
mount). The wizard's `running` phase is non-cancellable.

## Local molecules

### SectionIcon

`<SectionIcon icon={name} />` resolves one of `IconKey` / `IconRuntime` /
`IconAppearance` / `IconBell` / `IconDevices` / `IconVersion`. Defaults
to `IconKey`.

### StatusPill

5 tones (`iron` / `accent` / `success` / `warn` / `error`), inline
icon-or-not, used everywhere a one-line status fits.

### HealthDot

Tiny colored dot for runtime health: success (green) / error (red) /
iron (gray). Wraps with a 4px halo from `--ds-success-bg` / `--ds-error-bg`.

### ModeBadge

`<ModeBadge mode="bundled" | "remote" />` — uppercase 10.5px badge
distinguishing bundled (success-toned) from remote (accent-toned).
Strong promotion candidate to design system; GatewayPanel + runtime
dashboards need the same visual cue.

### SourcePill

`<SourcePill source="env" | "json" | "missing" />` — annotates where the
access token comes from. `env` shows lock icon + accent tone; `json` is
default neutral; `missing` is error tone with alert icon.

### GroupShell

Layout primitive used by every per-section renderer. `<GroupShell title
description badge children footer />`. Keeps the section padding,
eyebrow/title/hint stack, and trailing badge consistent.

### FieldRow (settings-flavor)

Differs from config's `FieldRow` — settings rows are **curated**, not
schema-driven. Props: `label`, `hint`, `locked`, `error`, `children`.
`locked` adds `setting-row--locked` (bg-2 + opacity 0.92) and renders a
small "read-only" status pill. `error` adds `setting-row--error` border +
inline error paragraph.

## Per-section renderers

### IdentityGroup

- Source pill in header.
- Token field with reveal/hide button (masks unless toggled).
- Rotate CTA appears only when `accessTokenSource === "json"`.

### RuntimeGroup

- Mode badge + health dot in header.
- 3-cell summary strip: status / latency p50 / startedAt-or-lastConnectedAt.
- URL / token / TLS-verify rows — all `locked` when bundled.
- Bundled callout (info-tone) explaining `.env` ownership.
- Remote-only "Test connection" CTA → `TestConnectionDialog`.
- Bundled-only "Auto-start" status pill (read-only).

### AppearanceGroup

- 4 rows: theme (segmented), density (segmented), font size (number),
  reduced motion (toggle).
- All free-form keys under `settings.appearance`.

### NotificationsGroup

- 3 toggles + conditional time-pair when quiet hours enabled.
- Free-form keys under `settings.notifications`.

### DevicesGroup

- Device list with stale variant when `now - lastSeen > 5min`.
- Per-device meta grid (IP / platform / version / last seen).
- Unpair CTA per device → `UnpairDeviceDialog`.

### VersionGroup

- 5-row KV grid: Deck / Gateway / CLI / capability snapshot / schema version.
- Optional drift pill if `bootstrap.runtime.gatewayVersion` !== `version.gateway`.

## Props (production target)

```ts
type SettingsAppProps = {}; // self-contained orchestrator

type SettingsNavProps = {
  sections: { id: string; label: string; icon: string; description: string }[];
  activeSection: string;
  onSelect: (id: string) => void;
  dirtyBySection: Record<string, number>;
  query: string;
  onQueryChange: (q: string) => void;
};

type IdentityGroupProps = {
  settings: DeckGoSettings;
  onChange: (edit: { kind: "rotate-token" }) => void;
  locked: boolean;
};

type RuntimeGroupProps = {
  runtime: DeckGoRuntimeGatewayStatus;
  endpoint: DeckGoRuntimeEndpointResponse;
  onTestEndpoint: () => void;
  onChangeEndpoint: (path: string, value: unknown) => void;
  dirty: boolean;
  locked: boolean;
};

type AppearanceGroupProps = {
  settings: DeckGoSettings;
  onChange: (edit: { kind: "appearance"; path: string; value: unknown }) => void;
  locked: boolean;
};

type NotificationsGroupProps = {
  settings: DeckGoSettings;
  onChange: (edit: { kind: "notifications"; path: string; value: unknown }) => void;
  locked: boolean;
};

type DevicesGroupProps = {
  settings: DeckGoSettings;
  now: number;
  onUnpair: (deviceId: string) => void;
  locked: boolean;
};

type VersionGroupProps = {
  version: DeckGoSettingsVersionResponse;
  gatewayVersion?: string;
  capabilitySnapshotAvailable: boolean;
  schemaVersion?: string;
};
```

## Class-name intent

| Class                             | Purpose                               |
| --------------------------------- | ------------------------------------- |
| `.settings-app`                   | Top-level grid                        |
| `.settings-app__topbar`           | Header bar                            |
| `.settings-app__layout`           | Two-column workspace                  |
| `.settings-app__main`             | Right pane container                  |
| `.settings-app__footer`           | Sticky Reset/Save bar                 |
| `.settings-nav`                   | Left rail container                   |
| `.settings-nav__item--on`         | Active section                        |
| `.settings-nav__dirty`            | Per-section dirty count badge         |
| `.setting-group`                  | Per-section card                      |
| `.setting-row`                    | Curated field row                     |
| `.setting-row--locked`            | Read-only variant (bundled mode)      |
| `.setting-row--error`             | Error variant                         |
| `.runtime-summary`                | 3-cell status strip                   |
| `.runtime-bundled-callout`        | Info banner explaining .env ownership |
| `.mode-badge--bundled/remote`     | Runtime mode badge variants           |
| `.source-pill--env/json/missing`  | Token source provenance variants      |
| `.health-dot--success/error/iron` | Health indicator variants             |
| `.device-row`                     | Paired device row                     |
| `.device-row--stale`              | Last-seen > 5m variant                |
| `.version-grid`                   | KV grid for VersionGroup              |
| `.token-field` / `.token-preview` | Identity-section token controls       |
| `.modal-backdrop` / `.modal`      | Modal shell                           |
| `.phase--running/done/error`      | Mutation wizard phase rows            |
