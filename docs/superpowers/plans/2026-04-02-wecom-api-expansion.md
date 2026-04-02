# WeCom API Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the WeCom plugin's API capabilities from messaging + documents to cover calendar, MCP bridge, contacts, meetings, and todos.

**Scope:** This plan covers **P0 (upstream sync) + P1 (self-developed)** only. P2 modules (approval, external-contact) are deferred to a future plan — specs exist in OpenSpec but are out of scope for this implementation cycle.

**Architecture:** Each new module follows the existing `capability/doc/` pattern: client.ts (API calls + 3-retry), schema.ts (oneOf discriminated union), tool.ts (action switch dispatch + registerWecom*Tools export), types.ts. P0 modules are synced from upstream YanHaidao/wecom; P1 modules are self-developed referencing wecom-cli skills.

**Tech Stack:** TypeScript (ESM), openclaw/plugin-sdk, JSON Schema (oneOf discriminated union), vitest

**OpenSpec Change:** `wecom-api-expansion` — specs at `openspec/changes/wecom-api-expansion/specs/`

---

## File Structure

### P0 — Upstream Sync (copy + adapt)

| File | Responsibility |
|------|---------------|
| `extensions/wecom/src/capability/calendar/client.ts` | Calendar API calls (upstream) |
| `extensions/wecom/src/capability/calendar/schema.ts` | Calendar JSON Schema (upstream) |
| `extensions/wecom/src/capability/calendar/tool.ts` | Calendar tool registration (upstream) |
| `extensions/wecom/src/capability/calendar/types.ts` | Calendar types (upstream) |
| `extensions/wecom/src/capability/mcp/tool.ts` | MCP bridge tool (upstream) |
| `extensions/wecom/src/capability/mcp/schema.ts` | MCP schema (upstream) |
| `extensions/wecom/src/capability/mcp/transport.ts` | MCP transport (upstream) |
| `extensions/wecom/src/runtime/source-registry.ts` | Source registry (upstream) |
| `extensions/wecom/src/context-store.ts` | Context store (upstream) |
| `extensions/wecom/index.ts` | Add calendar + mcp registration |

### P1 — Self-Developed

| File | Responsibility |
|------|---------------|
| `extensions/wecom/src/capability/contact/types.ts` | Member, Department, Tag types |
| `extensions/wecom/src/capability/contact/client.ts` | Contact API client (6 methods + retry) |
| `extensions/wecom/src/capability/contact/schema.ts` | Contact oneOf schema (6 actions) |
| `extensions/wecom/src/capability/contact/tool.ts` | Contact tool registration + dispatch |
| `extensions/wecom/src/capability/contact/contact.test.ts` | Contact tests |
| `extensions/wecom/src/capability/meeting/types.ts` | Meeting types |
| `extensions/wecom/src/capability/meeting/client.ts` | Meeting API client (5 methods + retry) |
| `extensions/wecom/src/capability/meeting/schema.ts` | Meeting oneOf schema (5 actions) |
| `extensions/wecom/src/capability/meeting/tool.ts` | Meeting tool registration + dispatch |
| `extensions/wecom/src/capability/meeting/meeting.test.ts` | Meeting tests |
| `extensions/wecom/src/capability/todo/types.ts` | Todo types |
| `extensions/wecom/src/capability/todo/client.ts` | Todo API client (3 methods + retry) |
| `extensions/wecom/src/capability/todo/schema.ts` | Todo oneOf schema (3 actions) |
| `extensions/wecom/src/capability/todo/tool.ts` | Todo tool registration + dispatch |
| `extensions/wecom/src/capability/todo/todo.test.ts` | Todo tests |
| `extensions/wecom/index.ts` | Add contact + meeting + todo registration |

---

### Task 1: P0 — Upstream Calendar Module Sync

**covers:** wecom-calendar/spec.md (all scenarios), wecom-mcp-bridge/spec.md (all scenarios)
**domain:** `[backend]`
**complexity:** `complex`
**blockedBy:** none

**Files:**
- Create: `extensions/wecom/src/capability/calendar/client.ts`
- Create: `extensions/wecom/src/capability/calendar/schema.ts`
- Create: `extensions/wecom/src/capability/calendar/tool.ts`
- Create: `extensions/wecom/src/capability/calendar/types.ts`
- Create: `extensions/wecom/src/capability/mcp/tool.ts`
- Create: `extensions/wecom/src/capability/mcp/schema.ts`
- Create: `extensions/wecom/src/capability/mcp/transport.ts`
- Create: `extensions/wecom/src/runtime/source-registry.ts`
- Create: `extensions/wecom/src/context-store.ts`
- Modify: `extensions/wecom/index.ts:6,38`

**Description:**
Clone the upstream YanHaidao/wecom repo (v2.3.27+), copy the following directories/files into our extension:
- `src/capability/calendar/` (5 files, ~1961 lines)
- `src/capability/mcp/` (4 files, ~685 lines)
- `src/runtime/source-registry.ts` (~244 lines)
- `src/context-store.ts` (~264 lines)

Then adapt:
1. Fix all import paths to match our directory structure (upstream uses different relative paths)
2. Ensure `getAccessToken`, `wecomFetch`, `resolveWecomEgressProxyUrlFromNetwork` imports resolve correctly:
   - `getAccessToken` from `../../transport/agent-api/core.js`
   - `wecomFetch` from `../../http.js`
   - `resolveWecomEgressProxyUrlFromNetwork` from `../../config/index.js`
3. Register tools in `extensions/wecom/index.ts`

- [ ] **Step 1: Clone upstream and copy calendar files**

```bash
cd /tmp && git clone --depth 1 https://github.com/YanHaidao/wecom.git wecom-upstream
```

Copy files:
```bash
cp -r /tmp/wecom-upstream/src/capability/calendar extensions/wecom/src/capability/calendar
cp -r /tmp/wecom-upstream/src/capability/mcp extensions/wecom/src/capability/mcp
cp /tmp/wecom-upstream/src/runtime/source-registry.ts extensions/wecom/src/runtime/source-registry.ts
cp /tmp/wecom-upstream/src/context-store.ts extensions/wecom/src/context-store.ts
```

