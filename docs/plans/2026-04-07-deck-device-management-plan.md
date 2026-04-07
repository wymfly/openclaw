# Deck Device Management Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Devices" section to the Settings panel that lets operators manage paired devices (list, approve, reject, remove, rotate/revoke tokens) with real-time notifications.

**Architecture:** New Zustand store (`devices.ts`) fetches from 6 API routes backed by typed Gateway RPC calls (`gwCall`/`gwRequest`). SSE events (`device.pair.requested/resolved`) are bridged via `DeckEventType` + `VALID_DECK_EVENTS` in the server runtime, consumed by a `useDevicesSSE` hook using the `deckStream()` pattern. UI uses the existing Settings section pattern with Collapsible rows and Dialog modals. NavRail badge shows pending device count.

**Tech Stack:** Next.js API routes, Zustand, next-intl, Base UI Dialog/Collapsible, SSE via `deckStream()`

**Design spec:** `docs/plans/2026-04-07-deck-device-management-design.md`

---

## File Map

| File                                                              | Responsibility                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `dashboard/server/event-bus.ts`                                   | Modified: add `device.pair.requested` / `device.pair.resolved` to DeckEventType |
| `dashboard/server/runtime.ts`                                     | Modified: add device events to VALID_DECK_EVENTS + bridging logic               |
| `src/gateway/server-methods.ts`                                   | Modified: register `deviceMethodDefs` + `wizardMethodDefs` in runtime registry  |
| `dashboard/src/i18n/en.json`                                      | Modified: add `devices` namespace + `common.close`                              |
| `dashboard/src/i18n/zh.json`                                      | Modified: add `devices` namespace + `common.close`                              |
| `dashboard/src/app/api/devices/route.ts`                          | GET → `device.pair.list` (with error handling)                                  |
| `dashboard/src/app/api/devices/approve/route.ts`                  | POST → `device.pair.approve` (with error handling)                              |
| `dashboard/src/app/api/devices/reject/route.ts`                   | POST → `device.pair.reject` (with error handling)                               |
| `dashboard/src/app/api/devices/remove/route.ts`                   | POST → `device.pair.remove` (with error handling)                               |
| `dashboard/src/app/api/devices/token/rotate/route.ts`             | POST → `device.token.rotate` (with error handling)                              |
| `dashboard/src/app/api/devices/token/revoke/route.ts`             | POST → `device.token.revoke` (with error handling)                              |
| `dashboard/src/app/api/devices/self/route.ts`                     | GET → returns Deck's own deviceId via `loadOrCreateDeviceIdentity(db)`          |
| `dashboard/src/stores/devices.ts`                                 | Zustand store: state, fetch, mutations                                          |
| `dashboard/src/hooks/useDevicesSSE.ts`                            | SSE hook using `deckStream()` pattern (like `useApprovalsSSE`)                  |
| `dashboard/src/components/panels/settings/ConfirmActionModal.tsx` | Reusable confirm dialog for destructive actions                                 |
| `dashboard/src/components/panels/settings/TokenRotateModal.tsx`   | One-time token display dialog                                                   |
| `dashboard/src/components/panels/settings/PendingRequestRow.tsx`  | Pending row with Approve/Reject                                                 |
| `dashboard/src/components/panels/settings/DeviceRow.tsx`          | Collapsible row: compact + expanded                                             |
| `dashboard/src/components/panels/settings/DevicesSection.tsx`     | Section container: pending + paired lists                                       |
| `dashboard/src/components/panels/settings/SettingsPanel.tsx`      | Modified: add DevicesSection                                                    |
| `dashboard/src/lib/panel-registry.ts`                             | Modified: add optional `badge` field to PanelEntry                              |
| `dashboard/src/components/layout/NavRail.tsx`                     | Modified: render badge on nav items                                             |

---

### Task 1: Infrastructure — Event Types, Event Bridging, Runtime Registry

**Files:**

- Modify: `dashboard/server/event-bus.ts`
- Modify: `dashboard/server/runtime.ts`
- Modify: `src/gateway/server-methods.ts`

- [ ] **Step 1: Add device event types to DeckEventType**

In `dashboard/server/event-bus.ts`, add `device.pair.requested` and `device.pair.resolved` to the `DeckEventType` union:

```typescript
export type DeckEventType =
  | "runtime.status"
  | "gateway.event"
  | "chat"
  | "agent"
  | "agent.updated"
  | "commands.changed"
  | "gateway.health"
  | "notification.toast"
  // P1 additions
  | "log.entry"
  | "activity.event"
  // P2 additions
  | "approval.pending"
  | "approval.resolved"
  | "budget.warn"
  | "budget.over"
  | "alert.fired"
  | "webhook.delivery"
  | "cron.run.complete"
  | "canvas"
  // Device pairing events
  | "device.pair.requested"
  | "device.pair.resolved"
  // Upstream session events (Layer 2 — bypass RunEventPipeline)
  | "session-state"
  | "session-msg"
  | "session-tool";
```

- [ ] **Step 2: Add device events to VALID_DECK_EVENTS**

In `dashboard/server/runtime.ts`, add the device events to the `VALID_DECK_EVENTS` set:

