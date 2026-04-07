# Deck Device Management Panel Design

**Date:** 2026-04-07
**Status:** Approved (revised after Codex review)
**Scope:** Settings > Devices tab

## Overview

Device management panel for the Deck dashboard, enabling operators to manage all devices paired with the Gateway (mobile apps, desktop clients, Deck itself). Embedded as a sub-tab within the Settings panel.

## Gateway API Surface

All methods are now in the Deck typed client (`gw.*`):

| Method                | Purpose                           | Scope              |
| --------------------- | --------------------------------- | ------------------ |
| `device.pair.list`    | List pending + paired devices     | `operator.pairing` |
| `device.pair.approve` | Approve a pending pairing request | `operator.pairing` |
| `device.pair.reject`  | Reject a pending pairing request  | `operator.pairing` |
| `device.pair.remove`  | Unpair a device (all roles)       | `operator.pairing` |
| `device.token.rotate` | Issue new token, invalidate old   | `operator.pairing` |
| `device.token.revoke` | Revoke a specific role token      | `operator.pairing` |

> **Note:** Actual scope is `operator.pairing` (not `operator.admin`). Deck's operator connection holds this scope by default.

**Events (Gateway broadcast):**

- `device.pair.requested` — new pairing request arrived
- `device.pair.resolved` — pairing approved or rejected (payload: `{ requestId, deviceId, decision, ts }` only — does NOT contain the paired device object)

## Infrastructure Prerequisites

Before implementing the UI, these plumbing items must be completed:

### P1. Device Event Bridging

Device events are broadcast by Gateway but **not bridged to Deck SSE** as first-class events. Currently they arrive as generic `gateway.event` wrappers.

**Fix:** Add `device.pair.requested` and `device.pair.resolved` to the `SESSION_EVENT_INTAKE_MAP` or a new `DEVICE_EVENT_INTAKE_MAP` in `dashboard/server/runtime.ts`, so the EventBus broadcasts them as named events the store can subscribe to.

### P2. Approve Requires Refetch

`device.pair.resolved` event payload only contains `{ requestId, deviceId, decision, ts }` — it does NOT include the full paired device object. Therefore the "SSE-only optimistic update from pending → paired" model is **not feasible**.

**Design decision:** On approve/reject, the store performs the mutation call, then does a full `device.pair.list` refetch to get the updated state. SSE events are used only for:

- Toast notifications (new request arrived)
- Badge count updates (pending count changed)
- Triggering auto-refetch when another client resolves a request

### P3. Runtime Method Registry

`deviceMethodDefs` is registered in `allMethodDefs` (codegen side) but must also be added to the runtime `gatewayMethodRegistry` in `src/gateway/server-methods.ts` if not already present, so `gateway.describe` reports correct scopes.

## Layout

```
Settings Panel
  └── Devices Tab
        ├── Header: title + refresh button
        ├── Pending Section (conditional — only when pending.length > 0)
        │     └── Compact rows: displayName + platform + role + [Approve] [Reject]
        ├── Paired Section
        │     └── Compact rows (collapsed): platform icon + displayName + role badges + status indicator
        │           └── Expanded: scopes, IP, tokens, action buttons
        └── Empty State: "No paired devices"
```

## Compact Row (Collapsed)

```
[iOS icon]  Jane's iPhone    [operator]           🟢
[Android]   Dev Pixel        [developer] [node]   🟢
[Node]      Gateway Client   [operator]           🟢  [This Device]
```

- **Left:** Platform icon (iOS / Android / Node / generic)
- **Center:** `displayName` + role badge(s) (device can have multiple roles via `roles[]`)
- **Right:** Status indicator (green = has active token, red = all tokens revoked)
- **Self-device:** Matched by `deviceId` (see Self-Device Detection below)

> **Note:** No "expired" status — tokens have no expiry field. Status is binary: active (has at least one non-revoked token) or revoked (all tokens revoked).

Click to expand.

## Expanded Detail

