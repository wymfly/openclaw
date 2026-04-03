# WeCom P2: Approval + External Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining P2 modules for WeCom API expansion — approval (审批) and external-contact (客户联系).

**Scope:** P2 modules only. P0+P1 (calendar, MCP, contact, meeting, todo) were completed in the previous plan cycle.

**Architecture:** Same `capability/` four-file pattern established in P1: types.ts (type definitions), client.ts (API calls + 3-retry), schema.ts (oneOf discriminated union), tool.ts (action switch dispatch + registration export). Approval uses POST-based API calls (like todo). External-contact uses mixed GET (get/list) + POST (list_groups/get_group_detail) pattern.

**Tech Stack:** TypeScript (ESM), openclaw/plugin-sdk, JSON Schema (oneOf discriminated union), vitest

**OpenSpec Change:** `wecom-api-expansion` — specs at `openspec/changes/wecom-api-expansion/specs/`

---

## File Structure

### P2 — Self-Developed

| File | Responsibility |
|------|---------------|
| `extensions/wecom/src/capability/approval/types.ts` | Approval types |
| `extensions/wecom/src/capability/approval/client.ts` | Approval API client (4 methods + retry) |
| `extensions/wecom/src/capability/approval/schema.ts` | Approval oneOf schema (4 actions) |
| `extensions/wecom/src/capability/approval/tool.ts` | Approval tool registration + dispatch |
| `extensions/wecom/src/capability/approval/approval.test.ts` | Approval tests |
| `extensions/wecom/src/capability/external-contact/types.ts` | External Contact types |
| `extensions/wecom/src/capability/external-contact/client.ts` | External Contact API client (3 methods + retry) |
| `extensions/wecom/src/capability/external-contact/schema.ts` | External Contact oneOf schema (3 actions) |
| `extensions/wecom/src/capability/external-contact/tool.ts` | External Contact tool registration + dispatch |
| `extensions/wecom/src/capability/external-contact/external-contact.test.ts` | External Contact tests |
| `extensions/wecom/index.ts` | Add approval + external-contact registration |

---

### Task 1: P2 — Approval Module (types + client + schema + tool + registration)

**covers:** wecom-approval/spec.md > Submit an approval, Submit with summary, List approval records by time range, Get approval detail by sp_no, Get template detail, Retry on transient failure
**domain:** `[backend]`
**complexity:** `complex`
**blockedBy:** none

**Files:**
- Create: `extensions/wecom/src/capability/approval/types.ts`
- Create: `extensions/wecom/src/capability/approval/client.ts`
- Create: `extensions/wecom/src/capability/approval/schema.ts`
- Create: `extensions/wecom/src/capability/approval/tool.ts`
- Modify: `extensions/wecom/index.ts`

**Description:**
Create the approval module following the established P1 four-file pattern. The approval module supports 4 actions: submit, list, get_detail, get_template. All API calls are POST-based via `/cgi-bin/oa/*` endpoints, identical to the todo module pattern.

- [ ] **Step 1: Create types.ts**

```typescript
// extensions/wecom/src/capability/approval/types.ts

export interface WecomApprovalRecord {
  sp_no: string;
  sp_name?: string;
  sp_status?: number; // 1=审批中, 2=已通过, 3=已驳回, 4=已撤销, 6=通过后撤销, 7=已删除, 10=已支付
  template_id?: string;
  apply_time?: number;
  apply_user_party?: string;
  apply_userid?: string;
  apply_username?: string;
  apply_userimage?: string;
  approval_nodes?: WecomApprovalNode[];
  notifier_nodes?: Array<{ attrs: { userid: string } }>;
  apply_data?: WecomApplyData;
  comments?: WecomApprovalComment[];
}

export interface WecomApprovalNode {
  node_status: number; // 1=审批中, 2=已同意, 3=已驳回, 4=已转审
  node_attr: number; // 1=或签, 2=会签, 3=依次审批
  node_type: number; // 1=审批人, 2=抄送人, 3=自选
  items: Array<{
    item_status: number;
    item_userid: string;
    item_speech?: string;
    item_optime?: number;
  }>;
}

export interface WecomApplyData {
  contents: Array<{
    control: string; // Text, Textarea, Number, Money, Date, Selector, Contact, etc.
    id: string;
    title: Array<{ text: string; lang: string }>;
    value: Record<string, unknown>;
  }>;
}

export interface WecomApprovalComment {
  commentUserInfo: { userid: string };
  commenttime?: number;
  commentcontent?: string;
  commentid?: string;
}

export interface WecomApprovalTemplate {
  template_names: Array<{ text: string; lang: string }>;
  template_content: {
    controls: Array<{
      property: {
        control: string;
        id: string;
        title: Array<{ text: string; lang: string }>;
        placeholder?: Array<{ text: string; lang: string }>;
        require?: number;
      };
      config?: Record<string, unknown>;
    }>;
  };
}
```

