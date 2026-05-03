# settings - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-settings-hifi-contract-redesign`

This package defines the visual and interaction target for the `settings/`
module rewrite in `frontend-new`. The current panel is functional and already
protects token values, but this package is the visual truth for the
high-fidelity pass. Code and contracts remain the final authority when a
handoff note drifts.

## What this module does

`settings/` is the local deck-go control-plane workbench. Operators use it to
inspect settings path and token configured state, manage runtime endpoint
configuration when the mode allows it, test endpoint connectivity, switch local
theme/locale, review version diagnostics, see notification placeholders, and
manage paired devices plus device tokens.

The design is compact, security-forward, and work-focused. It repeats the
chat/agents/routing/subagents/logs typography and token posture while keeping
configuration/security molecules local until a separate design-system proposal
promotes them.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoSettings`
- `DeckGoSettingsResponse`
- `DeckGoSettingsSaveResponse`
- `DeckGoSettingsVersionResponse`
- `DeckGoRuntimeCapabilities`
- `DeckGoRuntimeEndpointResponse`
- `DeckGoRuntimeEndpointPutRequest`
- `DeckGoRuntimeEndpointTestRequest`
- `DeckGoRuntimeEndpointTestResponse`
- `DeckGoDevicesResponse`
- `DeckGoSelfDeviceResponse`
- `DeckGoPairedDevice`
- `DeckGoPendingDeviceRequest`
- `DeckGoDeviceTokenRotateResponse`

Endpoint truth:

- `GET /settings`
- `PUT /settings`
- `GET /settings/version`
- `GET /runtime/capabilities`
- `GET /runtime/endpoint`
- `PUT /runtime/endpoint`
- `POST /runtime/endpoint:test`
- `GET /devices`
- `GET /devices/self`
- `POST /devices/approve`
- `POST /devices/reject`
- `POST /devices/remove`
- `POST /devices/token/rotate`
- `POST /devices/token/revoke`
- `GET /stream` for `device.pair.requested` and `device.pair.resolved`

## Security constraints

- `GET /settings` reports `accessTokenConfigured` and `accessTokenSource`; it
  must not expose access-token values.
- `PUT /settings` accepts only `appearance`, `notifications`, and
  `pairedDevices`. Runtime-managed fields must remain rejected by the BFF.
- Runtime endpoint tokens are never rendered. Empty editable token input keeps
  the existing `__unchanged__` sentinel behavior when a token is configured.
- Device token rotation may show the returned token only in the one-time token
  dialog. It should not be copied into persistent UI state elsewhere.
- Self-device destructive actions remain disabled.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Code`, `Input`, `Select`, `SegmentedControl`,
`Spinner`, `Toggle`, and `Modal` where production fit is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- settings metric tile
- endpoint status surface
- secure read-only field
- preference toggle/control strip
- device request row
- paired device row
- token action strip
- one-time token dialog

## How to implement

1. Open `prototype.html` and inspect ready, remote-editable, pending-device,
   confirmation, token-generated, empty, and error states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   behavior.
3. Translate the prototype into `frontend-new/src/components/panels/settings/`,
   preserving current wrappers, endpoint sentinel behavior, confirmation gates,
   disabled self-device destructive actions, and stream refresh behavior.
4. Restyle `EndpointSection` and `ReadOnlyField` only as settings-owned helpers.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.
6. Update `implementation-notes.md` with production divergence and
   design-system feedback.

## Open questions for follow-up

- Whether old `settings.testConnection` should remain as an exposed UI action or
  stay unused behind the newer runtime endpoint test route.
- Whether bundled runtime endpoints should gain a health/test contract; the
  current UI hides endpoint testing when `endpointMutable=false` because the
  current BFF returns `endpoint_not_mutable`.
- Whether notification preferences should get a real persisted contract.
- Whether device lists need server-side pagination/filtering when paired device
  counts grow.
- Whether token rotation result should include richer expiry/scope metadata.
- Whether secure read-only fields and token action strips should become shared
  patterns after another security/config module repeats them.