- [ ] **Step 2: Fix import paths in all copied files**

For each copied file, update relative imports to match our directory structure. Key patterns:
- Upstream `../../transport/agent-api/core.js` → verify same in ours (should match)
- Upstream `../../http.js` → verify same
- Upstream `../../config/index.js` → verify same
- Any upstream-specific imports (e.g., `../../types/index.js`) → verify existence in our types

Run `pnpm tsgo 2>&1 | grep "extensions/wecom"` after each file to catch import errors.

- [ ] **Step 3: Register calendar and MCP tools in index.ts**

Add to `extensions/wecom/index.ts`:

```typescript
import { registerWecomCalendarTools } from "./src/capability/calendar/tool.js";
import { createWeComMcpToolFactory } from "./src/capability/mcp/tool.js";
```

In the `register()` method, after `registerWecomDocTools(api);`:

```typescript
    // P0 — Calendar & MCP (upstream sync)
    registerWecomCalendarTools(api);
    api.registerTool(createWeComMcpToolFactory(), { name: "wecom_mcp" });
```

Note: The exact export names (`registerWecomCalendarTools`, `createWeComMcpToolFactory`) must match what upstream exports. Check the copied tool.ts files and adjust if needed.

- [ ] **Step 4: Verify compilation**

```bash
pnpm tsgo 2>&1 | grep "extensions/wecom" | head -20
```

Expected: 0 errors in `extensions/wecom`.

Fix any remaining import path issues.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test -- extensions/wecom
```

Expected: All existing tests pass (new modules have no tests yet).

- [ ] **Step 5b: Verify source-registry and context-store wiring**

Confirm that the copied calendar/mcp modules internally import source-registry.ts and context-store.ts. If they do, the MCP bridge spec scenarios (session source tracking, push context storage) are covered by the upstream code. If not, create a follow-up task.

```bash
grep -r "source-registry\|context-store" extensions/wecom/src/capability/calendar/ extensions/wecom/src/capability/mcp/ || echo "WARNING: source-registry/context-store not imported by copied modules"
```

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): sync calendar + mcp modules from upstream v2.3.27" extensions/wecom/
```

**Acceptance criteria:**
- Calendar module compiles with 0 TS errors
- MCP bridge module compiles with 0 TS errors
- source-registry.ts and context-store.ts compile
- All existing wecom tests still pass
- `registerWecomCalendarTools` and MCP tool factory are called in `register()`

**Test requirements:**
- Existing test suite passes (no regression)
- tsc --noEmit passes for extensions/wecom

---

### Task 2: P1 — Contact Module Types & Client

**covers:** wecom-contact/spec.md > Member query, Department member list, Department tree, Tag member query, Search, Retry
**domain:** `[backend]`
**complexity:** `complex`
**blockedBy:** Task 1

**Files:**
- Create: `extensions/wecom/src/capability/contact/types.ts`
- Create: `extensions/wecom/src/capability/contact/client.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// extensions/wecom/src/capability/contact/types.ts

export interface WecomMember {
  userid: string;
  name: string;
  department: number[];
  position?: string;
  status?: number; // 1=activated, 2=disabled, 4=not-activated, 5=exit
  isleader?: number;
  english_name?: string;
  telephone?: string;
  order?: number[];
  main_department?: number;
  // Privacy-limited fields (empty for non-address-book-sync apps since 2022-06-20)
  avatar?: string;
  mobile?: string;
  email?: string;
  biz_mail?: string;
  gender?: string;
  thumb_avatar?: string;
}

export interface WecomMemberSimple {
  userid: string;
  name: string;
  department: number[];
}

export interface WecomDepartment {
  id: number;
  name: string;
  name_en?: string;
  parentid: number;
  order?: number;
  department_leader?: string[];
}

export interface WecomTagMemberResult {
  tagname: string;
  userlist: Array<{ userid: string; name: string }>;
  partylist: number[];
}
```

- [ ] **Step 2: Create client.ts with retry pattern**

```typescript
// extensions/wecom/src/capability/contact/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type {
  WecomDepartment,
  WecomMember,
  WecomMemberSimple,
  WecomTagMemberResult,
} from "./types.js";

async function parseJsonResponse(res: Response, actionLabel: string): Promise<any> {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status}`);
    }
    throw new Error(`WeCom ${actionLabel} failed: invalid JSON response`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`WeCom ${actionLabel} failed: empty response`);
  }
  if (!res.ok) {
    throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status} ${JSON.stringify(payload)}`);
  }
  if (Number(payload.errcode ?? 0) !== 0) {
    throw new Error(
      `WeCom ${actionLabel} failed: ${String(payload.errmsg || "unknown error")} (errcode ${String(payload.errcode)})`,
    );
  }
  return payload;
}

async function wecomContactGet(params: {
  path: string;
  actionLabel: string;
  agent: ResolvedAgentAccount;
  query?: Record<string, string>;
}): Promise<any> {
  const { path, actionLabel, agent, query } = params;
  const token = await getAccessToken(agent);
  const qs = new URLSearchParams({ access_token: token, ...query });
  const url = `https://qyapi.weixin.qq.com${path}?${qs.toString()}`;
  const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await wecomFetch(url, { method: "GET" }, { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS });
      return await parseJsonResponse(res, actionLabel);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastErr;
}

export class WecomContactClient {
  async getMember(agent: ResolvedAgentAccount, userid: string): Promise<WecomMember> {
    const result = await wecomContactGet({
      path: "/cgi-bin/user/get",
      actionLabel: "contact.get_member",
      agent,
      query: { userid },
    });
    return result as WecomMember;
  }

  async listMembers(
    agent: ResolvedAgentAccount,
    departmentId: number,
    simple = false,
  ): Promise<WecomMember[] | WecomMemberSimple[]> {
    const path = simple ? "/cgi-bin/user/simplelist" : "/cgi-bin/user/list";
    const result = await wecomContactGet({
      path,
      actionLabel: simple ? "contact.list_members_simple" : "contact.list_members",
      agent,
      query: { department_id: String(departmentId) },
    });
    return result.userlist ?? [];
  }