- [ ] **Step 2: Create client.ts with retry pattern**

```typescript
// extensions/wecom/src/capability/approval/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type { WecomApprovalRecord, WecomApprovalTemplate } from "./types.js";

function readString(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

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

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
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

export class WecomApprovalClient {
  private async postWecomApprovalApi(params: {
    path: string;
    actionLabel: string;
    agent: ResolvedAgentAccount;
    body: Record<string, unknown>;
  }): Promise<any> {
    const { path, actionLabel, agent, body } = params;

    const token = await getAccessToken(agent);
    const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
    const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(body ?? {}),
          },
          { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
        );

        return await parseJsonResponse(res, actionLabel);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastErr;
  }

  async submit(
    agent: ResolvedAgentAccount,
    params: {
      creator_userid: string;
      template_id: string;
      use_template_approver?: number;
      approver?: Array<{ attr: number; userid: string[] }>;
      apply_data?: { contents: Array<Record<string, unknown>> };
      summary_list?: Array<{ summary_info: Array<{ text: string; lang: string }> }>;
    },
  ): Promise<{ raw: any; sp_no: string }> {
    const creatorUserid = readString(params.creator_userid);
    const templateId = readString(params.template_id);
    if (!creatorUserid) throw new Error("creator_userid required");
    if (!templateId) throw new Error("template_id required");

    const payload: Record<string, unknown> = {
      creator_userid: creatorUserid,
      template_id: templateId,
    };
    if (params.use_template_approver !== undefined) {
      payload.use_template_approver = params.use_template_approver;
    }
    if (params.approver) payload.approver = params.approver;
    if (params.apply_data) payload.apply_data = params.apply_data;
    if (params.summary_list) payload.summary_list = params.summary_list;

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/applyevent",
      actionLabel: "submit",
      agent,
      body: payload,
    });

    return { raw: json, sp_no: readString(json.sp_no) };
  }

  async list(
    agent: ResolvedAgentAccount,
    params: {
      start_time: string;
      end_time: string;
      template_id?: string;
      cursor?: number;
      size?: number;
    },
  ): Promise<{ raw: any; sp_no_list: string[] }> {
    const startTime = readString(params.start_time);
    const endTime = readString(params.end_time);
    if (!startTime) throw new Error("start_time required");
    if (!endTime) throw new Error("end_time required");

    // Map user-facing start_time/end_time to WeCom API's starttime/endtime
    const payload: Record<string, unknown> = {
      starttime: startTime,
      endtime: endTime,
    };
    const templateId = readString(params.template_id);
    if (templateId) payload.template_id = templateId;
    if (params.cursor !== undefined) payload.cursor = params.cursor;
    if (params.size !== undefined) payload.size = params.size;

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/getapprovalinfo",
      actionLabel: "list",
      agent,
      body: payload,
    });

    const spNoList = Array.isArray(json.sp_no_list) ? (json.sp_no_list as string[]) : [];
    return { raw: json, sp_no_list: spNoList };
  }

  async getDetail(
    agent: ResolvedAgentAccount,
    spNo: string,
  ): Promise<WecomApprovalRecord> {
    const normalizedSpNo = readString(spNo);
    if (!normalizedSpNo) throw new Error("sp_no required");

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/getapprovaldetail",
      actionLabel: "get_detail",
      agent,
      body: { sp_no: normalizedSpNo },
    });

    return (json.info ?? json) as WecomApprovalRecord;
  }

  async getTemplate(
    agent: ResolvedAgentAccount,
    templateId: string,
  ): Promise<WecomApprovalTemplate> {
    const normalizedTemplateId = readString(templateId);
    if (!normalizedTemplateId) throw new Error("template_id required");

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/gettemplatedetail",
      actionLabel: "get_template",
      agent,
      body: { template_id: normalizedTemplateId },
    });

    return (json.template_names ? json : json.template) as WecomApprovalTemplate;
  }
}
```

- [ ] **Step 3: Create schema.ts**

