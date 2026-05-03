# settings - interactions

## Pointer

- Save settings calls `saveSettings(buildSettingsSavePayload(settings))`.
- Refresh settings calls `fetchSettings`.
- Refresh runtime calls `refreshRuntimeSummary`.
- Endpoint save/test delegates to `EndpointSection` only when the endpoint is
  mutable; immutable bundled endpoints render read-only state without a test
  action.
- Theme controls call `setThemeMode("dark" | "light" | "system")`.
- Locale controls call `setLocale("en" | "zh")`.
- Refresh devices calls `fetchDevices` and `fetchSelfDevice`.
- Approve/reject/remove/rotate/revoke open confirmation before API calls.
- Copy token writes the one-time rotated token to clipboard when available.

## Keyboard

- All buttons are reachable by Tab and use canonical focus styles.
- Editable endpoint inputs use native input behavior.
- TLS verify uses native checkbox or canonical toggle semantics.
- Confirmation and token dialogs use `role="dialog"` and `aria-modal="true"`.
- Dialog close/cancel buttons are first-class actions.

## Hover and focus

- Device rows may strengthen border/background on hover.
- Focus-visible outlines must use `--ds-accent`.
- Destructive actions use danger styling.

## Loading

- Keep previous settings/devices visible while refresh is loading.
- Use small status badges/spinners; do not block the whole panel.

## Empty

- No pending devices: omit the pending request surface or show a compact empty
  row.
- No paired devices: show the existing localized empty copy.
- No version field: show `notAvailable`.

## Error

- Settings load/save errors render in the local settings area.
- Endpoint errors render inside endpoint card.
- Device action/load errors render inside devices card or confirmation dialog.

## Responsive

- Desktop: top metrics, endpoint/local settings left, diagnostics/notifications/
  devices right.
- Mid-width: cards stack into one column.
- Narrow: control strips wrap; device rows and code seams remain scrollable.