  async listDepartments(
    agent: ResolvedAgentAccount,
    parentId?: number,
  ): Promise<WecomDepartment[]> {
    const query: Record<string, string> = {};
    if (parentId !== undefined) query.id = String(parentId);
    const result = await wecomContactGet({
      path: "/cgi-bin/department/list",
      actionLabel: "contact.list_departments",
      agent,
      query,
    });
    return result.department ?? [];
  }

  async getDepartment(agent: ResolvedAgentAccount, departmentId: number): Promise<WecomDepartment> {
    const result = await wecomContactGet({
      path: "/cgi-bin/department/get",
      actionLabel: "contact.get_department",
      agent,
      query: { id: String(departmentId) },
    });
    return result.department as WecomDepartment;
  }

  async listTagMembers(agent: ResolvedAgentAccount, tagId: number): Promise<WecomTagMemberResult> {
    const result = await wecomContactGet({
      path: "/cgi-bin/tag/get",
      actionLabel: "contact.list_tag_members",
      agent,
      query: { tagid: String(tagId) },
    });
    return {
      tagname: result.tagname ?? "",
      userlist: result.userlist ?? [],
      partylist: result.partylist ?? [],
    };
  }

  async search(
    agent: ResolvedAgentAccount,
    departmentId: number,
    query: string,
  ): Promise<WecomMemberSimple[]> {
    // WeCom has no direct search API for contacts accessible via self-built app;
    // use list + local filter as the practical approach
    const members = (await this.listMembers(agent, departmentId, true)) as WecomMemberSimple[];
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.userid.toLowerCase().includes(q));
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
pnpm tsgo 2>&1 | grep "extensions/wecom/src/capability/contact" | head -10
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): add contact module types and client" extensions/wecom/src/capability/contact/
```

**Acceptance criteria:**
- WecomContactClient has 6 methods: getMember, listMembers, listDepartments, getDepartment, listTagMembers, search
- All methods use 3-retry pattern via `wecomContactGet`
- Types include privacy-limited field annotations
- 0 TS errors

**Test requirements:**
- tsc --noEmit passes

---

### Task 3: P1 — Contact Module Schema & Tool Registration

**covers:** wecom-contact/spec.md (all scenarios)
**domain:** `[backend]`
**complexity:** `simple`
**blockedBy:** Task 2

**Files:**
- Create: `extensions/wecom/src/capability/contact/schema.ts`
- Create: `extensions/wecom/src/capability/contact/tool.ts`
- Modify: `extensions/wecom/index.ts`

- [ ] **Step 1: Create schema.ts**

```typescript
// extensions/wecom/src/capability/contact/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID",
};