```typescript
// extensions/wecom/src/capability/approval/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

export const wecomApprovalToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "creator_userid", "template_id"],
      properties: {
        action: { const: "submit" },
        accountId: accountIdProperty,
        creator_userid: {
          type: "string",
          minLength: 1,
          description: "申请人 userid",
        },
        template_id: {
          type: "string",
          minLength: 1,
          description: "审批模板 ID",
        },
        use_template_approver: {
          type: "integer",
          enum: [0, 1],
          description: "是否使用模板配置的审批人：0=自定义，1=使用模板",
        },
        approver: {
          type: "array",
          items: {
            type: "object",
            required: ["attr", "userid"],
            properties: {
              attr: {
                type: "integer",
                enum: [1, 2],
                description: "节点审批方式：1=或签，2=会签",
              },
              userid: {
                type: "array",
                items: { type: "string", minLength: 1 },
                description: "审批人 userid 列表",
              },
            },
          },
          description: "审批流程节点列表",
        },
        apply_data: {
          type: "object",
          description: "审批申请数据，格式参见企微 OA API 文档",
        },
        summary_list: {
          type: "array",
          items: {
            type: "object",
            required: ["summary_info"],
            properties: {
              summary_info: {
                type: "array",
                items: {
                  type: "object",
                  required: ["text", "lang"],
                  properties: {
                    text: { type: "string" },
                    lang: { type: "string" },
                  },
                },
              },
            },
          },
          description: "审批摘要信息，显示在审批通知中",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "start_time", "end_time"],
      properties: {
        action: { const: "list" },
        accountId: accountIdProperty,
        start_time: {
          type: "string",
          minLength: 1,
          description: "查询起始时间（Unix 时间戳，秒）",
        },
        end_time: {
          type: "string",
          minLength: 1,
          description: "查询结束时间（Unix 时间戳，秒）",
        },
        template_id: {
          type: "string",
          minLength: 1,
          description: "可选：按模板 ID 过滤",
        },
        cursor: {
          type: "integer",
          description: "分页游标（首次不传，后续传上次返回值）",
        },
        size: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "每页数量，默认 100",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "sp_no"],
      properties: {
        action: { const: "get_detail" },
        accountId: accountIdProperty,
        sp_no: {
          type: "string",
          minLength: 1,
          description: "审批单号",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "template_id"],
      properties: {
        action: { const: "get_template" },
        accountId: accountIdProperty,
        template_id: {
          type: "string",
          minLength: 1,
          description: "审批模板 ID",
        },
      },
    },
  ],
} as const;
```

- [ ] **Step 4: Create tool.ts**

```typescript
// extensions/wecom/src/capability/approval/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomApprovalClient } from "./client.js";
import { wecomApprovalToolSchema } from "./schema.js";

function buildToolResult(payload: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function registerWecomApprovalTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const approvalClient = new WecomApprovalClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_approval",
    label: "WeCom Approval",
    description:
      "企业微信审批工具，支持提交审批、查询审批列表、获取审批详情和审批模板。",
    parameters: wecomApprovalToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(
            `WeCom account ${accountId} not configured for Approval API requirements`,
          );
        }

        const action = params.action;
        switch (action) {
          case "submit": {
            const result = await approvalClient.submit(account, {
              creator_userid: params.creator_userid,
              template_id: params.template_id,
              use_template_approver: params.use_template_approver,
              approver: params.approver,
              apply_data: params.apply_data,
              summary_list: params.summary_list,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批已提交：${result.sp_no}`,
              sp_no: result.sp_no,
            });
          }
          case "list": {
            const result = await approvalClient.list(account, {
              start_time: params.start_time,
              end_time: params.end_time,
              template_id: params.template_id,
              cursor: params.cursor,
              size: params.size,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `找到 ${result.sp_no_list.length} 条审批记录`,
              sp_no_list: result.sp_no_list,
            });
          }
          case "get_detail": {
            const record = await approvalClient.getDetail(account, params.sp_no);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批详情已获取：${record.sp_name || params.sp_no}`,
              record,
            });
          }
          case "get_template": {
            const template = await approvalClient.getTemplate(
              account,
              params.template_id,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批模板已获取`,
              template,
            });
          }
          default:
            throw new Error(`Unsupported action: ${String(action)}`);
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ok: false,
                  action: params?.action,
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
    },
  }));
}
```

- [ ] **Step 5: Register in index.ts**

Add import and registration call in `extensions/wecom/index.ts`:

```typescript
// Add import (after existing P1 imports):
import { registerWecomApprovalTools } from "./src/capability/approval/tool.js";

// Add registration in register() (after registerWecomTodoTools):
// P2 — Approval (self-developed)
registerWecomApprovalTools(api);
```

**Acceptance criteria:**
- All 4 files compile without new TS errors
- `WecomApprovalClient` has methods: submit, list, getDetail, getTemplate
- Schema has 4 oneOf branches for each action
- Tool dispatch covers all 4 actions
- Registration call in index.ts
- 3-retry pattern in client's `postWecomApprovalApi`

**Test requirements:**
- tsc --noEmit passes (no new errors from this module)
- Existing test suite passes (no regression)

---

### Task 2: P2 — Approval Module Tests

**covers:** wecom-approval/spec.md > All scenarios (submit, submit with summary, list, get_detail, get_template, retry)
**domain:** `[test]`
**complexity:** `simple`
**blockedBy:** Task 1

**Files:**
- Create: `extensions/wecom/src/capability/approval/approval.test.ts`

**Description:**
Write tests for the approval module following the established P1 test pattern (todo.test.ts reference).

- [ ] **Step 1: Create approval.test.ts**

```typescript
// extensions/wecom/src/capability/approval/approval.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedAgentAccount } from "../../types/index.js";

