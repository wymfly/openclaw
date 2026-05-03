# settings - states

## Load states

| State            | Meaning                                 | UI                                                              |
| ---------------- | --------------------------------------- | --------------------------------------------------------------- |
| settings loading | `fetchSettings` pending                 | settings badge muted/running; previous values can remain        |
| settings ready   | `fetchSettings` resolved                | settings badge OK; settings path/token configured state visible |
| endpoint loading | `fetchEndpoint` or capabilities pending | endpoint card shows loading note                                |
| endpoint ready   | capabilities and endpoint resolved      | endpoint state/form visible                                     |
| devices loading  | `fetchDevices` pending                  | devices badge muted/running                                     |
| devices ready    | devices resolved                        | pending/paired counts and rows visible                          |

Errors render as compact banners or card-local error notes. They must wrap long
messages without breaking the workbench.

## Settings save

When Save settings is clicked:

- send `buildSettingsSavePayload(settings)`
- include only `appearance`, `notifications`, and `pairedDevices`
- refresh settings and runtime summary on success
- render `settingsSaveResult` JSON seam when available

## Runtime endpoint

### Immutable endpoint

When `capabilities.endpointMutable` is false:

- endpoint URL, token configured state, and TLS state render read-only
- source/mutability badges make `.env` ownership visible
- Save endpoint is hidden
- Test endpoint is hidden because the current bundled facade returns
  `endpoint_not_mutable` for `POST /runtime/endpoint:test`

### Mutable endpoint

When `capabilities.endpointMutable` is true:

- endpoint URL input is editable
- endpoint token input starts empty
- if token is configured and input remains empty, save/test sends
  `token: "__unchanged__"`
- TLS verify can be toggled
- Save endpoint calls `updateEndpoint`
- Test endpoint calls `testEndpoint(undefined)` when not dirty, or an explicit
  payload when dirty

## Appearance and language

Theme and locale controls are local Deck UI shell state. They do not save through
`PUT /settings` in this change.

## Notifications

Notification preference rows are placeholders. They render scope information and
copy that persisted notification preferences are not exposed by a contract yet.

## Devices

### Pending request

Pending request rows expose approve/reject actions. Each action opens a
confirmation dialog before calling the device wrapper.

### Paired device

Paired device rows expose platform/IP/role metadata and token summaries.

Rules:

- self-device remove/revoke actions are disabled
- revoked token actions are disabled
- action result renders as secondary JSON evidence

### Rotated token

After token rotation returns `token`, show one-time token dialog. Closing the
dialog clears token state.

## Device stream

`device.pair.requested` and `device.pair.resolved` events update the last stream
event label and trigger `refreshDevices`.

## Unsupported states

These are not guaranteed by current contracts and should remain follow-up notes:

- persisted notification preference editing
- revealing configured access/runtime tokens
- server-side device list pagination/filtering
- device token expiry editing
- Gateway-level settings RPCs from browser code