export const wecomContactToolSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid"],
      properties: {
        action: { const: "get_member" },
        accountId: accountIdProperty,
        userid: { type: "string", minLength: 1, description: "企业成员 userid" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "department_id"],
      properties: {
        action: { const: "list_members" },
        accountId: accountIdProperty,
        department_id: { type: "integer", minimum: 1, description: "部门 ID" },
        simple: { type: "boolean", default: false, description: "true 返回精简列表（仅 userid/name）" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { const: "list_departments" },
        accountId: accountIdProperty,
        parent_id: { type: "integer", minimum: 0, description: "可选：父部门 ID，不填返回全部" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "department_id"],
      properties: {
        action: { const: "get_department" },
        accountId: accountIdProperty,
        department_id: { type: "integer", minimum: 1, description: "部门 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "tag_id"],
      properties: {
        action: { const: "list_tag_members" },
        accountId: accountIdProperty,
        tag_id: { type: "integer", minimum: 1, description: "标签 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "department_id", "query"],
      properties: {
        action: { const: "search" },
        accountId: accountIdProperty,
        department_id: { type: "integer", minimum: 1, description: "搜索范围：部门 ID" },
        query: { type: "string", minLength: 1, description: "搜索关键词（姓名或 userid）" },
      },
    },
  ],
};
```

- [ ] **Step 2: Create tool.ts**

```typescript
// extensions/wecom/src/capability/contact/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomContactClient } from "./client.js";
import { wecomContactToolSchema } from "./schema.js";

const PRIVACY_NOTE =
  "注意：非通讯录同步应用无法获取头像、手机号、邮箱等敏感字段（自 2022-06-20 起企微隐私限制）。";

export function registerWecomContactTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const client = new WecomContactClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_contact",
    label: "WeCom Contact",
    description: "企业微信通讯录工具。查询成员信息、部门列表/详情、标签成员、模糊搜索。",
    parameters: wecomContactToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured`);
        }

        const action = params.action;
        switch (action) {
          case "get_member": {
            const member = await client.getMember(account, params.userid);
            return {
              content: [{ type: "text" as const, text: JSON.stringify(member, null, 2) + "\n\n" + PRIVACY_NOTE }],
            };
          }
          case "list_members": {
            const members = await client.listMembers(account, params.department_id, params.simple);
            return {
              content: [{ type: "text" as const, text: `部门 ${params.department_id} 成员 (${members.length}):\n${JSON.stringify(members, null, 2)}` }],
            };
          }
          case "list_departments": {
            const departments = await client.listDepartments(account, params.parent_id);
            return {
              content: [{ type: "text" as const, text: `部门列表 (${departments.length}):\n${JSON.stringify(departments, null, 2)}` }],
            };
          }
          case "get_department": {
            const dept = await client.getDepartment(account, params.department_id);
            return {
              content: [{ type: "text" as const, text: JSON.stringify(dept, null, 2) }],
            };
          }
          case "list_tag_members": {
            const result = await client.listTagMembers(account, params.tag_id);
            return {
              content: [{ type: "text" as const, text: `标签"${result.tagname}" 成员 (${result.userlist.length}):\n${JSON.stringify(result, null, 2)}` }],
            };
          }
          case "search": {
            const results = await client.search(account, params.department_id, params.query);
            return {
              content: [{ type: "text" as const, text: `搜索"${params.query}" 结果 (${results.length}):\n${JSON.stringify(results, null, 2)}` }],
            };
          }
          default:
            throw new Error(`Unknown contact action: ${action}`);
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `WeCom Contact error: ${err.message}` }],
          isError: true,
        };
      }
    },
  }));
}
```

- [ ] **Step 3: Register in index.ts**

Add import at top of `extensions/wecom/index.ts`:

```typescript
import { registerWecomContactTools } from "./src/capability/contact/tool.js";
```

Add in `register()` after the doc tools line:

```typescript
    // P1 — Contact (self-developed)
    registerWecomContactTools(api);
```

- [ ] **Step 4: Verify compilation**

```bash
pnpm tsgo 2>&1 | grep "extensions/wecom" | head -10
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): add contact tool schema and registration" extensions/wecom/src/capability/contact/schema.ts extensions/wecom/src/capability/contact/tool.ts extensions/wecom/index.ts
```

**Acceptance criteria:**
- oneOf schema covers 6 actions: get_member, list_members, list_departments, get_department, list_tag_members, search
- Tool registered as `wecom_contact` in plugin entry
- Privacy note appended to get_member results
- Unknown action throws error

**Test requirements:**
- tsc --noEmit passes

---

### Task 4: P1 — Contact Module Tests

**covers:** wecom-contact/spec.md (all scenarios)
**domain:** `[test]`
**complexity:** `simple`
**blockedBy:** Task 3

**Files:**
- Create: `extensions/wecom/src/capability/contact/contact.test.ts`

- [ ] **Step 1: Write contact tests**

```typescript
// extensions/wecom/src/capability/contact/contact.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WecomContactClient } from "./client.js";

// Mock all infrastructure imports at top level (vitest hoists vi.mock)
vi.mock("../../transport/agent-api/core.js", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../config/index.js", () => ({
  resolveWecomEgressProxyUrlFromNetwork: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../../http.js", () => ({
  wecomFetch: vi.fn(),
}));

const createMockAgent = () =>
  ({
    accountId: "test",
    configured: true,
    corpId: "corp1",
    corpSecret: "secret",
    agentId: 1000001,
    token: "t",
    encodingAESKey: "k",
    config: {},
    network: {},
    callbackConfigured: false,
    apiConfigured: true,
  }) as any;

describe("WecomContactClient", () => {
  const agent = createMockAgent();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMember", () => {
    it("returns member details for valid userid", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            errmsg: "ok",
            userid: "zhangsan",
            name: "张三",
            department: [1, 2],
            position: "工程师",
            status: 1,
          }),
      });

      const client = new WecomContactClient();
      const result = await client.getMember(agent, "zhangsan");
      expect(result.userid).toBe("zhangsan");
      expect(result.name).toBe("张三");
      expect(result.department).toEqual([1, 2]);
    });
  });

  describe("listMembers", () => {
    it("returns member list for department", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            errmsg: "ok",
            userlist: [
              { userid: "u1", name: "User 1", department: [1] },
              { userid: "u2", name: "User 2", department: [1] },
            ],
          }),
      });

      const client = new WecomContactClient();
      const result = await client.listMembers(agent, 1);
      expect(result).toHaveLength(2);
    });
  });

  describe("listDepartments", () => {
    it("returns full department tree when no parent specified", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            errmsg: "ok",
            department: [
              { id: 1, name: "Root", parentid: 0 },
              { id: 2, name: "Engineering", parentid: 1 },
            ],
          }),
      });

      const client = new WecomContactClient();
      const result = await client.listDepartments(agent);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Root");
    });
  });

  describe("search", () => {
    it("filters members by name query", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            errmsg: "ok",
            userlist: [
              { userid: "zhangsan", name: "张三", department: [1] },
              { userid: "lisi", name: "李四", department: [1] },
              { userid: "zhangwei", name: "张伟", department: [1] },
            ],
          }),
      });

      const client = new WecomContactClient();
      const result = await client.search(agent, 1, "张");
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.userid)).toEqual(["zhangsan", "zhangwei"]);
    });
  });

  describe("retry", () => {
    it("retries on network failure up to 3 times", async () => {
      const { wecomFetch } = await import("../../http.js");
      let callCount = 0;
      (wecomFetch as any).mockImplementation(() => {
        callCount++;
        if (callCount < 3) throw new Error("network timeout");
        return {
          ok: true,
          json: () => Promise.resolve({ errcode: 0, department: [] }),
        };
      });

      const client = new WecomContactClient();
      const result = await client.listDepartments(agent);
      expect(result).toEqual([]);
      expect(callCount).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test -- extensions/wecom/src/capability/contact/contact.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] test(wecom): add contact module tests" extensions/wecom/src/capability/contact/contact.test.ts
```

**Acceptance criteria:**
- Tests cover: getMember, listMembers, listDepartments, search, retry behavior
- All tests pass

**Test requirements:**
- `pnpm test -- extensions/wecom/src/capability/contact/contact.test.ts` passes

---

### Task 5: P1 — Meeting Module (types + client + schema + tool)

**covers:** wecom-meeting/spec.md (all scenarios)
**domain:** `[backend]`
**complexity:** `complex`
**blockedBy:** Task 1

**Files:**
- Create: `extensions/wecom/src/capability/meeting/types.ts`
- Create: `extensions/wecom/src/capability/meeting/client.ts`
- Create: `extensions/wecom/src/capability/meeting/schema.ts`
- Create: `extensions/wecom/src/capability/meeting/tool.ts`
- Modify: `extensions/wecom/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// extensions/wecom/src/capability/meeting/types.ts

export interface WecomMeeting {
  meetingid: string;
  title: string;
  meeting_code?: string;
  password?: string;
  status?: number; // 1=not_started, 2=in_progress, 3=ended, 4=cancelled
  start_time: string;
  end_time: string;
  hosts?: string[];
  invitees?: string[];
  settings?: WecomMeetingSettings;
}

export interface WecomMeetingSettings {
  mute_enable_join?: boolean;
  allow_unmute_self?: boolean;
  play_ivr_on_join?: boolean;
  play_ivr_on_leave?: boolean;
  allow_in_before_host?: boolean;
}

export interface WecomMeetingListItem {
  meetingid: string;
  title: string;
  meeting_code?: string;
  start_time: string;
  end_time: string;
  status?: number;
}
```

- [ ] **Step 2: Create client.ts**

```typescript
// extensions/wecom/src/capability/meeting/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type { WecomMeeting, WecomMeetingListItem } from "./types.js";

async function parseJsonResponse(res: Response, actionLabel: string): Promise<any> {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status}`);
    throw new Error(`WeCom ${actionLabel} failed: invalid JSON response`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`WeCom ${actionLabel} failed: empty response`);
  }
  if (!res.ok) {
    throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status} ${JSON.stringify(payload)}`);
  }
  if (Number(payload.errcode ?? 0) !== 0) {
    throw new Error(
      `WeCom ${actionLabel} failed: ${String(payload.errmsg || "unknown error")} (errcode ${String(payload.errcode)})`,
    );
  }
  return payload;
}

async function postWecomMeetingApi(params: {
  path: string;
  actionLabel: string;
  agent: ResolvedAgentAccount;
  body: Record<string, unknown>;
}): Promise<any> {
  const { path, actionLabel, agent, body } = params;
  const token = await getAccessToken(agent);
  const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
  const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await wecomFetch(
        url,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
        { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
      );
      return await parseJsonResponse(res, actionLabel);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

export class WecomMeetingClient {
  async create(agent: ResolvedAgentAccount, params: {
    title: string;
    start_time: string;
    end_time: string;
    invitees?: string[];
    password?: string;
    settings?: Record<string, unknown>;
  }): Promise<{ meetingid: string }> {
    const body: Record<string, unknown> = {
      title: params.title,
      meeting_start: params.start_time,
      meeting_end: params.end_time,
      type: 0, // scheduled meeting
    };
    if (params.invitees?.length) body.invitees = params.invitees.map((u) => ({ userid: u }));
    if (params.password) body.password = params.password;
    if (params.settings) body.settings = params.settings;
    const result = await postWecomMeetingApi({ path: "/cgi-bin/meeting/create", actionLabel: "meeting.create", agent, body });
    return { meetingid: result.meetingid };
  }

  async update(agent: ResolvedAgentAccount, meetingid: string, updates: {
    title?: string;
    start_time?: string;
    end_time?: string;
  }): Promise<void> {
    const body: Record<string, unknown> = { meetingid };
    if (updates.title) body.title = updates.title;
    if (updates.start_time) body.meeting_start = updates.start_time;
    if (updates.end_time) body.meeting_end = updates.end_time;
    await postWecomMeetingApi({
      path: "/cgi-bin/meeting/update",
      actionLabel: "meeting.update",
      agent,
      body,
    });
  }

  async cancel(agent: ResolvedAgentAccount, meetingid: string): Promise<void> {
    await postWecomMeetingApi({
      path: "/cgi-bin/meeting/cancel",
      actionLabel: "meeting.cancel",
      agent,
      body: { meetingid },
    });
  }

  async getInfo(agent: ResolvedAgentAccount, meetingid: string): Promise<WecomMeeting> {
    const result = await postWecomMeetingApi({
      path: "/cgi-bin/meeting/get_info",
      actionLabel: "meeting.get_info",
      agent,
      body: { meetingid },
    });
    return result.meeting_info as WecomMeeting;
  }

  async listUserMeetings(agent: ResolvedAgentAccount, userid: string): Promise<WecomMeetingListItem[]> {
    const result = await postWecomMeetingApi({
      path: "/cgi-bin/meeting/get_user_meetinglist",
      actionLabel: "meeting.list_user_meetings",
      agent,
      body: { userid },
    });
    return result.meeting_list ?? [];
  }
}
```

- [ ] **Step 3: Create schema.ts**

```typescript
// extensions/wecom/src/capability/meeting/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID",
};

export const wecomMeetingToolSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "title", "start_time", "end_time"],
      properties: {
        action: { const: "create" },
        accountId: accountIdProperty,
        title: { type: "string", minLength: 1, description: "会议标题" },
        start_time: { type: "string", description: "开始时间（ISO 8601 或 Unix 时间戳）" },
        end_time: { type: "string", description: "结束时间" },
        invitees: { type: "array", items: { type: "string" }, description: "参会人 userid 列表" },
        password: { type: "string", description: "会议密码" },
        settings: { type: "object", additionalProperties: true, description: "会议设置" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "meetingid"],
      properties: {
        action: { const: "update" },
        accountId: accountIdProperty,
        meetingid: { type: "string", minLength: 1, description: "会议 ID" },
        title: { type: "string", description: "新标题" },
        start_time: { type: "string", description: "新开始时间" },
        end_time: { type: "string", description: "新结束时间" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "meetingid"],
      properties: {
        action: { const: "cancel" },
        accountId: accountIdProperty,
        meetingid: { type: "string", minLength: 1, description: "会议 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "meetingid"],
      properties: {
        action: { const: "get_info" },
        accountId: accountIdProperty,
        meetingid: { type: "string", minLength: 1, description: "会议 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid"],
      properties: {
        action: { const: "list_user_meetings" },
        accountId: accountIdProperty,
        userid: { type: "string", minLength: 1, description: "成员 userid" },
      },
    },
  ],
};
```

- [ ] **Step 4: Create tool.ts**

```typescript
// extensions/wecom/src/capability/meeting/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomMeetingClient } from "./client.js";
import { wecomMeetingToolSchema } from "./schema.js";

export function registerWecomMeetingTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const client = new WecomMeetingClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_meeting",
    label: "WeCom Meeting",
    description: "企业微信会议工具。创建/修改/取消预约会议、查询会议详情、查看用户会议列表。",
    parameters: wecomMeetingToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured`);
        }

        switch (params.action) {
          case "create": {
            const result = await client.create(account, {
              title: params.title,
              start_time: params.start_time,
              end_time: params.end_time,
              invitees: params.invitees,
              password: params.password,
              settings: params.settings,
            });
            return { content: [{ type: "text" as const, text: `会议已创建，meetingid: ${result.meetingid}` }] };
          }
          case "update": {
            await client.update(account, params.meetingid, {
              title: params.title,
              start_time: params.start_time,
              end_time: params.end_time,
            });
            return { content: [{ type: "text" as const, text: `会议 ${params.meetingid} 已更新` }] };
          }
          case "cancel": {
            await client.cancel(account, params.meetingid);
            return { content: [{ type: "text" as const, text: `会议 ${params.meetingid} 已取消` }] };
          }
          case "get_info": {
            const info = await client.getInfo(account, params.meetingid);
            return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
          }
          case "list_user_meetings": {
            const meetings = await client.listUserMeetings(account, params.userid);
            return { content: [{ type: "text" as const, text: `${params.userid} 的会议 (${meetings.length}):\n${JSON.stringify(meetings, null, 2)}` }] };
          }
          default:
            throw new Error(`Unknown meeting action: ${params.action}`);
        }
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `WeCom Meeting error: ${err.message}` }], isError: true };
      }
    },
  }));
}
```

- [ ] **Step 5: Register in index.ts**

Add import:
```typescript
import { registerWecomMeetingTools } from "./src/capability/meeting/tool.js";
```

Add in `register()`:
```typescript
    registerWecomMeetingTools(api);
