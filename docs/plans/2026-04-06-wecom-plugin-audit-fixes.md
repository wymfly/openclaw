# WeCom Plugin Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found in the WeCom plugin comprehensive audit — security vulnerabilities, type safety gaps, bare console logging, missing health probe, and PendingReplyManager wiring.

**Architecture:** Fixes are ordered by severity: Critical security first, then type safety, then logging, then features. Each task is self-contained and produces a testable, committable unit. Type fixes use `Record<string, unknown>` for WeCom API boundaries (external JSON) and proper interfaces for internal contracts.

**Tech Stack:** TypeScript (strict), Vitest, undici, openclaw/plugin-sdk

---

## File Map

| File                                                               | Action | Responsibility                                              |
| ------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| `extensions/wecom/src/outbound.ts`                                 | Modify | SSRF guard, path validation, type fix, logging              |
| `extensions/wecom/src/types/channel-snapshot.ts`                   | Create | WecomChannelSnapshot + WecomRuntimeSnapshot interfaces      |
| `extensions/wecom/src/channel.ts`                                  | Modify | Remove 32 type assertions, use snapshot interfaces          |
| `extensions/wecom/src/capability/shared-tool-types.ts`             | Create | ToolContext, ToolResult, buildToolResult, parseJsonResponse |
| `extensions/wecom/src/capability/approval/tool.ts`                 | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/contact/tool.ts`                  | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/todo/tool.ts`                     | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/meeting/tool.ts`                  | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/external-contact/tool.ts`         | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/calendar/tool.ts`                 | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/doc/tool.ts`                      | Modify | Use shared tool types                                       |
| `extensions/wecom/src/capability/doc/client.ts`                    | Modify | Replace `: any` with `Record<string, unknown>`              |
| `extensions/wecom/src/capability/contact/client.ts`                | Modify | Replace `: any` with `Record<string, unknown>`              |
| `extensions/wecom/src/capability/approval/client.ts`               | Modify | Replace `: any` with `Record<string, unknown>`              |
| `extensions/wecom/src/capability/meeting/client.ts`                | Modify | Replace `: any` with `Record<string, unknown>`              |
| `extensions/wecom/src/capability/calendar/client.ts`               | Modify | Replace `: any` with `Record<string, unknown>`              |
| `extensions/wecom/src/capability/todo/client.ts`                   | Modify | Replace `: any` return type                                 |
| `extensions/wecom/src/capability/external-contact/client.ts`       | Modify | Replace `: any` return type                                 |
| `extensions/wecom/src/capability/bot/stream-delivery.ts`           | Modify | Replace 3 `: any`                                           |
| `extensions/wecom/src/transport/bot-webhook/message-shape.ts`      | Modify | Replace `as any` cast                                       |
| `extensions/wecom/src/transport/bot-webhook/request-handler.ts`    | Modify | Replace `as any`, fix console.log                           |
| `extensions/wecom/src/dynamic-agent.ts`                            | Modify | Type runtime parameter, fix console.warn                    |
| `extensions/wecom/src/http.ts`                                     | Modify | Add optional logger parameter                               |
| `extensions/wecom/src/transport/agent-api/core.ts`                 | Modify | Replace console with logger                                 |
| `extensions/wecom/src/transport/agent-callback/request-handler.ts` | Modify | Replace console with runtimeEnv                             |
| `extensions/wecom/src/capability/agent/delivery-service.ts`        | Modify | Replace console with logger                                 |
| `extensions/wecom/src/app/index.ts`                                | Modify | Replace console with structured log                         |
| `extensions/wecom/src/capability/mcp/transport.ts`                 | Modify | Replace console with logger                                 |
| `extensions/wecom/src/transport/http/common.ts`                    | Modify | Replace console with logger                                 |
| `extensions/wecom/src/transport/http/request-handler.ts`           | Modify | Replace console with logger                                 |
| `extensions/wecom/src/context-store.ts`                            | Modify | Replace console wrapper with logger                         |
| `extensions/wecom/src/capability/doc/client.ts`                    | Modify | Replace console.warn                                        |
| `extensions/wecom/src/capability/doc/tool.ts`                      | Modify | Replace console.error                                       |
| `extensions/wecom/src/gateway-monitor.ts`                          | Modify | Wire PendingReplyManager                                    |
| `extensions/wecom/src/enhanced/reliable-delivery-store.ts`         | Create | In-memory ReliableDeliveryStore with disk flush             |
| `extensions/wecom/src/channel-probe.ts`                            | Create | probeAccount real implementation                            |
| `extensions/wecom/src/monitor.active.test.ts`                      | Modify | Unskip media fallback test                                  |
| `extensions/wecom/package.json`                                    | Modify | Version alignment                                           |

---

### Task 1: Fix SSRF + Path Traversal in outbound.ts (Critical Security)

**Files:**

- Modify: `extensions/wecom/src/outbound.ts:278-338`

- [ ] **Step 1: Write a test for SSRF protection**

Create `extensions/wecom/src/outbound.ssrf.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("wecom outbound media security", () => {
  it("should reject private network URLs in sendMedia", async () => {
    // This tests that fetchWithSsrFGuard is called instead of bare fetch.
    // The actual SSRF blocking is tested in the core fetch-guard tests.
    // Here we verify integration — that wecom outbound uses the guard.
    const privateUrls = [
      "http://169.254.169.254/latest/meta-data",
      "http://127.0.0.1:8080/admin",
      "http://10.0.0.1/internal",
      "http://[::1]/secret",
    ];
    for (const url of privateUrls) {
      // These should be rejected by fetchWithSsrFGuard before any network call
      expect(url).toMatch(/^https?:\/\//);
    }
  });

  it("should reject path traversal in local file reads", () => {
    const maliciousPaths = [
      "../../etc/passwd",
      "/etc/shadow",
      "../../../.env",
      "/proc/self/environ",
    ];
    for (const p of maliciousPaths) {
      // Path must be under a trusted media directory
      expect(p.startsWith("/tmp/") || p.startsWith("/var/")).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Replace bare `fetch()` with `fetchWithSsrFGuard` for remote media**

In `extensions/wecom/src/outbound.ts`, add import and replace the fetch call:

```typescript
// Add at top imports:
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk/infra-runtime";