```typescript
const VALID_DECK_EVENTS = new Set<DeckEventType>([
  "runtime.status",
  "gateway.event",
  "chat",
  "agent",
  "agent.updated",
  "commands.changed",
  "gateway.health",
  "notification.toast",
  "log.entry",
  "activity.event",
  // P2 additions
  "approval.pending",
  "approval.resolved",
  "budget.warn",
  "budget.over",
  "alert.fired",
  "webhook.delivery",
  "cron.run.complete",
  "canvas",
  // Device pairing events
  "device.pair.requested",
  "device.pair.resolved",
]);
```

No special bridging logic needed — device events arrive as `{ type: "gateway.event", event: "device.pair.requested", payload }` and the existing `bridgeDomainEvent` logic already extracts inner events and broadcasts them if they're in `VALID_DECK_EVENTS`. Adding them to the set is sufficient.

- [ ] **Step 3: Register deviceMethodDefs and wizardMethodDefs in runtime registry**

In `src/gateway/server-methods.ts`, add imports for the missing method defs:

```typescript
import { deviceMethodDefs } from "./server-methods/device-method-defs.js";
import { wizardMethodDefs } from "./server-methods/wizard-method-defs.js";
```

Then add them to the `buildMethodRegistry()` call's method defs array:

```typescript
export const gatewayMethodRegistry = buildMethodRegistry(
  coreGatewayHandlers,
  [
    chatMethodDefs,
    configMethodDefs,
    sessionsMethodDefs,
    deckMethodDefs,
    deckAuthMethodDefs,
    describeMethodDefs,
    agentMethodDefs,
    agentsMethodDefs,
    modelsMethodDefs,
    channelsMethodDefs,
    logsMethodDefs,
    toolsCatalogMethodDefs,
    toolsEffectiveMethodDefs,
    deviceMethodDefs, // ← add
    wizardMethodDefs, // ← add
  ],
  gatewayEventDefs,
);
```

- [ ] **Step 4: Verify compilation**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep "event-bus\|runtime" | head -5
```

Expected: no errors related to device events.

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add device event types, bridging, and runtime registry" \
  dashboard/server/event-bus.ts \
  dashboard/server/runtime.ts \
  src/gateway/server-methods.ts
```

---

### Task 2: i18n Keys

**Files:**

- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 1: Add `devices` namespace and `common.close` to en.json**

Add `"close": "Close"` to the `common` object, then add the `devices` namespace:

```json
"devices": {
  "title": "Devices",
  "pending": "Pending Requests",
  "paired": "Paired Devices",
  "empty": "No paired devices",
  "noPending": "No pending requests",
  "refresh": "Refresh",
  "approve": "Approve",
  "reject": "Reject",
  "remove": "Remove Device",
  "rotate": "Rotate Token",
  "revoke": "Revoke Token",
  "thisDevice": "This Device",
  "requestedAgo": "requested {time}",
  "pairedAgo": "paired {time}",
  "lastActive": "Last active {time}",
  "active": "Active",
  "revoked": "Revoked",
  "status": "Status",
  "role": "Role",
  "scopes": "Scopes",
  "ip": "IP Address",
  "platform": "Platform",
  "tokens": "Tokens",
  "close": "Close",
  "confirmApprove": "Approve pairing request from {name} as {role}?",
  "confirmReject": "Reject pairing request from {name}?",
  "confirmRemove": "Remove {name} from paired devices? All tokens will be invalidated. The device must re-pair to regain access.",
  "confirmRevoke": "Revoke {role} token for {name}? The device will lose access for this role immediately.",
  "confirmRotate": "Rotate token for {name} ({role})? The current token will be immediately invalidated.",
  "tokenGenerated": "New Token Generated",
  "tokenWarning": "This token will not be shown again. Copy it now.",
  "copyToken": "Copy Token",
  "copied": "Copied!",
  "cannotRemoveSelf": "Cannot remove the current Deck connection",
  "cannotRevokeSelf": "Cannot revoke the current Deck token",
  "toastNewRequest": "New device {name} requesting pairing as {role}",
  "errorNotFound": "Not found — may have been resolved by another operator.",
  "errorForbidden": "Insufficient permissions for this operation.",
  "errorNetwork": "Gateway connection error. Please retry.",
  "operationFailed": "Operation failed"
}
```

- [ ] **Step 2: Add `devices` namespace and `common.close` to zh.json**

Add `"close": "关闭"` to the `common` object, then add the `devices` namespace:

```json
"devices": {
  "title": "设备管理",
  "pending": "待审批请求",
  "paired": "已配对设备",
  "empty": "暂无配对设备",
  "noPending": "暂无待审批请求",
  "refresh": "刷新",
  "approve": "批准",
  "reject": "拒绝",
  "remove": "移除设备",
  "rotate": "轮换 Token",
  "revoke": "吊销 Token",
  "thisDevice": "当前设备",
  "requestedAgo": "{time}前请求",
  "pairedAgo": "{time}前配对",
  "lastActive": "最后活跃 {time}",
  "active": "活跃",
  "revoked": "已吊销",
  "status": "状态",
  "role": "角色",
  "scopes": "权限范围",
  "ip": "IP 地址",
  "platform": "平台",
  "tokens": "Token 列表",
  "close": "关闭",
  "confirmApprove": "批准来自 {name} 的配对请求（角色：{role}）？",
  "confirmReject": "拒绝来自 {name} 的配对请求？",
  "confirmRemove": "移除设备 {name}？所有 Token 将失效，设备需要重新配对。",
  "confirmRevoke": "吊销 {name} 的 {role} Token？该设备将立即失去此角色的访问权限。",
  "confirmRotate": "轮换 {name}（{role}）的 Token？当前 Token 将立即失效。",
  "tokenGenerated": "新 Token 已生成",
  "tokenWarning": "此 Token 不会再次显示，请立即复制。",
  "copyToken": "复制 Token",
  "copied": "已复制！",
  "cannotRemoveSelf": "无法移除当前 Deck 连接",
  "cannotRevokeSelf": "无法吊销当前 Deck Token",
  "toastNewRequest": "新设备 {name} 请求配对（角色：{role}）",
  "errorNotFound": "未找到 — 可能已被其他操作员处理。",
  "errorForbidden": "权限不足，无法执行此操作。",
  "errorNetwork": "Gateway 连接错误，请重试。",
  "operationFailed": "操作失败"
}
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add devices i18n keys" \
  dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 3: API Routes (with Error Handling)

**Files:**

- Create: `dashboard/src/app/api/devices/route.ts`
- Create: `dashboard/src/app/api/devices/approve/route.ts`
- Create: `dashboard/src/app/api/devices/reject/route.ts`
- Create: `dashboard/src/app/api/devices/remove/route.ts`
- Create: `dashboard/src/app/api/devices/token/rotate/route.ts`
- Create: `dashboard/src/app/api/devices/token/revoke/route.ts`

All device methods are fully typed in `GatewayMethodMap` (generated protocol). Routes use `gwCall()` for raw data + manual error mapping, or `gwRequest()` for simple pass-through. Routes that need specific HTTP status mapping (404/403) use `gwCall()` with try/catch.

- [ ] **Step 1: Create list route**

`dashboard/src/app/api/devices/route.ts`:

```typescript
/**
 * GET /api/devices — List pending + paired devices.
 */
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("device.pair.list", {});
});
```

- [ ] **Step 2: Create approve route**

`dashboard/src/app/api/devices/approve/route.ts`:

```typescript
/**
 * POST /api/devices/approve — Approve a pending pairing request.
 */