```
Jane's iPhone                          [operator]  🟢
  Platform: iOS / iPhone
  IP: 192.168.1.42
  Paired: 2 days ago

  Tokens:
  ┌──────────┬─────────────────────┬───────────────┬─────────┐
  │ Role     │ Scopes              │ Last Active   │ Status  │
  ├──────────┼─────────────────────┼───────────────┼─────────┤
  │ operator │ read, write, admin  │ 5 minutes ago │ Active  │
  │ node     │ node                │ 2 hours ago   │ Active  │
  └──────────┴─────────────────────┴───────────────┴─────────┘

  [Rotate Token]  [Revoke Token]  [Remove Device]
```

## Self-Device Detection

Deck persists its own Ed25519 device identity in SQLite (`dashboard/server/device-identity.ts`). The stored `deviceId` is derived from the public key and is stable across restarts.

**Detection:** On store init, read Deck's own `deviceId` from the identity module. Match against the `deviceId` field in the paired device list.

This is reliable even with:

- Multiple Deck instances (each has a unique deviceId)
- Dual connections (operator + node) from the same Deck instance (same deviceId)

**Protection rules:**

- Display "This Device" badge (primary color)
- **Remove** button: disabled, tooltip "Cannot remove the current Deck connection"
- **Revoke** button: disabled, tooltip "Cannot revoke the current Deck token"
- **Rotate** button: enabled (Deck can rotate its own token)

## Pending Section

Only visible when `pending.length > 0`. Each row:

```
[iOS icon]  New iPhone  [developer]  requested 30s ago   [Approve ✓]  [Reject ✗]
```

- Approve → calls `device.pair.approve({ requestId })` → refetch list
- Reject → calls `device.pair.reject({ requestId })` → refetch list

## Real-Time Notifications

### Toast

On `device.pair.requested` event:

- Show toast: "New device **{displayName}** requesting pairing as **{role}**"
- Toast action: navigate to Settings > Devices tab
- Auto-dismiss after 8 seconds

### NavRail Badge

- Settings icon shows numeric badge = `pending.length`
- Badge clears when pending list is empty after refetch
- Updated on: initial load, SSE events (trigger refetch), user actions

### Event-Driven Refresh

```
device.pair.requested (SSE event)
  → show toast notification
  → trigger fetchDevices() to refresh list + badge

device.pair.resolved (SSE event)
  → trigger fetchDevices() to refresh list + badge
  (NOT used for direct state mutation — payload is insufficient)
```

## Token Rotate Flow

1. User clicks **Rotate Token** on a device's token row
2. Confirmation modal: "Rotate token for **{displayName}** ({role})? The current token will be immediately invalidated."
3. On confirm → `device.token.rotate({ deviceId, role })`
4. Result modal: displays new token in monospace font + **Copy** button
5. Modal cannot be dismissed by clicking outside (only explicit close button)
6. Warning text: "This token will not be shown again. Copy it now."
7. On close → token is gone, list refreshes showing `rotatedAtMs` timestamp

## Destructive Actions

All destructive actions (Revoke, Remove) require confirmation modal:

- **Revoke:** "Revoke **{role}** token for **{displayName}**? The device will lose access for this role immediately."
- **Remove:** "Remove **{displayName}** from paired devices? All tokens will be invalidated. The device must re-pair to regain access."

## Error Handling

Gateway returns structured errors with `code` field. The route layer should parse these and return specific HTTP status codes:

| Gateway error code                        | HTTP status | UI behavior                                                                         |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `INVALID_REQUEST` (unknown requestId)     | 404         | "Request not found — it may have been resolved by another operator." + auto-refetch |
| `INVALID_REQUEST` (scope insufficient)    | 403         | "Insufficient permissions for this operation."                                      |
| `INVALID_REQUEST` (device not found)      | 404         | "Device not found — it may have been removed." + auto-refetch                       |
| `INVALID_REQUEST` (token rotation denied) | 403         | "Token rotation denied."                                                            |
| Network/transport error                   | 502         | "Gateway connection error. Please retry."                                           |

All error states show inline error banner (not modal) with retry option. Stale-state errors (404) trigger automatic list refetch.