const { getAccessTokenMock, resolveProxyMock, wecomFetchMock } = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn().mockResolvedValue("mock-access-token"),
  resolveProxyMock: vi.fn(() => "http://proxy.local:8080"),
  wecomFetchMock: vi.fn(),
}));

vi.mock("../../transport/agent-api/core.js", () => ({
  getAccessToken: getAccessTokenMock,
}));

vi.mock("../../config/index.js", () => ({
  resolveWecomEgressProxyUrlFromNetwork: resolveProxyMock,
}));

vi.mock("../../http.js", () => ({
  wecomFetch: wecomFetchMock,
}));

import { WecomApprovalClient } from "./client.js";

function createAgent(): ResolvedAgentAccount {
  return {
    accountId: "acct-1",
    configured: true,
    corpId: "corp-id",
    corpSecret: "corp-secret",
    agentId: 100001,
    token: "agent-token",
    encodingAESKey: "encoding-aes-key",
    config: {
      corpId: "corp-id",
      agentSecret: "corp-secret",
      agentId: 100001,
      token: "agent-token",
      encodingAESKey: "encoding-aes-key",
    },
    network: { egressProxyUrl: "http://proxy.local:8080" },
    callbackConfigured: true,
    apiConfigured: true,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("WecomApprovalClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submit creates approval and returns sp_no", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errcode: 0, errmsg: "ok", sp_no: "202604030001" }),
    );

    const client = new WecomApprovalClient();
    const result = await client.submit(createAgent(), {
      creator_userid: "zhangsan",
      template_id: "tpl-001",
      use_template_approver: 1,
    });

    expect(result.sp_no).toBe("202604030001");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/cgi-bin/oa/applyevent?"),
      expect.objectContaining({ method: "POST" }),
      { proxyUrl: "http://proxy.local:8080", timeoutMs: expect.any(Number) },
    );
  });

  it("submit with summary passes summary_list", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errcode: 0, errmsg: "ok", sp_no: "202604030002" }),
    );

    const client = new WecomApprovalClient();
    const result = await client.submit(createAgent(), {
      creator_userid: "zhangsan",
      template_id: "tpl-001",
      summary_list: [
        { summary_info: [{ text: "请假3天", lang: "zh_CN" }] },
      ],
    });

    expect(result.sp_no).toBe("202604030002");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.summary_list).toBeDefined();
    expect(body.summary_list[0].summary_info[0].text).toBe("请假3天");
  });

  it("list returns sp_no_list", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        sp_no_list: ["sp-001", "sp-002", "sp-003"],
      }),
    );

    const client = new WecomApprovalClient();
    const result = await client.list(createAgent(), {
      start_time: "1711900800",
      end_time: "1711987200",
    });

    expect(result.sp_no_list).toEqual(["sp-001", "sp-002", "sp-003"]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/oa/getapprovalinfo?");
    // Verify field mapping: start_time → starttime in API payload
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.starttime).toBe("1711900800");
    expect(body.endtime).toBe("1711987200");
  });

  it("list with template_id filter", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        sp_no_list: ["sp-filtered-1"],
      }),
    );

    const client = new WecomApprovalClient();
    const result = await client.list(createAgent(), {
      start_time: "1711900800",
      end_time: "1711987200",
      template_id: "tpl-filter-001",
    });

    expect(result.sp_no_list).toEqual(["sp-filtered-1"]);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.template_id).toBe("tpl-filter-001");
  });

  it("getDetail returns approval record", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        info: {
          sp_no: "sp-detail-1",
          sp_name: "请假",
          sp_status: 2,
          apply_userid: "zhangsan",
        },
      }),
    );

    const client = new WecomApprovalClient();
    const result = await client.getDetail(createAgent(), "sp-detail-1");

    expect(result).toMatchObject({
      sp_no: "sp-detail-1",
      sp_name: "请假",
      sp_status: 2,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/oa/getapprovaldetail?");
  });

  it("getTemplate returns template info", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        template_names: [{ text: "请假审批", lang: "zh_CN" }],
        template_content: {
          controls: [
            {
              property: {
                control: "Text",
                id: "ctl-1",
                title: [{ text: "请假事由", lang: "zh_CN" }],
              },
            },
          ],
        },
      }),
    );

    const client = new WecomApprovalClient();
    const result = await client.getTemplate(createAgent(), "tpl-001");

    expect(result.template_names).toBeDefined();
    expect(result.template_names[0].text).toBe("请假审批");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/oa/gettemplatedetail?");
  });

  it("retry retries on failure", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockResolvedValueOnce(
        jsonResponse({ errcode: 0, errmsg: "ok", sp_no: "sp-retry" }),
      );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: TimerHandler,
    ) => {
      if (typeof handler === "function") handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    try {
      const client = new WecomApprovalClient();
      const result = await client.submit(createAgent(), {
        creator_userid: "zhangsan",
        template_id: "tpl-retry",
      });

      expect(result.sp_no).toBe("sp-retry");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
```

**Acceptance criteria:**
- 7 test cases: submit, submit with summary, list, list with template_id, getDetail, getTemplate, retry
- All tests pass via `pnpm test -- extensions/wecom/src/capability/approval`
- Mock pattern matches P1 established convention (vi.hoisted + vi.mock at top level)

**Test requirements:**
- `pnpm test -- extensions/wecom/src/capability/approval` passes

---

### Task 3: P2 — External Contact Module (types + client + schema + tool + registration)

**covers:** wecom-external-contact/spec.md > Get contact by external_userid, List contacts by userid, List group chats, Paginated group list, Get group detail (name/owner/member_count), Retry on transient failure
**domain:** `[backend]`
**complexity:** `complex`
**blockedBy:** none

**Files:**
- Create: `extensions/wecom/src/capability/external-contact/types.ts`
- Create: `extensions/wecom/src/capability/external-contact/client.ts`
- Create: `extensions/wecom/src/capability/external-contact/schema.ts`
- Create: `extensions/wecom/src/capability/external-contact/tool.ts`
- Modify: `extensions/wecom/index.ts`

**Description:**
Create the external-contact module. It has 4 actions: get (GET), list (GET), list_groups (POST with cursor pagination), get_group_detail (POST). The `get` and `list` use GET requests (like contact module), while `list_groups` and `get_group_detail` use POST (like meeting/todo modules). Note: `list_groups` returns chat_id + status only; use `get_group_detail` for full details (name, owner, member_count) per spec requirement.

- [ ] **Step 1: Create types.ts**

```typescript
// extensions/wecom/src/capability/external-contact/types.ts

export interface WecomExternalContact {
  external_userid: string;
  name?: string;
  position?: string;
  avatar?: string;
  corp_name?: string;
  corp_full_name?: string;
  type?: number; // 1=微信用户, 2=企业微信用户
  gender?: number;
  unionid?: string;
}

export interface WecomExternalContactFollowUser {
  userid: string;
  remark?: string;
  description?: string;
  createtime?: number;
  tags?: Array<{
    group_name?: string;
    tag_name?: string;
    type?: number;
  }>;
  state?: string;
}

export interface WecomExternalContactDetail {
  external_contact: WecomExternalContact;
  follow_user: WecomExternalContactFollowUser[];
}

export interface WecomGroupChat {
  chat_id: string;
  name?: string;
  owner?: string;
  create_time?: number;
  notice?: string;
  member_count?: number;
  status: number; // 0=正常, 1=跟进人离职, 2=离职继承中, 3=离职继承完成
}

export interface WecomGroupChatListResult {
  group_chat_list: Array<{
    chat_id: string;
    status: number;
  }>;
  next_cursor?: string;
}
```

- [ ] **Step 2: Create client.ts with mixed GET/POST pattern**

```typescript
// extensions/wecom/src/capability/external-contact/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type {
  WecomExternalContactDetail,
  WecomGroupChatListResult,
} from "./types.js";

function readString(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

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

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
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

export class WecomExternalContactClient {
  private async getWecomExternalContactApi(params: {
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

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          { method: "GET" },
          { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
        );
        return await parseJsonResponse(res, actionLabel);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastErr;
  }

  private async postWecomExternalContactApi(params: {
    path: string;
    actionLabel: string;
    agent: ResolvedAgentAccount;
    body: Record<string, unknown>;
  }): Promise<any> {
    const { path, actionLabel, agent, body } = params;
    const token = await getAccessToken(agent);
    const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
    const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body ?? {}),
          },
          { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
        );
        return await parseJsonResponse(res, actionLabel);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastErr;
  }

  async get(
    agent: ResolvedAgentAccount,
    externalUserid: string,
  ): Promise<WecomExternalContactDetail> {
    const normalizedId = readString(externalUserid);
    if (!normalizedId) throw new Error("external_userid required");

    const json = await this.getWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/get",
      actionLabel: "get",
      agent,
      query: { external_userid: normalizedId },
    });

    return {
      external_contact: json.external_contact ?? {},
      follow_user: Array.isArray(json.follow_user) ? json.follow_user : [],
    } as WecomExternalContactDetail;
  }

  async list(
    agent: ResolvedAgentAccount,
    userid: string,
  ): Promise<string[]> {
    const normalizedUserId = readString(userid);
    if (!normalizedUserId) throw new Error("userid required");

    const json = await this.getWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/list",
      actionLabel: "list",
      agent,
      query: { userid: normalizedUserId },
    });

    return Array.isArray(json.external_userid) ? (json.external_userid as string[]) : [];
  }

  async listGroups(
    agent: ResolvedAgentAccount,
    params?: {
      status_filter?: number;
      owner_filter?: { userid_list?: string[] };
      cursor?: string;
      limit?: number;
    },
  ): Promise<WecomGroupChatListResult> {
    const payload: Record<string, unknown> = {};
    if (params?.status_filter !== undefined) {
      payload.status_filter = params.status_filter;
    }
    if (params?.owner_filter) {
      payload.owner_filter = params.owner_filter;
    }
    if (params?.cursor) {
      payload.cursor = readString(params.cursor);
    }
    if (params?.limit !== undefined) {
      payload.limit = params.limit;
    }

    const json = await this.postWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/groupchat/list",
      actionLabel: "list_groups",
      agent,
      body: payload,
    });

    return {
      group_chat_list: Array.isArray(json.group_chat_list) ? json.group_chat_list : [],
      next_cursor: json.next_cursor || undefined,
    } as WecomGroupChatListResult;
  }

  async getGroupDetail(
    agent: ResolvedAgentAccount,
    chatId: string,
  ): Promise<WecomGroupChat> {
    const normalizedChatId = readString(chatId);
    if (!normalizedChatId) throw new Error("chat_id required");

    const json = await this.postWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/groupchat/get",
      actionLabel: "get_group_detail",
      agent,
      body: { chat_id: normalizedChatId, need_name: 1 },
    });

    const groupChat = (json.group_chat ?? {}) as Record<string, unknown>;
    const memberList = Array.isArray(groupChat.member_list) ? groupChat.member_list : [];

    return {
      chat_id: readString(groupChat.chat_id) || normalizedChatId,
      name: readString(groupChat.name) || undefined,
      owner: readString(groupChat.owner) || undefined,
      create_time: typeof groupChat.create_time === "number" ? groupChat.create_time : undefined,
      notice: readString(groupChat.notice) || undefined,
      member_count: memberList.length || undefined,
      status: typeof groupChat.status === "number" ? groupChat.status : 0,
    } as WecomGroupChat;
  }
}
```

- [ ] **Step 3: Create schema.ts**

```typescript
// extensions/wecom/src/capability/external-contact/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