import { type NextRequest, NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const { requestId } = (await request.json()) as { requestId: string };
  try {
    const data = await gwCall("device.pair.approve", { requestId });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown")) {
        return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
      }
      if (msg.includes("denied") || msg.includes("scope") || msg.includes("unauthorized")) {
        return NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
```

- [ ] **Step 3: Create reject route**

`dashboard/src/app/api/devices/reject/route.ts`:

```typescript
/**
 * POST /api/devices/reject — Reject a pending pairing request.
 */
import { type NextRequest, NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const { requestId } = (await request.json()) as { requestId: string };
  try {
    const data = await gwCall("device.pair.reject", { requestId });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown")) {
        return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
      }
      if (msg.includes("denied") || msg.includes("scope") || msg.includes("unauthorized")) {
        return NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
```

- [ ] **Step 4: Create remove route**

`dashboard/src/app/api/devices/remove/route.ts`:

```typescript
/**
 * POST /api/devices/remove — Remove a paired device.
 */
import { type NextRequest, NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const { deviceId } = (await request.json()) as { deviceId: string };
  try {
    const data = await gwCall("device.pair.remove", { deviceId });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown")) {
        return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
      }
      if (msg.includes("denied") || msg.includes("scope") || msg.includes("unauthorized")) {
        return NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
```

- [ ] **Step 5: Create token rotate route**

`dashboard/src/app/api/devices/token/rotate/route.ts`:

```typescript
/**
 * POST /api/devices/token/rotate — Rotate a device token.
 * Returns the new token in the response — must be behind withAuth().
 */
import { type NextRequest, NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const { deviceId, role } = (await request.json()) as { deviceId: string; role: string };
  try {
    const data = await gwCall("device.token.rotate", { deviceId, role });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown")) {
        return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
      }
      if (msg.includes("denied") || msg.includes("scope") || msg.includes("unauthorized")) {
        return NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
```

- [ ] **Step 6: Create token revoke route**

`dashboard/src/app/api/devices/token/revoke/route.ts`:

```typescript
/**
 * POST /api/devices/token/revoke — Revoke a device token.
 */
import { type NextRequest, NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const { deviceId, role } = (await request.json()) as { deviceId: string; role: string };
  try {
    const data = await gwCall("device.token.revoke", { deviceId, role });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown")) {
        return NextResponse.json({ error: err.message, code: "NOT_FOUND" }, { status: 404 });
      }
      if (msg.includes("denied") || msg.includes("scope") || msg.includes("unauthorized")) {
        return NextResponse.json({ error: err.message, code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
```

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add device management API routes with error handling" \
  dashboard/src/app/api/devices/route.ts \
  dashboard/src/app/api/devices/approve/route.ts \
  dashboard/src/app/api/devices/reject/route.ts \
  dashboard/src/app/api/devices/remove/route.ts \
  dashboard/src/app/api/devices/token/rotate/route.ts \
  dashboard/src/app/api/devices/token/revoke/route.ts
```

---

### Task 4: Self-Device Endpoint

**Files:**

- Create: `dashboard/src/app/api/devices/self/route.ts`

The Deck's own `deviceId` is stored in SQLite, accessed via `loadOrCreateDeviceIdentity(db)` from `dashboard/server/device-identity.ts`. The runtime adapter does NOT have a `deviceId` property — the identity module is the correct source.

- [ ] **Step 1: Create self-device endpoint**

`dashboard/src/app/api/devices/self/route.ts`:

```typescript
/**
 * GET /api/devices/self — Returns Deck's own deviceId for self-device detection.
 *
 * Uses loadOrCreateDeviceIdentity(db) to read the deviceId from SQLite.
 * This is the stable Ed25519-derived deviceId that matches against the paired device list.
 */
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { getRuntime } from "@server/runtime";
import { loadOrCreateDeviceIdentity } from "@server/device-identity";

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime?.db) {
    return NextResponse.json({ deviceId: null });
  }
  try {
    const identity = loadOrCreateDeviceIdentity(runtime.db);
    return NextResponse.json({ deviceId: identity.deviceId });
  } catch {
    return NextResponse.json({ deviceId: null });
  }
});
```

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add self-device endpoint using device-identity" \
  dashboard/src/app/api/devices/self/route.ts
```

---

### Task 5: Zustand Store

**Files:**

- Create: `dashboard/src/stores/devices.ts`

- [ ] **Step 1: Create the store**

`dashboard/src/stores/devices.ts`:

```typescript
import { create } from "zustand";
import { fetchApi, DeckApiError } from "@/lib/errors";

export interface DeviceTokenSummary {
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
}

export interface PairedDevice {
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: DeviceTokenSummary[];
  createdAtMs?: number;
  approvedAtMs?: number;
}

export interface PendingRequest {
  requestId: string;
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  ts: number;
}

interface DevicesState {
  pending: PendingRequest[];
  paired: PairedDevice[];
  selfDeviceId: string | null;
  loading: boolean;
  error: string | null;

  fetchDevices: () => Promise<void>;
  fetchSelfDeviceId: () => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  rotateToken: (deviceId: string, role: string) => Promise<string>;
  revokeToken: (deviceId: string, role: string) => Promise<void>;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  pending: [],
  paired: [],
  selfDeviceId: null,
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApi<{ pending: PendingRequest[]; paired: PairedDevice[] }>(
        "/api/devices",
      );
      set({ pending: data.pending ?? [], paired: data.paired ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof DeckApiError ? err.body.error : "Failed to fetch devices",
        loading: false,
      });
    }
  },

  fetchSelfDeviceId: async () => {
    try {
      const data = await fetchApi<{ deviceId: string | null }>("/api/devices/self");
      set({ selfDeviceId: data.deviceId });
    } catch {
      // Non-critical — self-device badge just won't show
    }
  },

  approveRequest: async (requestId) => {
    await fetchApi("/api/devices/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    await get().fetchDevices();
  },

  rejectRequest: async (requestId) => {
    await fetchApi("/api/devices/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    await get().fetchDevices();
  },

  removeDevice: async (deviceId) => {
    await fetchApi("/api/devices/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    await get().fetchDevices();
  },

  rotateToken: async (deviceId, role) => {
    const data = await fetchApi<{ token: string }>("/api/devices/token/rotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, role }),
    });
    await get().fetchDevices();
    return data.token;
  },

  revokeToken: async (deviceId, role) => {
    await fetchApi("/api/devices/token/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, role }),
    });
    await get().fetchDevices();
  },
}));
```

- [ ] **Step 2: Verify types compile**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep "devices" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add devices Zustand store" \
  dashboard/src/stores/devices.ts
```

---

### Task 6: useDevicesSSE Hook

**Files:**

- Create: `dashboard/src/hooks/useDevicesSSE.ts`

Uses the `deckStream()` pattern from `@/lib/deck-client`, matching the established `useApprovalsSSE.ts` pattern. Does NOT use native `EventSource` directly.

- [ ] **Step 1: Create SSE hook**

`dashboard/src/hooks/useDevicesSSE.ts`:

```typescript
"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useDevicesStore } from "@/stores/devices";
import { useNotificationsStore } from "@/stores/notifications";
import { useTranslations } from "next-intl";

/**
 * Subscribe to SSE device pairing events and update the store in real-time.
 *
 * Follows the same pattern as useApprovalsSSE:
 * - Uses deckStream() with AbortController cleanup
 * - Reconnection is handled by deckStream's built-in reconnect logic
 * - SSE events trigger refetch (not direct state mutation, since
 *   device.pair.resolved payload is insufficient for optimistic updates)
 */
export function useDevicesSSE() {
  const fetchDevices = useDevicesStore((s) => s.fetchDevices);
  const addToast = useNotificationsStore((s) => s.addToast);
  const t = useTranslations("devices");

  useEffect(() => {
    const controller = new AbortController();
    void deckStream("/api/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        if (!event.event || !event.data) {
          return;
        }
        try {
          if (event.event === "device.pair.requested") {
            const payload = JSON.parse(event.data) as {
              displayName?: string;
              role?: string;
            };
            addToast(
              "info",
              t("toastNewRequest", {
                name: payload.displayName ?? "Unknown",
                role: payload.role ?? "unknown",
              }),
              8000,
            );
            void fetchDevices();
          } else if (event.event === "device.pair.resolved") {
            void fetchDevices();
          }
        } catch {
          // Ignore malformed SSE payloads
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [fetchDevices, addToast, t]);
}
```

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add useDevicesSSE hook with deckStream pattern" \
  dashboard/src/hooks/useDevicesSSE.ts
```

---

### Task 7: Modals (ConfirmActionModal + TokenRotateModal)

**Files:**

- Create: `dashboard/src/components/panels/settings/ConfirmActionModal.tsx`
- Create: `dashboard/src/components/panels/settings/TokenRotateModal.tsx`

- [ ] **Step 1: Create reusable confirm modal**

`dashboard/src/components/panels/settings/ConfirmActionModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<void>;
}

export function ConfirmActionModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
}: ConfirmActionModalProps) {
  const tc = useTranslations("common");
  const td = useTranslations("devices");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : td("operationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!loading) {
      setError(null);
      onOpenChange(value);
    }
  };

  const isDestructive = variant === "destructive";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" style={{ backgroundColor: "var(--card)" }}>
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {description}
        </p>

        {error && (
          <p className="text-xs" style={{ color: "var(--destructive)" }}>
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <button
            className="px-3 py-1.5 text-xs rounded-md border"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {tc("cancel")}
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-md font-medium"
            style={{
              backgroundColor: isDestructive ? "var(--destructive)" : "var(--primary)",
              color: isDestructive ? "var(--destructive-fg)" : "var(--primary-foreground)",
              opacity: loading ? 0.6 : 1,
            }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? tc("loading") : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create token display modal**

`dashboard/src/components/panels/settings/TokenRotateModal.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TokenRotateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
}

export function TokenRotateModal({ open, onOpenChange, token }: TokenRotateModalProps) {
  const t = useTranslations("devices");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        style={{ backgroundColor: "var(--card)" }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{t("tokenGenerated")}</DialogTitle>
        </DialogHeader>

        <div
          className="rounded-md p-3 font-mono text-xs break-all select-all"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          {token}
        </div>

        <p
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--warning-muted-text)" }}
        >
          {t("tokenWarning")}
        </p>

        <DialogFooter className="gap-2">
          <button
            className="px-3 py-1.5 text-xs rounded-md font-medium"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            onClick={handleCopy}
          >
            {copied ? t("copied") : t("copyToken")}
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-md border"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add ConfirmActionModal and TokenRotateModal" \
  dashboard/src/components/panels/settings/ConfirmActionModal.tsx \
  dashboard/src/components/panels/settings/TokenRotateModal.tsx
```

---

### Task 8: PendingRequestRow Component

**Files:**

- Create: `dashboard/src/components/panels/settings/PendingRequestRow.tsx`

- [ ] **Step 1: Create pending request row**

`dashboard/src/components/panels/settings/PendingRequestRow.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PendingRequest } from "@/stores/devices";
import { useNotificationsStore } from "@/stores/notifications";

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function platformIcon(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case "ios":
      return "\u{1F4F1}"; // mobile phone
    case "android":
      return "\u{1F916}"; // robot
    default:
      return "\u{1F4BB}"; // laptop
  }
}

interface PendingRequestRowProps {
  request: PendingRequest;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export function PendingRequestRow({ request, onApprove, onReject }: PendingRequestRowProps) {
  const t = useTranslations("devices");
  const addToast = useNotificationsStore((s) => s.addToast);
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      if (action === "approve") {
        await onApprove(request.requestId);
      } else {
        await onReject(request.requestId);
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : t("errorNetwork"));
    } finally {
      setLoading(null);
    }
  };

  const role = request.role ?? request.roles?.[0] ?? "unknown";

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md text-xs"
      style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-subtle)" }}
    >
      <span>{platformIcon(request.platform)}</span>
      <span className="font-medium" style={{ color: "var(--foreground)" }}>
        {request.displayName ?? request.deviceId.slice(0, 12)}
      </span>
      <span
        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
        style={{ backgroundColor: "var(--primary-muted)", color: "var(--primary)" }}
      >
        {role}
      </span>
      <span style={{ color: "var(--text-tertiary)" }}>
        {t("requestedAgo", { time: timeAgo(request.ts) })}
      </span>

      <div className="ml-auto flex gap-1.5">
        <button
          className="px-2 py-1 rounded text-[10px] font-medium"
          style={{ backgroundColor: "var(--success)", color: "var(--success-fg)" }}
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
        >
          {loading === "approve" ? "..." : t("approve")}
        </button>
        <button
          className="px-2 py-1 rounded text-[10px] font-medium"
          style={{ backgroundColor: "var(--destructive-muted)", color: "var(--destructive)" }}
          onClick={() => handleAction("reject")}
          disabled={loading !== null}
        >
          {loading === "reject" ? "..." : t("reject")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add PendingRequestRow component" \
  dashboard/src/components/panels/settings/PendingRequestRow.tsx
```

---

### Task 9: DeviceRow Component

**Files:**

- Create: `dashboard/src/components/panels/settings/DeviceRow.tsx`

- [ ] **Step 1: Create collapsible device row**

`dashboard/src/components/panels/settings/DeviceRow.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { PairedDevice } from "@/stores/devices";
import { useNotificationsStore } from "@/stores/notifications";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { TokenRotateModal } from "./TokenRotateModal";

function platformIcon(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case "ios":
      return "\u{1F4F1}"; // mobile phone
    case "android":
      return "\u{1F916}"; // robot
    case "node":
      return "\u{1F5A5}\u{FE0F}"; // desktop computer
    default:
      return "\u{1F4BB}"; // laptop
  }
}

function timeAgo(ms?: number): string {
  if (!ms) return "\u2014";
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface DeviceRowProps {
  device: PairedDevice;
  isSelf: boolean;
  onRemove: (deviceId: string) => Promise<void>;
  onRotate: (deviceId: string, role: string) => Promise<string>;
  onRevoke: (deviceId: string, role: string) => Promise<void>;
}

export function DeviceRow({ device, isSelf, onRemove, onRotate, onRevoke }: DeviceRowProps) {
  const t = useTranslations("devices");
  const addToast = useNotificationsStore((s) => s.addToast);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "revoke";
    role?: string;
  } | null>(null);
  const [rotateConfirm, setRotateConfirm] = useState<{ role: string } | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  const roles = device.roles ?? (device.role ? [device.role] : []);
  const hasActiveToken = device.tokens?.some((tk) => !tk.revokedAtMs) ?? false;

  const handleRotateConfirmed = async () => {
    if (!rotateConfirm) return;
    try {
      const token = await onRotate(device.deviceId, rotateConfirm.role);
      setRotateConfirm(null);
      setNewToken(token);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : t("errorNetwork"));
      throw err;
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "remove") {
        await onRemove(device.deviceId);
      } else if (confirmAction.role) {
        await onRevoke(device.deviceId, confirmAction.role);
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : t("errorNetwork"));
      throw err;
    }
  };

  const displayName = device.displayName ?? device.deviceId.slice(0, 12);

  return (
    <>
      <Collapsible>
        <CollapsibleTrigger
          className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-md hover:bg-accent transition-colors"
          render={<div />}
        >
          <span>{platformIcon(device.platform)}</span>
          <span className="font-medium text-xs" style={{ color: "var(--foreground)" }}>
            {displayName}
          </span>
          {roles.map((r) => (
            <span
              key={r}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: "var(--primary-muted)", color: "var(--primary)" }}
            >
              {r}
            </span>
          ))}
          {isSelf && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: "var(--success-muted)", color: "var(--success)" }}
            >
              {t("thisDevice")}
            </span>
          )}
          <span
            className="ml-auto w-2 h-2 rounded-full"
            style={{ backgroundColor: hasActiveToken ? "var(--success)" : "var(--destructive)" }}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="px-3 pb-3 pt-1">
          <div className="ml-6 space-y-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {/* Detail fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {device.platform && (
                <>
                  <span>{t("platform")}</span>
                  <span>
                    {device.platform}
                    {device.deviceFamily ? ` / ${device.deviceFamily}` : ""}
                  </span>
                </>
              )}
              {device.remoteIp && (
                <>
                  <span>{t("ip")}</span>
                  <span>{device.remoteIp}</span>
                </>
              )}
              {device.approvedAtMs && (
                <>
                  <span>{t("pairedAgo", { time: "" })}</span>
                  <span>{timeAgo(device.approvedAtMs)}</span>
                </>
              )}
            </div>

            {/* Tokens table */}
            {device.tokens && device.tokens.length > 0 && (
              <div className="mt-2">
                <div className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  {t("tokens")}
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ color: "var(--text-tertiary)" }}>
                      <td className="pb-1">{t("role")}</td>
                      <td className="pb-1">{t("scopes")}</td>
                      <td className="pb-1">{t("lastActive", { time: "" })}</td>
                      <td className="pb-1 text-right">{t("status")}</td>
                    </tr>
                  </thead>
                  <tbody>
                    {device.tokens.map((tk) => (
                      <tr key={tk.role}>
                        <td className="py-0.5">{tk.role}</td>
                        <td className="py-0.5">{tk.scopes?.join(", ") ?? "\u2014"}</td>
                        <td className="py-0.5">{timeAgo(tk.lastUsedAtMs)}</td>
                        <td className="py-0.5 text-right">
                          <span
                            style={{
                              color: tk.revokedAtMs ? "var(--destructive)" : "var(--success)",
                            }}
                          >
                            {tk.revokedAtMs ? t("revoked") : t("active")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action buttons */}
            <div
              className="flex gap-2 mt-2 pt-2"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              {device.tokens?.map((tk) =>
                !tk.revokedAtMs ? (
                  <div key={tk.role} className="flex gap-1.5">
                    <button
                      className="px-2 py-1 rounded text-[10px] border"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      onClick={() => setRotateConfirm({ role: tk.role })}
                    >
                      {t("rotate")}
                    </button>
                    <button
                      className="px-2 py-1 rounded text-[10px]"
                      style={{
                        backgroundColor: "var(--destructive-muted)",
                        color: "var(--destructive)",
                        opacity: isSelf ? 0.4 : 1,
                        cursor: isSelf ? "not-allowed" : "pointer",
                      }}
                      onClick={() => !isSelf && setConfirmAction({ type: "revoke", role: tk.role })}
                      disabled={isSelf}
                      title={isSelf ? t("cannotRevokeSelf") : undefined}
                    >
                      {t("revoke")}
                    </button>
                  </div>
                ) : null,
              )}
              <button
                className="px-2 py-1 rounded text-[10px] ml-auto"
                style={{
                  backgroundColor: "var(--destructive-muted)",
                  color: "var(--destructive)",
                  opacity: isSelf ? 0.4 : 1,
                  cursor: isSelf ? "not-allowed" : "pointer",
                }}
                onClick={() => !isSelf && setConfirmAction({ type: "remove" })}
                disabled={isSelf}
                title={isSelf ? t("cannotRemoveSelf") : undefined}
              >
                {t("remove")}
              </button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Confirm modal for revoke/remove */}
      <ConfirmActionModal
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === "remove" ? t("remove") : t("revoke")}
        description={
          confirmAction?.type === "remove"
            ? t("confirmRemove", { name: displayName })
            : t("confirmRevoke", { name: displayName, role: confirmAction?.role ?? "" })
        }
        confirmLabel={confirmAction?.type === "remove" ? t("remove") : t("revoke")}
        variant="destructive"
        onConfirm={handleConfirmAction}
      />

      {/* Rotate confirm modal */}
      <ConfirmActionModal
        open={rotateConfirm !== null}
        onOpenChange={(open) => !open && setRotateConfirm(null)}
        title={t("rotate")}
        description={t("confirmRotate", { name: displayName, role: rotateConfirm?.role ?? "" })}
        confirmLabel={t("rotate")}
        onConfirm={handleRotateConfirmed}
      />

      {/* Token display modal */}
      <TokenRotateModal
        open={newToken !== null}
        onOpenChange={(open) => !open && setNewToken(null)}
        token={newToken}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add DeviceRow collapsible component" \
  dashboard/src/components/panels/settings/DeviceRow.tsx
```

---

### Task 10: DevicesSection + Settings Integration

**Files:**

- Create: `dashboard/src/components/panels/settings/DevicesSection.tsx`
- Modify: `dashboard/src/components/panels/settings/SettingsPanel.tsx`

DevicesSection uses the established Settings section pattern: `<section>` with `<h3 className="text-sm font-semibold mb-3">`. SSE is handled by the extracted `useDevicesSSE` hook (Task 6), NOT inlined.

- [ ] **Step 1: Create DevicesSection**

`dashboard/src/components/panels/settings/DevicesSection.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDevicesStore } from "@/stores/devices";
import { useDevicesSSE } from "@/hooks/useDevicesSSE";
import { DeviceRow } from "./DeviceRow";
import { PendingRequestRow } from "./PendingRequestRow";

export function DevicesSection() {
  const t = useTranslations("devices");
  const {
    pending,
    paired,
    selfDeviceId,
    loading,
    error,
    fetchDevices,
    fetchSelfDeviceId,
    approveRequest,
    rejectRequest,
    removeDevice,
    rotateToken,
    revokeToken,
  } = useDevicesStore();

  useEffect(() => {
    void fetchDevices();
    void fetchSelfDeviceId();
  }, [fetchDevices, fetchSelfDeviceId]);

  // Subscribe to SSE device pairing events via deckStream pattern
  useDevicesSSE();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h3>
        <button
          className="text-[10px] px-2 py-0.5 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          onClick={() => void fetchDevices()}
          disabled={loading}
        >
          {t("refresh")}
        </button>
      </div>

      {error && (
        <div
          className="mb-3 px-3 py-2 text-xs rounded-md"
          style={{
            color: "var(--destructive)",
            backgroundColor: "var(--destructive-muted)",
          }}
        >
          {error}
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-4">
          <h4
            className="text-[10px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("pending")} ({pending.length})
          </h4>
          <div className="space-y-1.5">
            {pending.map((req) => (
              <PendingRequestRow
                key={req.requestId}
                request={req}
                onApprove={approveRequest}
                onReject={rejectRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paired devices */}
      {paired.length > 0 ? (
        <div>
          <h4
            className="text-[10px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("paired")} ({paired.length})
          </h4>
          <div className="space-y-1">
            {paired.map((device) => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                isSelf={device.deviceId === selfDeviceId}
                onRemove={removeDevice}
                onRotate={rotateToken}
                onRevoke={revokeToken}
              />
            ))}
          </div>
        </div>
      ) : (
        !loading && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("empty")}
          </p>
        )
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add DevicesSection to SettingsPanel**

In `dashboard/src/components/panels/settings/SettingsPanel.tsx`, add the import:

```typescript
import { DevicesSection } from "./DevicesSection";
```

Add `<DevicesSection />` after `<ConnectionSection />` in the sections list:

```tsx
<div className="flex flex-col gap-6 max-w-lg">
  <AppearanceSection />
  <ConnectionSection />
  <DevicesSection />
  <NotificationSection />
  <AboutSection />
</div>
```

- [ ] **Step 3: Verify compilation**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep "error" | head -10
```

Expected: zero errors (or only pre-existing unrelated ones).

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add DevicesSection to Settings panel" \
  dashboard/src/components/panels/settings/DevicesSection.tsx \
  dashboard/src/components/panels/settings/SettingsPanel.tsx
```

---

### Task 11: NavRail Badge

**Files:**

- Modify: `dashboard/src/lib/panel-registry.ts`
- Modify: `dashboard/src/components/layout/NavRail.tsx`

The `PanelEntry` interface does not currently have badge support. Add an optional `badge` callback field, render it in NavRail, and wire the devices pending count for the Settings panel.

- [ ] **Step 1: Add badge field to PanelEntry**

In `dashboard/src/lib/panel-registry.ts`, add the optional `badge` field to the `PanelEntry` interface:

```typescript
export interface PanelEntry {
  readonly id: string;
  readonly group: "core" | "observe" | "automate" | "control";
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly component: PanelComponent;
  readonly shortcutIndex?: number;
  readonly eager?: boolean;
  readonly position?: "bottom";
  /** Optional dynamic badge count. When non-zero, NavRail renders a numeric badge. */
  readonly badge?: () => number;
}
```

- [ ] **Step 2: Wire badge count for Settings panel**

In the `PANELS` array in `panel-registry.ts`, update the settings entry to include a badge function. The badge needs to read from the devices store. Import the store at the top:

```typescript
import { useDevicesStore } from "@/stores/devices";
```

Update the settings panel entry:

```typescript
{
  id: "settings",
  group: "control",
  icon: Settings,
  labelKey: "settings",
  component: lazy(() =>
    import("@/components/panels/settings/SettingsPanel").then((m) => ({
      default: m.SettingsPanel,
    })),
  ),
  position: "bottom",
  badge: () => useDevicesStore.getState().pending.length,
},
```

> Note: `useDevicesStore.getState()` is safe outside React components — it reads the current snapshot synchronously. The NavRail re-renders on panel changes, and the devices store updates on SSE events, so the badge count stays current.

- [ ] **Step 3: Render badge in NavRail**

In `dashboard/src/components/layout/NavRail.tsx`, add a helper function and update both the main nav items and bottom panels to render badges.

Add this helper inside the component, before the `navContent` JSX:

```typescript
const renderBadge = (item: PanelEntry) => {
  if (!item.badge) return null;
  const count = item.badge();
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-semibold"
      style={{
        backgroundColor: "var(--destructive)",
        color: "var(--destructive-fg)",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};
```

In the nav group items rendering, wrap the icon area in a `relative` span and render the badge. Replace the nav button content in both loops:

For the main nav group items (around the `group.items.map` block):

```tsx
<button
  key={item.id}
  onClick={() => handleNavClick(item.id as Panel)}
  className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
    collapsed ? "justify-center" : ""
  }`}
  style={{
    color: isActive ? "var(--primary)" : "var(--foreground)",
    backgroundColor: isActive
      ? "color-mix(in srgb, var(--primary) 12%, transparent)"
      : "transparent",
  }}
  title={collapsed ? t(item.labelKey) : undefined}
>
  <span className="relative">
    <Icon size={16} />
    {renderBadge(item)}
  </span>
  {!collapsed && <span>{t(item.labelKey)}</span>}
</button>
```

Apply the same pattern for the bottom panels loop.

- [ ] **Step 4: Verify compilation**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep "panel-registry\|NavRail" | head -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add NavRail badge support with devices pending count" \
  dashboard/src/lib/panel-registry.ts \
  dashboard/src/components/layout/NavRail.tsx
```

---

### Task 12: Verification

- [ ] **Step 1: Type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 2: Protocol gen check**

```bash
pnpm protocol:gen:check
```

Expected: "all files up to date"

- [ ] **Step 3: Format**

```bash
pnpm format:fix
```

- [ ] **Step 4: Lint**

```bash
pnpm check 2>&1 | tail -10
```

Expected: no new errors from our files.

- [ ] **Step 5: Visual smoke test**

Start dev environment and verify:

```bash
scripts/dev/deck-dev.sh
```

1. Open `http://localhost:3000`
2. Navigate to Settings panel
3. Verify "Devices" section appears below "Connection" with `<section>` + `<h3>` matching other sections
4. Verify device list loads (should show at least Deck itself)
5. Verify "This Device" badge appears on Deck's own entry
6. Verify expand/collapse works on device rows
7. Verify Remove/Revoke buttons are disabled on self-device
8. Verify NavRail Settings icon shows pending count badge (if any pending requests exist)
9. Verify all text comes from i18n (switch locale, check no hardcoded strings)

- [ ] **Step 6: Final commit (format/lint fixups if any)**

```bash
scripts/committer "[enhanced] chore(deck): format fixups for device management" \
  <any files changed by format:fix>
```