```

- [ ] **Step 6: Verify WeCom Meeting API paths**

Before compilation, verify the API paths against WeCom official docs (https://developer.work.weixin.qq.com/document/path/98832). Key paths to confirm:
- `/cgi-bin/meeting/create` — meeting creation
- `/cgi-bin/meeting/update` — meeting update
- `/cgi-bin/meeting/cancel` — meeting cancellation
- `/cgi-bin/meeting/get_info` — meeting detail query
- `/cgi-bin/meeting/get_user_meetinglist` — user meeting list

If any path differs from official docs, fix the client.ts before proceeding.

- [ ] **Step 7: Verify compilation**

```bash
pnpm tsgo 2>&1 | grep "extensions/wecom" | head -10
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): add meeting module — create/update/cancel/query" extensions/wecom/src/capability/meeting/ extensions/wecom/index.ts
```

**Acceptance criteria:**
- WecomMeetingClient has 5 methods: create, update, cancel, getInfo, listUserMeetings
- oneOf schema covers 5 actions
- Tool registered as `wecom_meeting`
- API paths verified against official WeCom docs
- 0 TS errors

**Test requirements:**
- tsc --noEmit passes

---

### Task 6: P1 — Meeting Module Tests

**covers:** wecom-meeting/spec.md (all scenarios)
**domain:** `[test]`
**complexity:** `simple`
**blockedBy:** Task 5

**Files:**
- Create: `extensions/wecom/src/capability/meeting/meeting.test.ts`

- [ ] **Step 1: Write meeting tests**

```typescript
// extensions/wecom/src/capability/meeting/meeting.test.ts