export const wecomExternalContactToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "external_userid"],
      properties: {
        action: { const: "get" },
        accountId: accountIdProperty,
        external_userid: {
          type: "string",
          minLength: 1,
          description: "外部联系人的 external_userid",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid"],
      properties: {
        action: { const: "list" },
        accountId: accountIdProperty,
        userid: {
          type: "string",
          minLength: 1,
          description: "内部成员 userid，获取该成员的所有外部联系人列表",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { const: "list_groups" },
        accountId: accountIdProperty,
        status_filter: {
          type: "integer",
          enum: [0, 1, 2, 3],
          description: "群状态过滤：0=正常，1=跟进人离职，2=离职继承中，3=离职继承完成",
        },
        owner_filter: {
          type: "object",
          properties: {
            userid_list: {
              type: "array",
              items: { type: "string", minLength: 1 },
              description: "按群主 userid 过滤",
            },
          },
          description: "群主过滤条件",
        },
        cursor: {
          type: "string",
          description: "分页游标（传上一页返回的 next_cursor）",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 1000,
          description: "每页数量，默认 100，最大 1000",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "chat_id"],
      properties: {
        action: { const: "get_group_detail" },
        accountId: accountIdProperty,
        chat_id: {
          type: "string",
          minLength: 1,
          description: "客户群 chat_id（从 list_groups 获取）",
        },
      },
    },
  ],
} as const;
```

- [ ] **Step 4: Create tool.ts**

```typescript
// extensions/wecom/src/capability/external-contact/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomExternalContactClient } from "./client.js";
import { wecomExternalContactToolSchema } from "./schema.js";

function buildToolResult(payload: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function registerWecomExternalContactTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const externalContactClient = new WecomExternalContactClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_external_contact",
    label: "WeCom External Contact",
    description:
      "企业微信客户联系工具，支持获取外部联系人详情、列表和客户群列表。",
    parameters: wecomExternalContactToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(
            `WeCom account ${accountId} not configured for External Contact API requirements`,
          );
        }

        const action = params.action;
        switch (action) {
          case "get": {
            const detail = await externalContactClient.get(
              account,
              params.external_userid,
            );
            const contactName =
              detail.external_contact?.name || params.external_userid;
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `外部联系人详情已获取：${contactName}`,
              detail,
            });
          }
          case "list": {
            const externalUserids = await externalContactClient.list(
              account,
              params.userid,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `找到 ${externalUserids.length} 个外部联系人`,
              userid: params.userid,
              external_userid_list: externalUserids,
            });
          }
          case "list_groups": {
            const result = await externalContactClient.listGroups(account, {
              status_filter: params.status_filter,
              owner_filter: params.owner_filter,
              cursor: params.cursor,
              limit: params.limit,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `找到 ${result.group_chat_list.length} 个客户群`,
              group_chat_list: result.group_chat_list,
              next_cursor: result.next_cursor,
            });
          }
          case "get_group_detail": {
            const groupChat = await externalContactClient.getGroupDetail(
              account,
              params.chat_id,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `客户群详情已获取：${groupChat.name || params.chat_id}`,
              group_chat: groupChat,
            });
          }
          default:
            throw new Error(`Unsupported action: ${String(action)}`);
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ok: false,
                  action: params?.action,
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
    },
  }));
}
```

- [ ] **Step 5: Register in index.ts**

> **Note:** Task 1 Step 5 also modifies index.ts. If Task 1 and Task 3 are executed in parallel, this step must be serialized (merge both imports and registrations in one edit). If sequential, this step should add BOTH imports+registrations together if Task 1 hasn't done it yet.

Add import and registration call in `extensions/wecom/index.ts`:

```typescript
// Add import (after approval import):
import { registerWecomExternalContactTools } from "./src/capability/external-contact/tool.js";

