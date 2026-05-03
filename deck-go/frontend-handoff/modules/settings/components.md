# settings - components

## Tree

```txt
SettingsPanel
├─ SettingsHeader
│  ├─ title / contract subtitle
│  ├─ settings Badge
│  ├─ gateway/runtime Badge
│  ├─ refresh actions
│  └─ save settings Button
├─ SettingsMetrics
│  └─ MetricTile x5
├─ SettingsWorkbench
│  ├─ RuntimeEndpointCard
│  │  ├─ source/token/TLS status row
│  │  ├─ immutable SecureReadOnlyField row OR editable endpoint form
│  │  ├─ save/test actions
│  │  └─ endpoint test result seam
│  ├─ LocalSettingsCard
│  │  ├─ settings path surface
│  │  ├─ access token configured surface
│  │  ├─ appearance controls
│  │  └─ locale controls
│  ├─ DiagnosticsCard
│  │  ├─ version summary
│  │  └─ docs/GitHub links
│  ├─ NotificationsCard
│  │  └─ notification scope rows
│  └─ DevicesCard
│     ├─ pending request list
│     ├─ paired device list
│     ├─ token action strips
│     └─ action result seam
├─ ConfirmDeviceActionDialog
└─ RotatedTokenDialog
```

## Production ownership

The production panel can remain a single bounded `SettingsPanel.tsx` during this
pass if helper functions remain readable. `EndpointSection` and `ReadOnlyField`
are settings-owned helpers today and may be restyled in place. A local
`settings-panel.css` should own the visual shell instead of extending broad
`theme.css` selectors.

## Local molecules

### MetricTile

Small `label + value + optional hint` tile. This repeats previous modules and is
a promotion candidate, but remains local in this module change.

### SecureReadOnlyField

Renders `label + read-only value + optional security badge`.

Rules:

- Used for configured-token state and immutable endpoint values.
- Must not render raw token values.
- Can use a badge/icon but does not require a new atom.

### EndpointStatusSurface

Renders endpoint source, token configured state, TLS state, and mutability.

Rules:

- Editable form appears only when `capabilities.endpointMutable` is true.
- Empty token input preserves the unchanged-token sentinel.
- Endpoint test result is secondary JSON evidence.

### PreferenceStrip

Compact local controls for theme and locale.

Rules:

- Theme buttons call `setThemeMode`.
- Locale buttons call `setLocale`.
- Copy must make local-only persistence clear.

### DeviceRequestRow

Renders pending device pairing request and approve/reject actions.

Rules:

- Actions open confirmation dialog.
- Long device IDs wrap without resizing the card.

### PairedDeviceRow

Renders paired device identity, role/scope/network metadata, token summaries, and
device actions.

Rules:

- Self-device destructive actions are disabled.
- Revoked tokens disable rotate/revoke actions.

### TokenActionStrip

Renders rotate/revoke actions for each token summary.

Rules:

- Rotate may open a one-time token dialog after confirmation.
- Revoke requires confirmation.

### OneTimeTokenDialog

Renders returned rotate token with copy and close actions.

Rules:

- This is the only UI location where token values may be displayed.
- Closing clears token state.

## Atom mapping

- Use canonical `Badge`, `Button`, `Card`, `Code`, `Input`, `Select`,
  `SegmentedControl`, `Spinner`, `Toggle`, and `Modal` where they fit.
- Keep `MetricTile`, `SecureReadOnlyField`, `EndpointStatusSurface`,
  `DeviceRequestRow`, `PairedDeviceRow`, and `TokenActionStrip` local.
- Do not introduce new canonical atoms or tokens in this change.

## Class-name intent

Production CSS should preserve these semantic regions:

- `.settings-panel`
- `.settings-panel__header`
- `.settings-panel__metrics`
- `.settings-workbench`
- `.settings-endpoint-card`
- `.settings-local-card`
- `.settings-diagnostics-card`
- `.settings-notifications-card`
- `.settings-devices-card`
- `.settings-surface`
- `.settings-field`
- `.settings-device-row`
- `.settings-token-row`
- `.settings-modal`
