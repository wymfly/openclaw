import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const docClient = {
    createDoc: vi.fn(),
    getDocAuth: vi.fn(),
    setDocJoinRule: vi.fn(),
    smartTableAddRecords: vi.fn(),
    smartTableAddSheet: vi.fn(),
    smartTableDelRecords: vi.fn(),
    smartTableOperate: vi.fn(),
    smartTableUpdateSheet: vi.fn(),
    updateDocContent: vi.fn(),
  };
  return {
    account: { accountId: "acct-1", configured: true },
    docClient,
    registeredFactory: null as null | ((context: Record<string, unknown>) => unknown),
  };
});

vi.mock("../bot/fallback-delivery.js", () => ({
  resolveAgentAccountOrUndefined: () => state.account,
}));

vi.mock("./client.js", () => ({
  WecomDocClient: vi.fn(function WecomDocClient() {
    return state.docClient;
  }),
}));

import { wecomDocToolSchema } from "./schema.js";
import { registerWecomDocTools } from "./tool.js";

const historicalDirectActions20260508 = [
  "add_collaborators",
  "copy",
  "create",
  "create_collect",
  "delete",
  "diagnose_auth",
  "doc_assign_advanced_account",
  "doc_cancel_advanced_account",
  "doc_get_advanced_account_list",
  "edit_sheet_data",
  "get_auth",
  "get_content",
  "get_doc_security_setting",
  "get_form_answer",
  "get_form_info",
  "get_form_statistic",
  "get_info",
  "get_sheet_data",
  "get_sheet_properties",
  "grant_access",
  "mod_doc_member_notified_scope",
  "mod_doc_security_setting",
  "modify_collect",
  "rename",
  "set_join_rule",
  "set_member_auth",
  "set_safety_setting",
  "share",
  "smartsheet_add_external_records",
  "smartsheet_add_fields",
  "smartsheet_add_group",
  "smartsheet_add_records",
  "smartsheet_add_sheet",
  "smartsheet_add_view",
  "smartsheet_create_rule",
  "smartsheet_del_fields",
  "smartsheet_del_group",
  "smartsheet_del_records",
  "smartsheet_del_sheet",
  "smartsheet_del_view",
  "smartsheet_delete_rule",
  "smartsheet_get_fields",
  "smartsheet_get_groups",
  "smartsheet_get_records",
  "smartsheet_get_sheet_priv",
  "smartsheet_get_sheets",
  "smartsheet_get_views",
  "smartsheet_mod_rule_member",
  "smartsheet_update_external_records",
  "smartsheet_update_fields",
  "smartsheet_update_group",
  "smartsheet_update_records",
  "smartsheet_update_sheet",
  "smartsheet_update_sheet_priv",
  "smartsheet_update_view",
  "update_content",
  "upload_doc_image",
  "validate_share_link",
] as const;

function collectPublicSchemaActions(): string[] {
  return (
    wecomDocToolSchema.oneOf as readonly {
      properties?: { action?: { const?: string } };
    }[]
  )
    .map((option) => option.properties?.action?.const)
    .filter((action): action is string => Boolean(action))
    .toSorted();
}