import { describe, expect, it, vi } from "vitest";
import { WecomMeetingClient } from "./client.js";

vi.mock("../../transport/agent-api/core.js", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../config/index.js", () => ({
  resolveWecomEgressProxyUrlFromNetwork: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../../http.js", () => ({
  wecomFetch: vi.fn(),
}));

const createMockAgent = () =>
  ({
    accountId: "test",
    configured: true,
    corpId: "corp1",
    corpSecret: "secret",
    agentId: 1000001,
    token: "t",
    encodingAESKey: "k",
    config: {},
    network: {},
    callbackConfigured: false,
    apiConfigured: true,
  }) as any;

describe("WecomMeetingClient", () => {
  const agent = createMockAgent();

  describe("create", () => {
    it("creates a meeting and returns meetingid", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ errcode: 0, meetingid: "mtg-123" }),
      });

      const client = new WecomMeetingClient();
      const result = await client.create(agent, {
        title: "Standup",
        start_time: "2026-04-03T09:00:00Z",
        end_time: "2026-04-03T09:30:00Z",
        invitees: ["user1", "user2"],
      });
      expect(result.meetingid).toBe("mtg-123");
    });
  });

  describe("cancel", () => {
    it("cancels a meeting without error", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ errcode: 0, errmsg: "ok" }),
      });

      const client = new WecomMeetingClient();
      await expect(client.cancel(agent, "mtg-123")).resolves.toBeUndefined();
    });
  });

  describe("getInfo", () => {
    it("returns meeting details", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            meeting_info: { meetingid: "mtg-123", title: "Standup", start_time: "2026-04-03T09:00:00Z", end_time: "2026-04-03T09:30:00Z" },
          }),
      });

      const client = new WecomMeetingClient();
      const info = await client.getInfo(agent, "mtg-123");
      expect(info.title).toBe("Standup");
    });
  });

  describe("listUserMeetings", () => {
    it("returns meeting list for user", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            meeting_list: [
              { meetingid: "mtg-1", title: "M1", start_time: "T1", end_time: "T2" },
              { meetingid: "mtg-2", title: "M2", start_time: "T3", end_time: "T4" },
            ],
          }),
      });

      const client = new WecomMeetingClient();
      const list = await client.listUserMeetings(agent, "user1");
      expect(list).toHaveLength(2);
    });
  });

  describe("retry", () => {
    it("retries on failure and succeeds on 3rd attempt", async () => {
      const { wecomFetch } = await import("../../http.js");
      let callCount = 0;
      (wecomFetch as any).mockImplementation(() => {
        callCount++;
        if (callCount < 3) throw new Error("timeout");
        return { ok: true, json: () => Promise.resolve({ errcode: 0, meetingid: "ok" }) };
      });

      const client = new WecomMeetingClient();
      const result = await client.create(agent, { title: "T", start_time: "S", end_time: "E" });
      expect(result.meetingid).toBe("ok");
      expect(callCount).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test -- extensions/wecom/src/capability/meeting/meeting.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] test(wecom): add meeting module tests" extensions/wecom/src/capability/meeting/meeting.test.ts
```

**Acceptance criteria:**
- Tests cover: create, cancel, getInfo, listUserMeetings, retry
- All tests pass

**Test requirements:**
- `pnpm test -- extensions/wecom/src/capability/meeting/meeting.test.ts` passes

---

### Task 7: P1 — Todo Module (types + client + schema + tool)

**covers:** wecom-todo/spec.md (all scenarios)
**domain:** `[backend]`
**complexity:** `complex`
**blockedBy:** Task 1

**Files:**
- Create: `extensions/wecom/src/capability/todo/types.ts`
- Create: `extensions/wecom/src/capability/todo/client.ts`
- Create: `extensions/wecom/src/capability/todo/schema.ts`
- Create: `extensions/wecom/src/capability/todo/tool.ts`
- Modify: `extensions/wecom/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// extensions/wecom/src/capability/todo/types.ts

export interface WecomWorkRecord {
  sp_no?: string;
  title: string;
  creator: string;
  url?: string;
  appname?: string;
  create_time?: number;
  status?: number; // 0=not_started, 1=completed
  detail?: Array<{
    userid: string;
    title?: string;
    status?: number;
  }>;
}
```

- [ ] **Step 2: Create client.ts**

```typescript
// extensions/wecom/src/capability/todo/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type { WecomWorkRecord } from "./types.js";

async function parseJsonResponse(res: Response, actionLabel: string): Promise<any> {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status}`);
    throw new Error(`WeCom ${actionLabel} failed: invalid JSON response`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`WeCom ${actionLabel} failed: empty response`);
  }
  if (!res.ok) {
    throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status} ${JSON.stringify(payload)}`);
  }
  if (Number(payload.errcode ?? 0) !== 0) {
    throw new Error(
      `WeCom ${actionLabel} failed: ${String(payload.errmsg || "unknown error")} (errcode ${String(payload.errcode)})`,
    );
  }
  return payload;
}