## Data Store

New Zustand store: `dashboard/src/stores/devices.ts`

```typescript
interface DevicesState {
  pending: DevicePendingRequest[];
  paired: RedactedPairedDevice[];
  selfDeviceId: string | null; // Deck's own deviceId, loaded once at init
  loading: boolean;
  error: string | null;
  // actions
  fetchDevices: () => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  rotateToken: (deviceId: string, role: string) => Promise<string>; // returns new token
  revokeToken: (deviceId: string, role: string) => Promise<void>;
}
```

All mutation actions call the API then refetch the full list. SSE events also trigger refetch.

## API Routes

All routes wrapped with `withAuth()`:

| Route                       | Method | Gateway RPC           |
| --------------------------- | ------ | --------------------- |
| `/api/devices`              | GET    | `device.pair.list`    |
| `/api/devices/approve`      | POST   | `device.pair.approve` |
| `/api/devices/reject`       | POST   | `device.pair.reject`  |
| `/api/devices/remove`       | POST   | `device.pair.remove`  |
| `/api/devices/token/rotate` | POST   | `device.token.rotate` |
| `/api/devices/token/revoke` | POST   | `device.token.revoke` |

Token rotate route returns raw JSON response (contains token) — **must** be behind `withAuth()`.

## i18n Keys

Namespace: `devices`

Required keys (zh + en):

- Title, section headers, empty states
- Button labels (approve, reject, remove, rotate, revoke)
- Confirmation modal text
- Token display modal text
- Toast notification text
- Self-device badge and tooltip text
- Status labels (active, revoked)
- Error messages (by error type)

## Files to Create/Modify

**New files:**

- `dashboard/src/components/panels/settings/DevicesTab.tsx` — main panel component
- `dashboard/src/components/panels/settings/DeviceRow.tsx` — compact row + expandable detail
- `dashboard/src/components/panels/settings/PendingRequestRow.tsx` — pending request row
- `dashboard/src/components/panels/settings/TokenRotateModal.tsx` — token display modal
- `dashboard/src/stores/devices.ts` — Zustand store
- `dashboard/src/app/api/devices/route.ts` — list endpoint
- `dashboard/src/app/api/devices/approve/route.ts`
- `dashboard/src/app/api/devices/reject/route.ts`
- `dashboard/src/app/api/devices/remove/route.ts`
- `dashboard/src/app/api/devices/token/rotate/route.ts`
- `dashboard/src/app/api/devices/token/revoke/route.ts`

**Modified files:**

- `dashboard/src/components/panels/settings/SettingsPanel.tsx` — add Devices tab
- `dashboard/src/i18n/en.json` — add `devices` namespace
- `dashboard/src/i18n/zh.json` — add `devices` namespace
- `dashboard/server/runtime.ts` — add device event bridging (P1)
- `dashboard/server/runtime.ts` — expose `selfDeviceId` for self-device detection

**Gateway-side (if needed):**

- `src/gateway/server-methods.ts` — verify `deviceMethodDefs` in runtime registry (P3)

## Out of Scope

- Device grouping or search (device count typically < 20)
- Token history (only current state shown)
- "Expired" token status (no expiry field in token schema)
- Edit device display name (Gateway does not support this)
- Wizard integration (separate feature)
- Bulk operations (unnecessary at expected scale)

## Codex Review Findings (Resolved)

| Finding                                                           | Resolution                                      |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| Scope is `operator.pairing` not `operator.admin`                  | Fixed in API surface table                      |
| SSE events not bridged as first-class                             | Added P1 prerequisite                           |
| `device.pair.resolved` payload insufficient for optimistic update | Changed to refetch model (P2)                   |
| Self-device detection unreliable with `clientId/clientMode`       | Changed to `deviceId` matching                  |
| "Expired" status has no data source                               | Removed from design, binary active/revoked only |
| Multi-role devices not handled                                    | Added `roles[]` badge support                   |
| Error handling too vague                                          | Added structured error mapping table            |
| `withAuth` not mentioned                                          | Added to API routes section                     |