// Add registration in register() (after registerWecomApprovalTools):
registerWecomExternalContactTools(api);
```

**Acceptance criteria:**
- All 4 files compile without new TS errors
- `WecomExternalContactClient` has methods: get (GET), list (GET), listGroups (POST + cursor pagination), getGroupDetail (POST)
- Schema has 4 oneOf branches (get, list, list_groups, get_group_detail)
- Tool dispatch covers all 3 actions
- Registration call in index.ts
- 3-retry pattern in both GET and POST methods

**Test requirements:**
- tsc --noEmit passes (no new errors from this module)
- Existing test suite passes (no regression)

---

### Task 4: P2 — External Contact Module Tests

**covers:** wecom-external-contact/spec.md > All scenarios (get, list, list_groups, paginated group list, retry)
**domain:** `[test]`
**complexity:** `simple`
**blockedBy:** Task 3

**Files:**
- Create: `extensions/wecom/src/capability/external-contact/external-contact.test.ts`

**Description:**
Write tests for the external-contact module following the established test pattern.

- [ ] **Step 1: Create external-contact.test.ts**

```typescript
// extensions/wecom/src/capability/external-contact/external-contact.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedAgentAccount } from "../../types/index.js";

const { getAccessTokenMock, resolveProxyMock, wecomFetchMock } = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn().mockResolvedValue("mock-access-token"),
  resolveProxyMock: vi.fn(() => "http://proxy.local:8080"),
  wecomFetchMock: vi.fn(),
}));