async function postWecomTodoApi(params: {
  path: string;
  actionLabel: string;
  agent: ResolvedAgentAccount;
  body: Record<string, unknown>;
}): Promise<any> {
  const { path, actionLabel, agent, body } = params;
  const token = await getAccessToken(agent);
  const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
  const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await wecomFetch(
        url,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
        { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
      );
      return await parseJsonResponse(res, actionLabel);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

export class WecomTodoClient {
  async create(agent: ResolvedAgentAccount, params: {
    title: string;
    creator: string;
    url?: string;
    appname?: string;
    userids?: string[];
  }): Promise<string> {
    const body: Record<string, unknown> = {
      title: params.title,
      creator: params.creator,
    };
    if (params.url) body.url = params.url;
    if (params.appname) body.appname = params.appname;
    if (params.userids?.length) {
      body.detail = params.userids.map((userid) => ({ userid, title: params.title }));
    }
    const result = await postWecomTodoApi({
      path: "/cgi-bin/oa/addworkrecord",
      actionLabel: "todo.create",
      agent,
      body,
    });
    return result.sp_no ?? "";
  }

  async updateStatus(agent: ResolvedAgentAccount, spNo: string, status: number): Promise<void> {
    await postWecomTodoApi({
      path: "/cgi-bin/oa/updateworkrecord",
      actionLabel: "todo.update_status",
      agent,
      body: { sp_no: spNo, status },
    });
  }

  async get(agent: ResolvedAgentAccount, spNo: string): Promise<WecomWorkRecord> {
    const result = await postWecomTodoApi({
      path: "/cgi-bin/oa/getworkrecord",
      actionLabel: "todo.get",
      agent,
      body: { sp_no: spNo },
    });
    return result as WecomWorkRecord;
  }
}
```

- [ ] **Step 3: Create schema.ts**

```typescript
// extensions/wecom/src/capability/todo/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID",
};

export const wecomTodoToolSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "title", "creator"],
      properties: {
        action: { const: "create" },
        accountId: accountIdProperty,
        title: { type: "string", minLength: 1, description: "待办标题" },
        creator: { type: "string", minLength: 1, description: "创建人 userid" },
        url: { type: "string", description: "待办详情链接" },
        appname: { type: "string", description: "应用名称" },
        userids: { type: "array", items: { type: "string" }, description: "指派人 userid 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "sp_no", "status"],
      properties: {
        action: { const: "update_status" },
        accountId: accountIdProperty,
        sp_no: { type: "string", minLength: 1, description: "待办单号" },
        status: { type: "integer", enum: [0, 1], description: "0=未完成，1=已完成" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "sp_no"],
      properties: {
        action: { const: "get" },
        accountId: accountIdProperty,
        sp_no: { type: "string", minLength: 1, description: "待办单号" },
      },
    },
  ],
};
```

- [ ] **Step 4: Create tool.ts**

```typescript
// extensions/wecom/src/capability/todo/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomTodoClient } from "./client.js";
import { wecomTodoToolSchema } from "./schema.js";

export function registerWecomTodoTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const client = new WecomTodoClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_todo",
    label: "WeCom Todo",
    description: "企业微信待办工具。创建待办任务、更新状态（完成/未完成）、查询待办详情。",
    parameters: wecomTodoToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured`);
        }

        switch (params.action) {
          case "create": {
            const spNo = await client.create(account, {
              title: params.title,
              creator: params.creator,
              url: params.url,
              appname: params.appname,
              userids: params.userids,
            });
            return { content: [{ type: "text" as const, text: `待办已创建，单号: ${spNo}` }] };
          }
          case "update_status": {
            await client.updateStatus(account, params.sp_no, params.status);
            const label = params.status === 1 ? "已完成" : "未完成";
            return { content: [{ type: "text" as const, text: `待办 ${params.sp_no} 状态已更新为: ${label}` }] };
          }
          case "get": {
            const record = await client.get(account, params.sp_no);
            return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
          }
          default:
            throw new Error(`Unknown todo action: ${params.action}`);
        }
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `WeCom Todo error: ${err.message}` }], isError: true };
      }
    },
  }));
}
```

