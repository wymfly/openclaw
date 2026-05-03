# settings - API usage

## Deck-facing API

### `GET /settings`

Wrapper: `fetchSettings()`.

Response:

```ts
type DeckGoSettingsResponse = {
  ok: boolean;
  settings: DeckGoSettings;
  path: string;
};
```

Usage rules:

- Render `accessTokenConfigured` and `accessTokenSource` as status only.
- Do not expect or render raw access-token values.

### `PUT /settings`

Wrapper: `saveSettings(settings)`.

Allowed payload:

```ts
{
  appearance?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  pairedDevices?: Array<Record<string, unknown>>;
}
```

Usage rules:

- Do not send access-token or runtime-managed fields.
- Keep `buildSettingsSavePayload` behavior protected by tests.

### `GET /settings/version`

Wrapper: `fetchSettingsVersion()`.

Response fields: `deck`, `gateway`, `cli`.

### Runtime endpoint

Wrappers:

- `fetchCapabilities()`
- `fetchEndpoint()`
- `updateEndpoint(payload)`
- `testEndpoint(payload?)`

Usage rules:

- `endpointMutable=false` renders read-only state.
- In bundled mode, `POST /runtime/endpoint:test` currently returns
  `endpoint_not_mutable`; do not expose a test action for immutable endpoints
  unless the backend contract changes.
- Mutable endpoint token input starts empty.
- Preserve `__unchanged__` sentinel when the configured token should be kept.
- Do not display token values.

### Devices

Wrappers:

- `fetchDevices()`
- `fetchSelfDevice()`
- `approveDeviceRequest(requestId)`
- `rejectDeviceRequest(requestId)`
- `removeDevice(deviceId)`
- `rotateDeviceToken(deviceId, role)`
- `revokeDeviceToken(deviceId, role)`

Usage rules:

- Confirmation dialog gates all device mutations.
- Self-device destructive actions remain disabled.
- Rotated token appears only in the one-time dialog.

### Device stream

Wrapper: `streamEvents`.

Relevant event names:

- `device.pair.requested`
- `device.pair.resolved`

Usage rules:

- Record a human-readable last stream event label.
- Refresh devices after a relevant event.

## Backend chain

```txt
SettingsPanel / EndpointSection
  -> frontend-new/src/api.ts
  -> deck-go Go BFF routes
  -> local config store and runtime facade
  -> OpenClaw Gateway only where the runtime/device facade owns that boundary
```

## Current exploration notes

- No deterministic settings/runtime/device forwarding drift was found before the
  proposal.
- `GET /settings` is intentionally sanitized by `settingsPayload`.
- `PUT /settings` intentionally rejects runtime-managed fields.
- `testSettingsConnection` exists in the API facade but the current production
  settings panel uses the newer runtime endpoint test workflow.

## Mock requirements

Focused mock visual E2E may need contract-shaped fixture data for:

- settings path and token configured state
- runtime endpoint source/mutability/token/TLS state
- version info
- pending device request
- paired self and non-self devices
- device token rotate result

Evidence should be labeled as mock visual coverage only.