function readSupportMatrixRows() {
  const matrixPath = path.join(
    process.cwd(),
    "extensions/wecom/docs/wecom-doc-tool-support-matrix.md",
  );
  const rows = new Map<string, { publicStatus: string; tier: string }>();
  for (const line of fs.readFileSync(matrixPath, "utf8").split("\n")) {
    if (!line.startsWith("| `")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const action = cells[0]?.match(/`([^`]+)`/)?.[1];
    if (!action || rows.has(action)) {
      continue;
    }
    rows.set(action, {
      tier: cells[3] ?? "",
      publicStatus: cells[4] ?? "",
    });
  }
  return rows;
}

describe("registerWecomDocTools smartsheet record dispatch", () => {
  beforeEach(() => {
    state.registeredFactory = null;
    state.docClient.createDoc.mockReset().mockResolvedValue({
      raw: { errcode: 0, errmsg: "ok", docid: "DOCID" },
      docId: "DOCID",
      url: "https://doc.weixin.qq.com/doc/DOCID",
      docType: 3,
      docTypeLabel: "doc",
    });
    state.docClient.getDocAuth.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.setDocJoinRule.mockReset().mockResolvedValue({
      raw: { errcode: 0, errmsg: "ok" },
      docId: "DOCID",
    });
    state.docClient.smartTableAddRecords.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.smartTableAddSheet.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.smartTableDelRecords.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.smartTableOperate.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.smartTableUpdateSheet.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.updateDocContent.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
  });

  function registerTool(context: Record<string, unknown> = { accountId: "acct-1" }) {
    const api = {
      config: {},
      registerTool: vi.fn((factory) => {
        state.registeredFactory = factory;
      }),
    };
    registerWecomDocTools(api as never);
    expect(state.registeredFactory).toBeTypeOf("function");
    return (
      state.registeredFactory as (context: Record<string, unknown>) => {
        execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
      }
    )(context);
  }

  it("creates text-only init_content with one insert_text request", async () => {
    const tool = registerTool();

    await tool.execute("call-create", {
      action: "create",
      accountId: "acct-1",
      docName: "初始化内容回归",
      init_content: ["标题", "第一段", "第二段"],
    });

    expect(state.docClient.setDocJoinRule).toHaveBeenCalledWith({
      agent: state.account,
      docId: "DOCID",
      request: {
        enable_corp_internal: true,
        corp_internal_auth: 1,
        enable_corp_external: false,
        ban_share_external: false,
      },
    });
    expect(state.docClient.updateDocContent).toHaveBeenNthCalledWith(1, {
      agent: state.account,
      docId: "DOCID",
      requests: [
        {
          insert_text: {
            text: "标题\n第一段\n第二段",
            location: { index: 0 },
          },
        },
      ],
    });
    expect(state.docClient.updateDocContent).toHaveBeenNthCalledWith(2, {
      agent: state.account,
      docId: "DOCID",
      requests: [
        {
          update_text_property: {
            text_property: { bold: true },
            ranges: [{ start_index: 0, length: 2 }],
          },
        },
      ],
    });
  });

  it("reports collaborator members returned in doc_member_list", async () => {
    state.docClient.getDocAuth.mockResolvedValue({
      raw: { errcode: 0 },
      accessRule: {
        enable_corp_internal: true,
        enable_corp_external: false,
        ban_share_external: false,
      },
      docMembers: [
        { userid: "viewer-1", auth: 1 },
        { userid: "writer-1", auth: 7 },
      ],
      coAuthList: [],
    });
    const tool = registerTool({ accountId: "acct-1", senderId: "writer-1" });

    const result = (await tool.execute("call-auth", {
      action: "get_auth",
      accountId: "acct-1",
      docId: "DOCID",
    })) as { details: Record<string, unknown> };

    expect(result.details.diagnosis).toMatchObject({
      viewerCount: 1,
      collaboratorCount: 1,
      requesterRole: "collaborator",
    });
  });

  it("routes smartsheet_add_records through the official typed client method", async () => {
    const tool = registerTool();
    const records = [
      {
        values: {
          FIELD_ID_TEXT: [{ type: "text", text: "文本内容" }],
          FIELD_ID_DATE: "1704067200000",
        },
      },
    ];

    await tool.execute("call-1", {
      action: "smartsheet_add_records",
      accountId: "acct-1",
      docId: "DOCID",
      sheetId: "SHEETID",
      key_type: "CELL_VALUE_KEY_TYPE_FIELD_ID",
      records,
    });

    expect(state.docClient.smartTableAddRecords).toHaveBeenCalledWith({
      agent: state.account,
      docId: "DOCID",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_ID",
      records,
    });
    expect(state.docClient.smartTableOperate).not.toHaveBeenCalled();
  });

  it("routes smartsheet_del_records through delete_records, not the stale del_records operation", async () => {
    const tool = registerTool();

    await tool.execute("call-1", {
      action: "smartsheet_del_records",
      accountId: "acct-1",
      docId: "DOCID",
      sheetId: "SHEETID",
      record_ids: ["rec-1"],
    });

    expect(state.docClient.smartTableDelRecords).toHaveBeenCalledWith({
      agent: state.account,
      docId: "DOCID",
      sheetId: "SHEETID",
      record_ids: ["rec-1"],
    });
    expect(state.docClient.smartTableOperate).not.toHaveBeenCalled();
  });

  it("routes official smartsheet_add_sheet properties through the typed client method", async () => {
    const tool = registerTool();

    await tool.execute("call-add-sheet", {
      action: "smartsheet_add_sheet",
      accountId: "acct-1",
      docId: "DOCID",
      properties: { title: "官方形状子表" },
    });

    expect(state.docClient.smartTableAddSheet).toHaveBeenCalledWith({
      agent: state.account,
      docId: "DOCID",
      title: undefined,
      index: undefined,
      properties: { title: "官方形状子表" },
    });
  });

  it("routes official smartsheet_update_sheet properties through the typed client method", async () => {
    const tool = registerTool();

    await tool.execute("call-update-sheet", {
      action: "smartsheet_update_sheet",
      accountId: "acct-1",
      docId: "DOCID",
      properties: { sheet_id: "SHEETID", title: "新标题" },
    });

    expect(state.docClient.smartTableUpdateSheet).toHaveBeenCalledWith({
      agent: state.account,
      docId: "DOCID",
      sheetId: undefined,
      title: undefined,
      properties: { sheet_id: "SHEETID", title: "新标题" },
    });
  });
});

describe("wecom_doc public contract matrix", () => {
  it("keeps the support matrix aligned with the historical direct action inventory", () => {
    const rows = readSupportMatrixRows();
    const publicActions = collectPublicSchemaActions();

    for (const action of historicalDirectActions20260508) {
      expect(rows.has(action), `${action} missing from support matrix`).toBe(true);
    }

    for (const action of publicActions) {
      const row = rows.get(action);
      expect(row, `${action} missing from support matrix`).toBeTruthy();
      expect(row?.publicStatus, `${action} must be marked public`).toBe("yes");
      expect(row?.tier, `${action} must not be unsupported`).not.toBe("unsupported");
    }

    expect(publicActions).not.toContain("smartsheet_add_external_records");
    expect(publicActions).not.toContain("smartsheet_update_external_records");
    expect(publicActions).not.toContain("copy");
    expect(publicActions).not.toContain("mod_doc_member_notified_scope");
    expect(rows.get("smartsheet_add_external_records")?.tier).toBe("unsupported");
    expect(rows.get("smartsheet_add_external_records")?.publicStatus).toBe("no");
    expect(rows.get("smartsheet_update_external_records")?.tier).toBe("unsupported");
    expect(rows.get("smartsheet_update_external_records")?.publicStatus).toBe("no");
    expect(rows.get("copy")?.tier).toBe("compat-hidden");
    expect(rows.get("copy")?.publicStatus).toBe("no");
    expect(rows.get("mod_doc_member_notified_scope")?.tier).toBe("unsupported");
    expect(rows.get("mod_doc_member_notified_scope")?.publicStatus).toBe("no");
  });
});