- [ ] **Step 5: Register in index.ts**

Add import:
```typescript
import { registerWecomTodoTools } from "./src/capability/todo/tool.js";
```

Add in `register()`:
```typescript
    registerWecomTodoTools(api);
```

- [ ] **Step 6: Verify compilation**

```bash
pnpm tsgo 2>&1 | grep "extensions/wecom" | head -10
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(wecom): add todo module — create/update_status/get" extensions/wecom/src/capability/todo/ extensions/wecom/index.ts
```

**Acceptance criteria:**
- WecomTodoClient has 3 methods: create, updateStatus, get
- API paths use `/cgi-bin/oa/*` (not `/cgi-bin/wedrive/todo/*`)
- oneOf schema covers 3 actions
- Tool registered as `wecom_todo`
- 0 TS errors

**Test requirements:**
- tsc --noEmit passes

---

### Task 8: P1 — Todo Module Tests

**covers:** wecom-todo/spec.md (all scenarios)
**domain:** `[test]`
**complexity:** `simple`
**blockedBy:** Task 7

**Files:**
- Create: `extensions/wecom/src/capability/todo/todo.test.ts`

- [ ] **Step 1: Write todo tests**

```typescript
// extensions/wecom/src/capability/todo/todo.test.ts

import { describe, expect, it, vi } from "vitest";
import { WecomTodoClient } from "./client.js";

vi.mock("../../transport/agent-api/core.js", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../config/index.js", () => ({
  resolveWecomEgressProxyUrlFromNetwork: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../../http.js", () => ({
  wecomFetch: vi.fn(),
}));

const createMockAgent = () =>
  ({
    accountId: "test",
    configured: true,
    corpId: "corp1",
    corpSecret: "secret",
    agentId: 1000001,
    token: "t",
    encodingAESKey: "k",
    config: {},
    network: {},
    callbackConfigured: false,
    apiConfigured: true,
  }) as any;

describe("WecomTodoClient", () => {
  const agent = createMockAgent();

  describe("create", () => {
    it("creates a work record and returns sp_no", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ errcode: 0, sp_no: "202604020001" }),
      });

      const client = new WecomTodoClient();
      const spNo = await client.create(agent, {
        title: "Review PR",
        creator: "zhangsan",
        userids: ["lisi"],
      });
      expect(spNo).toBe("202604020001");
    });
  });

  describe("updateStatus", () => {
    it("marks todo as completed", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ errcode: 0, errmsg: "ok" }),
      });

      const client = new WecomTodoClient();
      await expect(client.updateStatus(agent, "202604020001", 1)).resolves.toBeUndefined();
    });
  });

  describe("get", () => {
    it("returns work record detail", async () => {
      const { wecomFetch } = await import("../../http.js");
      (wecomFetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            errcode: 0,
            sp_no: "202604020001",
            title: "Review PR",
            creator: "zhangsan",
            status: 0,
          }),
      });

      const client = new WecomTodoClient();
      const record = await client.get(agent, "202604020001");
      expect(record.title).toBe("Review PR");
      expect(record.status).toBe(0);
    });
  });

  describe("retry", () => {
    it("retries on failure", async () => {
      const { wecomFetch } = await import("../../http.js");
      let callCount = 0;
      (wecomFetch as any).mockImplementation(() => {
        callCount++;
        if (callCount < 3) throw new Error("timeout");
        return { ok: true, json: () => Promise.resolve({ errcode: 0, sp_no: "ok" }) };
      });

      const client = new WecomTodoClient();
      const spNo = await client.create(agent, { title: "T", creator: "u" });
      expect(spNo).toBe("ok");
      expect(callCount).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test -- extensions/wecom/src/capability/todo/todo.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] test(wecom): add todo module tests" extensions/wecom/src/capability/todo/todo.test.ts
```

**Acceptance criteria:**
- Tests cover: create, updateStatus, get, retry
- All tests pass

**Test requirements:**
- `pnpm test -- extensions/wecom/src/capability/todo/todo.test.ts` passes

---

### Task 9: P1 — Integration Verification

**covers:** All P0 + P1 specs
**domain:** `[test]`
**complexity:** `simple`
**blockedBy:** Tasks 4, 6, 8

**Files:**
- None (verification only)

- [ ] **Step 1: Full type check**

```bash
pnpm tsgo 2>&1 | grep "error TS" | wc -l
```

Expected: 0 errors.

- [ ] **Step 2: Full build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: Build succeeds. Check for `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings.

- [ ] **Step 3: Full test suite**

```bash
pnpm test 2>&1 | tail -30
```

Expected: All tests pass, including new contact/meeting/todo tests.

- [ ] **Step 4: Verify tool registration order**

Read `extensions/wecom/index.ts` and confirm the `register()` method has:
1. `registerWecomDocTools(api)` — existing
2. `registerWecomCalendarTools(api)` — P0
3. MCP tool registration — P0
4. `registerWecomContactTools(api)` — P1
5. `registerWecomMeetingTools(api)` — P1
6. `registerWecomTodoTools(api)` — P1

- [ ] **Step 5: Verify module independence**

Confirm no cross-imports between new capability modules:
```bash
grep -r "capability/contact" extensions/wecom/src/capability/meeting/ extensions/wecom/src/capability/todo/ || echo "OK: no cross-imports"
grep -r "capability/meeting" extensions/wecom/src/capability/contact/ extensions/wecom/src/capability/todo/ || echo "OK: no cross-imports"
grep -r "capability/todo" extensions/wecom/src/capability/contact/ extensions/wecom/src/capability/meeting/ || echo "OK: no cross-imports"
```

Expected: "OK: no cross-imports" for all three.

**Acceptance criteria:**
- 0 TS errors
- Build passes with no INEFFECTIVE_DYNAMIC_IMPORT warnings
- All tests pass
- Modules are independent (no cross-imports)
- Registration order is consistent

**Test requirements:**
- `pnpm build` passes
- `pnpm test` passes (full suite)