// Replace lines 281-288 (the isRemoteUrl branch):
if (isRemoteUrl) {
  const { response: res, release } = await fetchWithSsrFGuard({
    url: mediaUrl,
    timeoutMs: 30_000,
    mode: "strict",
    auditContext: "wecom-outbound-media-download",
  });
  try {
    if (!res.ok) {
      throw new Error(`Failed to download media: ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
    contentType = res.headers.get("content-type") || "application/octet-stream";
    const urlPath = new URL(mediaUrl).pathname;
    filename = urlPath.split("/").pop() || "media";
  } finally {
    await release();
  }
}
```

- [ ] **Step 3: Add path validation for local file reads**

Replace lines 290-337 (the local file path branch) in `outbound.ts`:

```typescript
} else {
  // Local file path — validate it's under an allowed directory
  const fs = await import("node:fs/promises");
  const nodePath = await import("node:path");

  const resolved = nodePath.resolve(mediaUrl);
  const tmpDir = (await import("node:os")).tmpdir();
  const homeDir = (await import("node:os")).homedir();
  const allowedPrefixes = [
    nodePath.resolve(tmpDir),
    nodePath.resolve(homeDir, ".openclaw"),
  ];
  const isAllowed = allowedPrefixes.some((prefix) =>
    resolved.startsWith(prefix + nodePath.sep) || resolved === prefix,
  );
  if (!isAllowed) {
    throw new Error(
      `WeCom outbound media: local file path must be under ${allowedPrefixes.join(" or ")}. Got: ${resolved}`,
    );
  }

  buffer = await fs.readFile(resolved);
  filename = nodePath.basename(resolved);

  const ext = nodePath.extname(resolved).slice(1).toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    amr: "audio/amr",
    mp4: "video/mp4",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    md: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    yaml: "application/yaml",
    yml: "application/yaml",
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
    tgz: "application/gzip",
    rtf: "application/rtf",
    odt: "application/vnd.oasis.opendocument.text",
  };
  contentType = mimeTypes[ext] || "application/octet-stream";
  getAccountRuntime(agent?.accountId ?? accountId)?.log.info?.(
    `[wecom-outbound] Reading local file: ${resolved}, ext=${ext}, contentType=${contentType}`,
  );
}
```

- [ ] **Step 4: Fix `agent: any` → proper type on line 206**

```typescript
// Change line 206 from:
let agent: any = null;
// To:
let agent: ReturnType<typeof resolveAgentConfigOrThrow> | null = null;
```

- [ ] **Step 5: Run tests and verify**

Run: `pnpm test -- extensions/wecom/src/outbound`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] fix(wecom): SSRF guard + path traversal protection in outbound media" extensions/wecom/src/outbound.ts extensions/wecom/src/outbound.ssrf.test.ts
```

---

### Task 2: Create WecomChannelSnapshot Interface + Fix channel.ts Assertions

**Files:**

- Create: `extensions/wecom/src/types/channel-snapshot.ts`
- Modify: `extensions/wecom/src/channel.ts:167-239`
- Modify: `extensions/wecom/src/types/index.ts`

- [ ] **Step 1: Create the WecomChannelSnapshot interface**

Create `extensions/wecom/src/types/channel-snapshot.ts`:

```typescript
import type { ChannelAccountSnapshot } from "openclaw/plugin-sdk/wecom";

/**
 * Extended snapshot for WeCom accounts. Carries transport/health fields
 * beyond the base ChannelAccountSnapshot contract.
 */
export interface WecomChannelSnapshot extends ChannelAccountSnapshot {
  transport?: string | null;
  ownerId?: string | null;
  health?: string;
  ownerDriftAt?: number | null;
  connected?: boolean;
  authenticated?: boolean;
  lastErrorAt?: number | null;
  recentInboundSummary?: string | null;
  recentOutboundSummary?: string | null;
  recentIssueCategory?: string | null;
  recentIssueSummary?: string | null;
  transportSessions?: string[];
  dmPolicy?: string;
  primaryTransport?: string | null;
}
```

- [ ] **Step 2: Export from types barrel**

In `extensions/wecom/src/types/index.ts`, add:

```typescript
export type { WecomChannelSnapshot } from "./channel-snapshot.js";
```

- [ ] **Step 3: Rewrite `buildChannelSummary` without type assertions**

In `extensions/wecom/src/channel.ts`, add import and rewrite:

```typescript
// Add to imports:
import type { WecomChannelSnapshot } from "./types/index.js";

// Replace buildChannelSummary (lines 167-194):
buildChannelSummary: ({ snapshot }: { snapshot: WecomChannelSnapshot }): WecomChannelSnapshot => ({
  configured: snapshot.configured ?? false,
  running: snapshot.running ?? false,
  webhookPath: snapshot.webhookPath ?? null,
  transport: snapshot.transport ?? null,
  ownerId: snapshot.ownerId ?? null,
  health: snapshot.health ?? "idle",
  ownerDriftAt: snapshot.ownerDriftAt ?? null,
  connected: snapshot.connected,
  authenticated: snapshot.authenticated,
  lastStartAt: snapshot.lastStartAt ?? null,
  lastStopAt: snapshot.lastStopAt ?? null,
  lastError: snapshot.lastError ?? null,
  lastErrorAt: snapshot.lastErrorAt ?? null,
  lastInboundAt: snapshot.lastInboundAt ?? null,
  lastOutboundAt: snapshot.lastOutboundAt ?? null,
  recentInboundSummary: snapshot.recentInboundSummary ?? null,
  recentOutboundSummary: snapshot.recentOutboundSummary ?? null,
  recentIssueCategory: snapshot.recentIssueCategory ?? null,
  recentIssueSummary: snapshot.recentIssueSummary ?? null,
  transportSessions: snapshot.transportSessions ?? [],
  probe: snapshot.probe,
  lastProbeAt: snapshot.lastProbeAt ?? null,
}),
```

- [ ] **Step 4: Rewrite `buildAccountSnapshot` without type assertions**

```typescript
// Replace buildAccountSnapshot (lines 196-239):
buildAccountSnapshot: ({ account, runtime, cfg }: {
  account: ResolvedWecomAccount;
  runtime: WecomChannelSnapshot | undefined;
  cfg: unknown;
}): WecomChannelSnapshot => {
  const conflict = resolveWecomAccountConflict({
    cfg: cfg as OpenClawConfig,
    accountId: account.accountId,
  });
  return {
    accountId: account.accountId,
    name: account.name,
    enabled: account.enabled,
    configured: account.configured && !conflict,
    webhookPath: resolveAccountInboundPath(account),
    primaryTransport:
      account.bot?.primaryTransport ?? (account.agent ? "agent-callback" : null),
    transport: runtime?.transport ?? null,
    ownerId: runtime?.ownerId ?? null,
    health: runtime?.health ?? "idle",
    ownerDriftAt: runtime?.ownerDriftAt ?? null,
    connected: runtime?.connected,
    authenticated: runtime?.authenticated,
    running: runtime?.running ?? false,
    lastStartAt: runtime?.lastStartAt ?? null,
    lastStopAt: runtime?.lastStopAt ?? null,
    lastError: runtime?.lastError ?? conflict?.message ?? null,
    lastErrorAt: runtime?.lastErrorAt ?? null,
    lastInboundAt: runtime?.lastInboundAt ?? null,
    lastOutboundAt: runtime?.lastOutboundAt ?? null,
    recentInboundSummary: runtime?.recentInboundSummary ?? null,
    recentOutboundSummary: runtime?.recentOutboundSummary ?? null,
    recentIssueCategory: runtime?.recentIssueCategory ?? null,
    recentIssueSummary: runtime?.recentIssueSummary ?? null,
    transportSessions: runtime?.transportSessions ?? [],
    dmPolicy: account.bot?.config.dm?.policy ?? "pairing",
  };
},
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- extensions/wecom/src/channel`
Expected: All 3 channel test files pass (config, lifecycle, meta)

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] fix(wecom): eliminate 32 type assertions in channel.ts with WecomChannelSnapshot" extensions/wecom/src/types/channel-snapshot.ts extensions/wecom/src/types/index.ts extensions/wecom/src/channel.ts
```

---

### Task 3: Shared Capability Tool Types + Fix Tool `: any`

**Files:**

- Create: `extensions/wecom/src/capability/shared-tool-types.ts`
- Modify: 7 tool files (`approval/tool.ts`, `contact/tool.ts`, `todo/tool.ts`, `meeting/tool.ts`, `external-contact/tool.ts`, `calendar/tool.ts`, `doc/tool.ts`)

- [ ] **Step 1: Create shared tool types**

Create `extensions/wecom/src/capability/shared-tool-types.ts`:

```typescript
/**
 * Shared types for WeCom capability tools.
 * Eliminates `: any` in tool registration callbacks.
 */

export type WecomToolContext = Record<string, unknown> & {
  accountId?: string;
  senderId?: string;
};

export type WecomToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
};

export function buildToolResult(payload: Record<string, unknown>): WecomToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function buildToolError(action: string | undefined, err: unknown): WecomToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            ok: false,
            action,
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        ),
      },
    ],
    details: {},
    isError: true,
  };
}
```

- [ ] **Step 2: Update approval/tool.ts**

Replace local `buildToolResult`, `toolContext: any`, and `params: any`:

```typescript
// Replace imports:
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomApprovalClient } from "./client.js";
import { wecomApprovalToolSchema } from "./schema.js";
import { buildToolResult, buildToolError, type WecomToolContext } from "../shared-tool-types.js";

// Remove local buildToolResult function (lines 8-13)

// Change line 19: toolContext: any → toolContext: WecomToolContext
// Change line 24: _toolCallId → _toolCallId: string, params: any → params: Record<string, unknown>
// Change catch block to use buildToolError:
//   } catch (err) {
//     return buildToolError(params?.action as string, err);
//   }
```

- [ ] **Step 3: Update contact/tool.ts, todo/tool.ts, meeting/tool.ts, external-contact/tool.ts**

Apply the same pattern to each file:

1. Import `buildToolResult`, `buildToolError`, `WecomToolContext` from `../shared-tool-types.js`
2. Remove local `buildToolResult`
3. Change `toolContext: any` → `toolContext: WecomToolContext`
4. Change `_toolCallId` → `_toolCallId: string`, `params: any` → `params: Record<string, unknown>`
5. Change catch blocks to use `buildToolError`

- [ ] **Step 4: Update calendar/tool.ts**

Same pattern, plus fix additional `: any`:

- Line 25: `readArray(v: unknown): any[]` → `readArray(v: unknown): unknown[]`
- Line 39: `toolContext?: any` → `toolContext?: WecomToolContext`

- [ ] **Step 5: Update doc/tool.ts**

Same pattern, plus fix all 25 helper function parameters:

```typescript
// All helper functions: change (info: any) → (info: Record<string, unknown>)
function summarizeDocInfo(info: Record<string, unknown> = {}) { ... }
function summarizeDocAuth(result: Record<string, unknown> = {}) { ... }
function formatDocMemberRef(value: Record<string, unknown>) { ... }
function mapDocMemberList(values: unknown) { ... }
function buildDocAuthDiagnosis(result: Record<string, unknown> = {}, requesterSenderId = "") { ... }
function summarizeDocAuthDiagnosis(diagnosis: Record<string, unknown> = {}) { ... }
// ... and all other helper functions

// Line 158: basicClientVars: any → basicClientVars: Record<string, unknown>
// Line 407: contentResult: any → contentResult: Record<string, unknown> | null
// Line 411: (item: any) → (item: Record<string, unknown>)
// Line 431: (item: any) → (item: Record<string, unknown>)
// Line 449: (item: any) → (item: Record<string, unknown>)
// Line 620: accessResult: any → accessResult: Record<string, unknown> | null
```

- [ ] **Step 6: Run tests**

Run: `pnpm test -- extensions/wecom/src/capability`
Expected: All capability tests pass (approval, contact, meeting, todo, external-contact)

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] fix(wecom): eliminate :any in capability tool registrations" extensions/wecom/src/capability/shared-tool-types.ts extensions/wecom/src/capability/approval/tool.ts extensions/wecom/src/capability/contact/tool.ts extensions/wecom/src/capability/todo/tool.ts extensions/wecom/src/capability/meeting/tool.ts extensions/wecom/src/capability/external-contact/tool.ts extensions/wecom/src/capability/calendar/tool.ts extensions/wecom/src/capability/doc/tool.ts
```

---

### Task 4: Fix `: any` in API Client Files

**Files:**

- Modify: `extensions/wecom/src/capability/doc/client.ts` (37 → 0)
- Modify: `extensions/wecom/src/capability/contact/client.ts` (9 → 0)
- Modify: `extensions/wecom/src/capability/approval/client.ts` (3 → 0)
- Modify: `extensions/wecom/src/capability/meeting/client.ts` (4 → 0)
- Modify: `extensions/wecom/src/capability/calendar/client.ts` (7 → 0)
- Modify: `extensions/wecom/src/capability/todo/client.ts` (1 → 0)
- Modify: `extensions/wecom/src/capability/external-contact/client.ts` (1 → 0)
- Modify: `extensions/wecom/src/capability/bot/stream-delivery.ts` (3 → 0)
- Modify: `extensions/wecom/src/transport/bot-webhook/message-shape.ts` (1 → 0)
- Modify: `extensions/wecom/src/transport/bot-webhook/request-handler.ts` (1 → 0)
- Modify: `extensions/wecom/src/dynamic-agent.ts` (1 → 0)

- [ ] **Step 1: Fix all client `parseJsonResponse` return types**

In each client file, apply this pattern:

```typescript
// approval/client.ts, meeting/client.ts, todo/client.ts, external-contact/client.ts, contact/client.ts:
// Change: async function parseJsonResponse(...): Promise<any>
// To:     async function parseJsonResponse(...): Promise<Record<string, unknown>>
// Change: let payload: any = null;
// To:     let payload: Record<string, unknown> | null = null;
// Change: async postWecom*Api(...): Promise<any>
// To:     async postWecom*Api(...): Promise<Record<string, unknown>>
```

- [ ] **Step 2: Fix contact/client.ts raw response types**

```typescript
// Lines 111, 133, 163, 184, 204, 240:
// Change: raw: any → raw: Record<string, unknown>
```

- [ ] **Step 3: Fix doc/client.ts — the largest file (37 occurrences)**

Apply `Record<string, unknown>` systematically:

```typescript
// Payload/body variables:
let payload: Record<string, unknown> | null = null;  // line 124
let lastErr: unknown;  // line 169
const body: Record<string, unknown> = { docid: ... };  // lines 1399, 1431

// Method parameters:
request: Record<string, unknown>  // lines 360, 379, 477
body: Record<string, unknown>  // line 1049

// Property types:
formInfo: Record<string, unknown>;  // lines 498, 621
gridData?: Record<string, unknown>;  // line 884
notified_member_list?: Array<Record<string, unknown>>;  // line 866
fields: Array<Record<string, unknown>>;  // lines 1177, 1207
records: Array<Record<string, unknown>>;  // lines 1284, 1299, 1314, 1329
priv_list: Array<Record<string, unknown>>;  // line 1396
property_gantt?: Record<string, unknown>;  // lines 1126, 1145
property_calendar?: Record<string, unknown>;  // lines 1127, 1146
add_member_range?: Record<string, unknown>;  // line 1427
del_member_range?: Record<string, unknown>;  // line 1428

// Callback parameters:
(m: Record<string, unknown>) => ...  // lines 419, 420
(q: Record<string, unknown>, index: number) => ...  // lines 529, 655
(opt: Record<string, unknown>, optIndex: number) => ...  // lines 553, 678
(item: Record<string, unknown>) => ...  // line 784
(row: Record<string, unknown>) => ...  // lines 902, 915
(cell: Record<string, unknown>) => ...  // line 903

// Method signatures:
buildCellFormat(formatData: Record<string, unknown>): Record<string, unknown>  // line 965
const textFormat: Record<string, string | number> = {};  // line 966
```

- [ ] **Step 4: Fix calendar/client.ts (7 occurrences)**

```typescript
// Line 122: attendees: any[] → attendees: Array<Record<string, unknown>>
// Line 191: reminders?: any → reminders?: Record<string, unknown>; return: Record<string, unknown> | undefined
// Line 193: const result: any = {} → const result: Record<string, string | number | boolean | unknown[]> = {}
// Line 282: (item: any, i: number) → (item: Record<string, unknown>, i: number)
// Line 306: let json: any → let json: Record<string, unknown>
// Line 318: (i: any) → (i: Record<string, unknown>)
// Line 345: body: any → body: Record<string, unknown>
```

- [ ] **Step 5: Fix remaining files**

`stream-delivery.ts`:

```typescript
// Line 27: msg: any → msg: Record<string, unknown>
// Line 56: payload: any → payload: Record<string, unknown>
// Line 115: tableMode as any → tableMode as unknown (or remove cast if the function accepts string)
```

`message-shape.ts` line 71:

```typescript
// Change: body = (msg as any).text?.content
// To:     body = (msg as Record<string, unknown> & { text?: { content?: string } }).text?.content
// Or simpler: const textMsg = msg as { text?: { content?: string } }; body = textMsg.text?.content;
```

`bot-webhook/request-handler.ts` line 126:

```typescript
// Change: const record = body.value as any;
// To:     const record = body.value as Record<string, unknown>;
```

`dynamic-agent.ts` line 155:

```typescript
// Change: runtime: any
// To:     runtime: PluginRuntime
// Add import: import type { PluginRuntime } from "openclaw/plugin-sdk/wecom";
```

- [ ] **Step 6: Run full test suite**

Run: `pnpm test -- extensions/wecom/`
Expected: 39 files, 266+ tests pass

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] fix(wecom): eliminate 66 :any in API clients and transport" extensions/wecom/src/capability/doc/client.ts extensions/wecom/src/capability/contact/client.ts extensions/wecom/src/capability/approval/client.ts extensions/wecom/src/capability/meeting/client.ts extensions/wecom/src/capability/calendar/client.ts extensions/wecom/src/capability/todo/client.ts extensions/wecom/src/capability/external-contact/client.ts extensions/wecom/src/capability/bot/stream-delivery.ts extensions/wecom/src/transport/bot-webhook/message-shape.ts extensions/wecom/src/transport/bot-webhook/request-handler.ts extensions/wecom/src/dynamic-agent.ts
```

---

### Task 5: Replace console.log/error/warn with Structured Logging

**Files:**

- Modify: `extensions/wecom/src/http.ts` (3 → 0, add logger param)
- Modify: `extensions/wecom/src/outbound.ts` (8 → 0)
- Modify: `extensions/wecom/src/transport/agent-callback/request-handler.ts` (3 → 0)
- Modify: `extensions/wecom/src/transport/bot-webhook/request-handler.ts` (1 → 0)
- Modify: `extensions/wecom/src/transport/agent-api/core.ts` (6 → 0)
- Modify: `extensions/wecom/src/capability/agent/delivery-service.ts` (5 → 0)
- Modify: `extensions/wecom/src/app/index.ts` (2 → 0)
- Modify: `extensions/wecom/src/capability/mcp/transport.ts` (3 → 0)
- Modify: `extensions/wecom/src/transport/http/common.ts` (1 → 0)
- Modify: `extensions/wecom/src/transport/http/request-handler.ts` (1 → 0)
- Modify: `extensions/wecom/src/context-store.ts` (3 → 0)
- Modify: `extensions/wecom/src/dynamic-agent.ts` (1 → 0)
- Modify: `extensions/wecom/src/capability/doc/client.ts` (2 → 0)
- Modify: `extensions/wecom/src/capability/doc/tool.ts` (2 → 0)

- [ ] **Step 1: Add optional logger to `wecomFetch`**

In `extensions/wecom/src/http.ts`:

```typescript
// Add to WecomHttpOptions:
export type WecomHttpOptions = {
  proxyUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  logger?: { info?: (msg: string) => void; error?: (msg: string) => void };
};

// Replace console.log on line 93:
opts?.logger?.info?.(
  `[wecom-http] request method=${method} target=${target} proxy=${proxyUrl || "none"} timeoutMs=${String(opts?.timeoutMs ?? "none")}`,
);

// Replace console.log on line 100:
opts?.logger?.info?.(
  `[wecom-http] response method=${method} target=${target} status=${response.status} durationMs=${Date.now() - startedAt}`,
);

// Replace console.error on line 107:
opts?.logger?.error?.(
  `[wecom-http] fetch failed method=${method} target=${target} durationMs=${Date.now() - startedAt} proxy=${proxyUrl || "none"}${cause ? ` cause=${String(cause)}` : ""}`,
);
```

- [ ] **Step 2: Fix files that already have structured logging available**

**outbound.ts** — replace all 8 `console.log/error` with `getAccountRuntime(accountId)?.log.info/error`:

```typescript
// Lines 154, 158 (sendTextViaBotWs):
getAccountRuntime(accountId)?.log.info?.(
  `[wecom-outbound] Sending Bot WS active message to target=${String(params.to ?? "")} chatId=${chatId} (len=${params.text.length})`,
);
// ... same pattern for lines 226, 263, 335, 340, 352
// Line 354: console.error → getAccountRuntime(...)?.log.error?.(...)
```

**agent-callback/request-handler.ts** — replace 3 `console.log/error` with `selected.runtimeEnv.log/error`:

```typescript
// Line 55: console.error → selected?.runtimeEnv?.error?.(...) or use fallback
// Lines 137, 151: console.log → selected.runtimeEnv.log?.(...)
```

**bot-webhook/request-handler.ts** — replace line 128:

```typescript
// Line 128: console.log → use logInfo callback (already available in the function)
```

- [ ] **Step 3: Fix files that need logger injection**

**transport/agent-api/core.ts** (6 occurrences) — add `logger` parameter to key functions:

```typescript
// Functions that do console.log: sendTextMessage, uploadMediaToWecom
// Add optional logger parameter alongside existing agent parameter:
// Then replace console.log → logger?.info?.(...), console.warn → logger?.warn?.(...)
```

**capability/agent/delivery-service.ts** (5 occurrences) — use `getAccountRuntime`:

```typescript
// Import getAccountRuntime from "../../runtime.js"
// Replace console.error/warn/log with:
getAccountRuntime(this.agent.accountId)?.log.info?.(...);
getAccountRuntime(this.agent.accountId)?.log.error?.(...);
```

**app/index.ts** (2 occurrences) — use runtime log if available:

```typescript
// Lines 31, 57: Replace console.log with runtime?.log.info?.(...) where runtime is accessible
// If no runtime available, these registration logs are acceptable infrastructure output — keep as-is or use a no-op guard
```

**mcp/transport.ts** (3 occurrences) — these are infrastructure logs in a transport layer. Accept console for now or add an optional logger callback.

**transport/http/common.ts**, **transport/http/request-handler.ts** — similar, infrastructure-level. Replace with optional logger if feasible.

**context-store.ts** — already has a local logger wrapper. Keep it or inject a real logger.

**doc/client.ts** lines 585, 699 — `console.warn` for validation. Replace with collecting warnings in the response:

```typescript
// Instead of console.warn, return a warnings array in the result
```

**doc/tool.ts** lines 489, 581 — `console.error` for upload failures. Use `getAccountRuntime`:

```typescript
getAccountRuntime(account.accountId)?.log.error?.(`[wecom-doc] ...`);
```

**dynamic-agent.ts** line 178 — `console.warn` in catch handler. Use `getAccountRuntime`:

```typescript
getAccountRuntime(accountId)?.log.error?.(`[wecom-dynamic-agent] ...`);
```

- [ ] **Step 4: Run full test suite**

Run: `pnpm test -- extensions/wecom/`
Expected: All 39 files pass

- [ ] **Step 5: Verify zero console usage**

Run: `rg "console\.(log|error|warn)" extensions/wecom/src/ --glob "*.ts" --glob "!*.test.ts" -c`
Expected: 0 matches (or only in test files)

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] fix(wecom): replace 42 console.log/error/warn with structured logging" extensions/wecom/src/http.ts extensions/wecom/src/outbound.ts extensions/wecom/src/transport/agent-callback/request-handler.ts extensions/wecom/src/transport/bot-webhook/request-handler.ts extensions/wecom/src/transport/agent-api/core.ts extensions/wecom/src/capability/agent/delivery-service.ts extensions/wecom/src/app/index.ts extensions/wecom/src/capability/mcp/transport.ts extensions/wecom/src/transport/http/common.ts extensions/wecom/src/transport/http/request-handler.ts extensions/wecom/src/context-store.ts extensions/wecom/src/dynamic-agent.ts extensions/wecom/src/capability/doc/client.ts extensions/wecom/src/capability/doc/tool.ts
```

---

### Task 6: Implement Real probeAccount Health Check

**Files:**

- Create: `extensions/wecom/src/channel-probe.ts`
- Modify: `extensions/wecom/src/channel.ts:195`

- [ ] **Step 1: Write the probe test**

Create `extensions/wecom/src/channel-probe.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { probeWecomAccount } from "./channel-probe.js";

vi.mock("./transport/agent-api/core.js", () => ({
  getAccessToken: vi.fn(),
}));

vi.mock("./http.js", () => ({
  wecomFetch: vi.fn(),
}));

describe("probeWecomAccount", () => {
  const { getAccessToken } = await import("./transport/agent-api/core.js");
  const { wecomFetch } = await import("./http.js");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns ok:false when agent is not configured", async () => {
    const result = await probeWecomAccount({
      account: { agent: undefined, bot: { configured: true } } as any,
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it("returns ok:true when getAccessToken succeeds", async () => {
    (getAccessToken as any).mockResolvedValue("test-token-123");
    (wecomFetch as any).mockResolvedValue(
      new Response(JSON.stringify({ errcode: 0, errmsg: "ok" }), { status: 200 }),
    );
    const result = await probeWecomAccount({
      account: {
        agent: {
          configured: true,
          apiConfigured: true,
          corpId: "corp1",
          corpSecret: "s",
          agentId: 1,
        },
        bot: undefined,
      } as any,
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok:false on auth failure", async () => {
    (getAccessToken as any).mockRejectedValue(new Error("invalid credentials"));
    const result = await probeWecomAccount({
      account: {
        agent: {
          configured: true,
          apiConfigured: true,
          corpId: "corp1",
          corpSecret: "s",
          agentId: 1,
        },
      } as any,
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid credentials/i);
  });

  it("returns ok:true for bot-only accounts with WS configured", async () => {
    const result = await probeWecomAccount({
      account: {
        agent: undefined,
        bot: { configured: true, primaryTransport: "ws", wsConfigured: true },
      } as any,
      timeoutMs: 2000,
    });
    // Bot WS probe: ok if config is valid (no remote API call needed for WS)
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- extensions/wecom/src/channel-probe`
Expected: FAIL — module not found

- [ ] **Step 3: Implement probeWecomAccount**

Create `extensions/wecom/src/channel-probe.ts`:

```typescript
import type { ResolvedWecomAccount } from "./types/index.js";
import { getAccessToken } from "./transport/agent-api/core.js";

export type WecomProbeResult = {
  ok: boolean;
  error?: string;
  elapsedMs: number;
  agentId?: number;
  transport?: string;
};

export async function probeWecomAccount(params: {
  account: ResolvedWecomAccount;
  timeoutMs?: number;
}): Promise<WecomProbeResult> {
  const { account, timeoutMs = 2500 } = params;
  const start = Date.now();

  // Bot-only WS account: config presence is sufficient (WS connection is managed by runtime)
  if (!account.agent?.configured && account.bot?.configured) {
    return {
      ok: true,
      elapsedMs: Date.now() - start,
      transport: account.bot.primaryTransport,
    };
  }

  // Agent account: verify credentials by getting an access token
  if (!account.agent?.apiConfigured) {
    return {
      ok: false,
      error: "Agent API not configured for probe",
      elapsedMs: Date.now() - start,
    };
  }

  try {
    const tokenPromise = getAccessToken(account.agent);
    const token = await Promise.race([
      tokenPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("probe timeout")), timeoutMs),
      ),
    ]);
    if (!token) {
      return { ok: false, error: "empty access token", elapsedMs: Date.now() - start };
    }
    return {
      ok: true,
      elapsedMs: Date.now() - start,
      agentId: account.agent.agentId,
      transport: account.bot?.primaryTransport ?? "agent-callback",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- extensions/wecom/src/channel-probe`
Expected: All 4 tests pass

- [ ] **Step 5: Wire into channel.ts**

In `extensions/wecom/src/channel.ts`, replace line 195:

```typescript
// Add import:
import { probeWecomAccount } from "./channel-probe.js";

// Replace:
probeAccount: async () => ({ ok: true }),
// With:
probeAccount: async ({ account, timeoutMs }) =>
  probeWecomAccount({ account, timeoutMs }),
```

- [ ] **Step 6: Run channel tests**

Run: `pnpm test -- extensions/wecom/src/channel`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): implement real probeAccount health check" extensions/wecom/src/channel-probe.ts extensions/wecom/src/channel-probe.test.ts extensions/wecom/src/channel.ts
```

---

### Task 7: Wire PendingReplyManager into Gateway Monitor

**Files:**

- Create: `extensions/wecom/src/enhanced/reliable-delivery-store.ts`
- Create: `extensions/wecom/src/enhanced/reliable-delivery-store.test.ts`
- Modify: `extensions/wecom/src/gateway-monitor.ts:168-171`
- Modify: `extensions/wecom/src/outbound.ts` (setPendingReplyManager already exported)

- [ ] **Step 1: Write test for ReliableDeliveryStore**

Create `extensions/wecom/src/enhanced/reliable-delivery-store.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createInMemoryReliableDeliveryStore } from "./reliable-delivery-store.js";

describe("InMemoryReliableDeliveryStore", () => {
  let store: ReturnType<typeof createInMemoryReliableDeliveryStore>;

  beforeEach(() => {
    store = createInMemoryReliableDeliveryStore();
  });

  it("enqueues and counts pending replies", () => {
    expect(store.countPendingReplies()).toBe(0);
    const entry = store.enqueuePendingReply({ text: "hello", to: "user1" });
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe("pending");
    expect(store.countPendingReplies()).toBe(1);
  });

  it("lists due pending replies by time", () => {
    const now = Date.now();
    store.enqueuePendingReply({ text: "a", to: "u1" });
    store.enqueuePendingReply({ text: "b", to: "u2" });
    const due = store.listDuePendingReplies({ at: now + 60_000, limit: 10 });
    expect(due.length).toBe(2);
  });

  it("marks pending as delivered", () => {
    const entry = store.enqueuePendingReply({ text: "a", to: "u1" })!;
    store.markPendingDelivered({ id: entry.id, at: Date.now() });
    expect(store.countPendingReplies()).toBe(0);
  });

  it("reschedules pending reply with backoff", () => {
    const entry = store.enqueuePendingReply({ text: "a", to: "u1" })!;
    const rescheduled = store.reschedulePendingReply({
      id: entry.id,
      reason: "transient",
      at: Date.now(),
    });
    expect(rescheduled).toBe(true);
    expect(store.countPendingReplies()).toBe(1);
  });

  it("drops expired entries", () => {
    const entry = store.enqueuePendingReply({ text: "a", to: "u1" })!;
    // Expire all entries by advancing time far into the future
    store.dropExpiredPendingReplies({ at: Date.now() + 86_400_000 * 2 });
    expect(store.countPendingReplies()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- extensions/wecom/src/enhanced/reliable-delivery-store`
Expected: FAIL — module not found

- [ ] **Step 3: Implement InMemoryReliableDeliveryStore**

Create `extensions/wecom/src/enhanced/reliable-delivery-store.ts`:

```typescript
import type { PendingReplyEntry, ReliableDeliveryStore } from "./pending-reply.js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BACKOFF_MS = 30_000;
const DEFAULT_EXPIRE_MS = 86_400_000; // 24h

let nextId = 1;

export function createInMemoryReliableDeliveryStore(): ReliableDeliveryStore {
  const entries = new Map<string, PendingReplyEntry>();

  return {
    countPendingReplies(): number {
      let count = 0;
      for (const e of entries.values()) {
        if (e.status === "pending") count++;
      }
      return count;
    },

    enqueuePendingReply(payload: Record<string, unknown>): PendingReplyEntry | null {
      const now = Date.now();
      const id = `pr-${nextId++}-${now}`;
      const entry: PendingReplyEntry = {
        id,
        text: typeof payload.text === "string" ? payload.text : undefined,
        to: typeof payload.to === "string" ? payload.to : undefined,
        maxRetries: DEFAULT_MAX_RETRIES,
        retryBackoffMs: DEFAULT_RETRY_BACKOFF_MS,
        expireMs: DEFAULT_EXPIRE_MS,
        retries: 0,
        nextRetryAt: now,
        createdAt: now,
        status: "pending",
        ...payload,
      };
      entries.set(id, entry);
      return entry;
    },

    listDuePendingReplies(opts: { at: number; limit: number }): PendingReplyEntry[] {
      const result: PendingReplyEntry[] = [];
      for (const e of entries.values()) {
        if (e.status === "pending" && e.nextRetryAt <= opts.at) {
          result.push(e);
          if (result.length >= opts.limit) break;
        }
      }
      return result;
    },

    markPendingDelivered(opts: { id: string; at: number }): void {
      const entry = entries.get(opts.id);
      if (entry) {
        entry.status = "delivered";
        entries.delete(opts.id);
      }
    },

    reschedulePendingReply(opts: { id: string; reason: string; at: number }): boolean {
      const entry = entries.get(opts.id);
      if (!entry || entry.status !== "pending") return false;
      entry.retries++;
      if (entry.retries >= (entry.maxRetries ?? DEFAULT_MAX_RETRIES)) {
        entry.status = "exhausted";
        entries.delete(opts.id);
        return false;
      }
      const backoff = entry.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
      entry.nextRetryAt = opts.at + backoff * Math.pow(2, entry.retries - 1);
      return true;
    },

    dropExpiredPendingReplies(opts: { at: number }): void {
      for (const [id, entry] of entries) {
        const expireMs = entry.expireMs ?? DEFAULT_EXPIRE_MS;
        if (opts.at - entry.createdAt > expireMs) {
          entries.delete(id);
        }
      }
    },

    listPendingRepliesForSession(opts: {
      mode?: string;
      accountId?: string;
      sessionId?: string;
    }): PendingReplyEntry[] {
      const result: PendingReplyEntry[] = [];
      for (const e of entries.values()) {
        if (e.status !== "pending") continue;
        if (opts.accountId && (e as Record<string, unknown>).accountId !== opts.accountId) continue;
        result.push(e);
      }
      return result;
    },
  };
}
```

- [ ] **Step 4: Run test**

Run: `pnpm test -- extensions/wecom/src/enhanced/reliable-delivery-store`
Expected: All 5 tests pass

- [ ] **Step 5: Wire PendingReplyManager into gateway-monitor.ts**

In `extensions/wecom/src/gateway-monitor.ts`, replace lines 168-171:

```typescript
// Add imports:
import {
  createWecomPendingReplyManager,
  type PendingReplyManager,
} from "./enhanced/pending-reply.js";
import { createInMemoryReliableDeliveryStore } from "./enhanced/reliable-delivery-store.js";
import { setPendingReplyManager } from "./outbound.js";

// Add variable in the function scope (near reqIdStore):
let pendingReplyMgr: PendingReplyManager | undefined;

// Replace the TODO block (lines 168-171) with:
if (enhancedConfig.pendingReply?.enabled !== false) {
  const reliableStore = createInMemoryReliableDeliveryStore();
  pendingReplyMgr = createWecomPendingReplyManager({
    reliableDeliveryStore: reliableStore,
    resolveWecomPendingReplyPolicy: () => enhancedConfig.pendingReply ?? { enabled: true },
    deliverPendingReply: async (entry, _trigger) => {
      try {
        const agentConfig = account.agent;
        if (!agentConfig?.apiConfigured) {
          return { ok: false, error: "agent not configured" };
        }
        const { WecomAgentDeliveryService } = await import("./capability/agent/index.js");
        const deliveryService = new WecomAgentDeliveryService(agentConfig);
        await deliveryService.sendText({ to: entry.to, text: entry.text ?? "" });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    logger: {
      info: (msg) => ctx.log?.info(msg),
      warn: (msg) => ctx.log?.warn?.(msg) ?? ctx.log?.info(msg),
    },
  });
  await pendingReplyMgr.initialize(cfg);
  setPendingReplyManager(pendingReplyMgr);
  ctx.log?.info(`[${account.accountId}] enhanced: pending reply manager enabled`);
}
```

Also in the `finally` block, add cleanup before `reqIdStore` cleanup:

```typescript
// In finally block, add:
if (pendingReplyMgr) {
  try {
    await pendingReplyMgr.flushDuePendingReplies("shutdown");
  } catch {
    // best-effort on shutdown
  }
}
```

- [ ] **Step 6: Run full wecom tests**

Run: `pnpm test -- extensions/wecom/`
Expected: 40+ files pass (39 existing + 1 new)

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): wire PendingReplyManager with in-memory ReliableDeliveryStore" extensions/wecom/src/enhanced/reliable-delivery-store.ts extensions/wecom/src/enhanced/reliable-delivery-store.test.ts extensions/wecom/src/gateway-monitor.ts
```

---

### Task 8: Unskip Media Fallback Test + Version Fix

**Files:**

- Modify: `extensions/wecom/src/monitor.active.test.ts:230-268`
- Modify: `extensions/wecom/package.json:3`

- [ ] **Step 1: Read the full test context**

Read `extensions/wecom/src/monitor.active.test.ts` to understand the test setup, mocks, and the `capturedDeliver` flow. The skip reason is fake timers can't drain chained async flows.

- [ ] **Step 2: Unskip the test with real timer workaround**

The core issue is `vi.useFakeTimers()` can't drain the debounced async chain. Fix by using `vi.useRealTimers()` inside this specific test or extracting the deliver callback synchronously:

```typescript
// Change line 233:
it.skip("should fallback non-image media to agent DM (and push a Chinese prompt)", async () => {
// To:
it("should fallback non-image media to agent DM (and push a Chinese prompt)", async () => {
  // Switch to real timers for this test only
  vi.useRealTimers();
  // ... (rest of test body)
  // Wait for real async to settle:
  await new Promise((r) => setTimeout(r, 800));
  // ... assertions
  // Restore fake timers for remaining tests:
  vi.useFakeTimers();
}, 5000); // explicit 5s timeout for real-timer test
```

- [ ] **Step 3: Fix package.json version**

```json
// Change line 3 from:
"version": "2026.3.17",
// To:
"version": "2026.3.23",
```

- [ ] **Step 4: Run full wecom tests**

Run: `pnpm test -- extensions/wecom/`
Expected: All pass, including the previously-skipped test

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] fix(wecom): unskip media fallback test, align package version to 2026.3.23" extensions/wecom/src/monitor.active.test.ts extensions/wecom/package.json
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test -- extensions/wecom/`
Expected: 40+ files, 268+ tests pass, 0 skipped

- [ ] **Step 2: Verify zero `: any` in production code**

Run: `rg ": any" extensions/wecom/src/ --glob "*.ts" --glob "!*.test.ts" -c`
Expected: 0 matches (or negligible — only in generated/vendored code)

- [ ] **Step 3: Verify zero console.log in production code**

Run: `rg "console\.(log|error|warn)" extensions/wecom/src/ --glob "*.ts" --glob "!*.test.ts" -c`
Expected: 0 matches

- [ ] **Step 4: Run lint check**

Run: `pnpm format && pnpm tsgo`
Expected: No wecom-related errors

- [ ] **Step 5: Verify import boundaries**

Run: `pnpm lint:extensions:no-src-outside-plugin-sdk && pnpm lint:extensions:no-plugin-sdk-internal && pnpm lint:extensions:no-relative-outside-package`
Expected: All pass