vi.mock("../../transport/agent-api/core.js", () => ({
  getAccessToken: getAccessTokenMock,
}));

vi.mock("../../config/index.js", () => ({
  resolveWecomEgressProxyUrlFromNetwork: resolveProxyMock,
}));

vi.mock("../../http.js", () => ({
  wecomFetch: wecomFetchMock,
}));

import { WecomExternalContactClient } from "./client.js";

function createAgent(): ResolvedAgentAccount {
  return {
    accountId: "acct-1",
    configured: true,
    corpId: "corp-id",
    corpSecret: "corp-secret",
    agentId: 100001,
    token: "agent-token",
    encodingAESKey: "encoding-aes-key",
    config: {
      corpId: "corp-id",
      agentSecret: "corp-secret",
      agentId: 100001,
      token: "agent-token",
      encodingAESKey: "encoding-aes-key",
    },
    network: { egressProxyUrl: "http://proxy.local:8080" },
    callbackConfigured: true,
    apiConfigured: true,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("WecomExternalContactClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get returns external contact detail", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        external_contact: {
          external_userid: "ext-001",
          name: "张三客户",
          corp_name: "ABC公司",
          type: 1,
        },
        follow_user: [
          { userid: "lisi", remark: "重要客户", createtime: 1711900800 },
        ],
      }),
    );

    const client = new WecomExternalContactClient();
    const result = await client.get(createAgent(), "ext-001");

    expect(result.external_contact.external_userid).toBe("ext-001");
    expect(result.external_contact.name).toBe("张三客户");
    expect(result.follow_user).toHaveLength(1);
    expect(result.follow_user[0].userid).toBe("lisi");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/cgi-bin/externalcontact/get?"),
      expect.objectContaining({ method: "GET" }),
      { proxyUrl: "http://proxy.local:8080", timeoutMs: expect.any(Number) },
    );
  });

  it("list returns external_userid array", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        external_userid: ["ext-001", "ext-002", "ext-003"],
      }),
    );

    const client = new WecomExternalContactClient();
    const result = await client.list(createAgent(), "lisi");

    expect(result).toEqual(["ext-001", "ext-002", "ext-003"]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/externalcontact/list?");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("userid=lisi");
  });

  it("listGroups returns group list", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        group_chat_list: [
          { chat_id: "grp-001", status: 0 },
          { chat_id: "grp-002", status: 0 },
        ],
      }),
    );

    const client = new WecomExternalContactClient();
    const result = await client.listGroups(createAgent());

    expect(result.group_chat_list).toHaveLength(2);
    expect(result.group_chat_list[0].chat_id).toBe("grp-001");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/cgi-bin/externalcontact/groupchat/list?"),
      expect.objectContaining({ method: "POST" }),
      { proxyUrl: "http://proxy.local:8080", timeoutMs: expect.any(Number) },
    );
  });

  it("listGroups supports cursor pagination", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        group_chat_list: [{ chat_id: "grp-page2", status: 0 }],
        next_cursor: "cursor-page3",
      }),
    );

    const client = new WecomExternalContactClient();
    const result = await client.listGroups(createAgent(), {
      cursor: "cursor-page2",
      limit: 10,
    });

    expect(result.group_chat_list).toHaveLength(1);
    expect(result.next_cursor).toBe("cursor-page3");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.cursor).toBe("cursor-page2");
    expect(body.limit).toBe(10);
  });

  it("getGroupDetail returns full group info", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        group_chat: {
          chat_id: "grp-detail-1",
          name: "VIP 客户群",
          owner: "zhangsan",
          status: 0,
          member_list: [
            { userid: "user1", type: 1 },
            { userid: "user2", type: 2 },
          ],
        },
      }),
    );

    const client = new WecomExternalContactClient();
    const result = await client.getGroupDetail(createAgent(), "grp-detail-1");

    expect(result.chat_id).toBe("grp-detail-1");
    expect(result.name).toBe("VIP 客户群");
    expect(result.owner).toBe("zhangsan");
    expect(result.member_count).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/cgi-bin/externalcontact/groupchat/get?"),
      expect.objectContaining({ method: "POST" }),
      { proxyUrl: "http://proxy.local:8080", timeoutMs: expect.any(Number) },
    );
  });

  it("retry retries on failure (GET path)", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          errmsg: "ok",
          external_userid: ["ext-retry-1"],
        }),
      );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: TimerHandler,
    ) => {
      if (typeof handler === "function") handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    try {
      const client = new WecomExternalContactClient();
      const result = await client.list(createAgent(), "retry-user");

      expect(result).toEqual(["ext-retry-1"]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("retry retries on failure (POST path)", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          errmsg: "ok",
          group_chat_list: [{ chat_id: "grp-retry", status: 0 }],
        }),
      );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: TimerHandler,
    ) => {
      if (typeof handler === "function") handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    try {
      const client = new WecomExternalContactClient();
      const result = await client.listGroups(createAgent());

      expect(result.group_chat_list).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
```

**Acceptance criteria:**
- 7 test cases: get, list, listGroups, pagination, getGroupDetail, GET retry, POST retry
- All tests pass via `pnpm test -- extensions/wecom/src/capability/external-contact`
- Mock pattern matches P1 established convention

**Test requirements:**
- `pnpm test -- extensions/wecom/src/capability/external-contact` passes

---

### Task 5: P2 — Integration Verification

**covers:** (cross-cutting)
**domain:** `[backend]`
**complexity:** `simple`
**blockedBy:** Task 1, Task 2, Task 3, Task 4

**Files:**
- None (verification only)

**Description:**
Run full verification suite to confirm P2 modules integrate correctly with existing P0+P1 modules.

- [ ] **Step 1: Type check (P2 modules only)**

```bash
pnpm tsgo 2>&1 | tee /tmp/tsgo-output.txt
# Verify no NEW errors from P2 modules specifically:
grep -E "^extensions/wecom/src/capability/(approval|external-contact)" /tmp/tsgo-output.txt && echo "FAIL: P2 modules have TS errors" || echo "OK: No P2 TS errors"
```

Note: pre-existing TS errors in test files are expected (not caused by P2).

- [ ] **Step 2: Full wecom test suite**

```bash
pnpm test -- extensions/wecom
```

Verify all tests pass (including new P2 tests alongside existing P0+P1 tests).

- [ ] **Step 3: Verify registration order**

Check `extensions/wecom/index.ts` has all tools registered in logical order:
Doc → Calendar → MCP → Contact → Meeting → Todo → Approval → External Contact

- [ ] **Step 4: Update OpenSpec tasks.md**

Mark P2 tasks as complete in `openspec/changes/wecom-api-expansion/tasks.md`:
- 9.1-9.4, 9.6-9.7: complete (9.5 index.ts is N/A — P1 pattern doesn't use separate index.ts)
- 10.1-10.4, 10.6-10.7: complete (10.5 index.ts is N/A)
- 11.1-11.3: complete

**Acceptance criteria:**
- No new TS errors from P2 modules (pre-existing test file errors expected)
- All wecom tests pass (existing + new)
- Tool registration order is logical and consistent
- OpenSpec tasks.md checkboxes updated (9.5/10.5 marked N/A)

**Test requirements:**
- `pnpm test -- extensions/wecom` passes with 0 failures
