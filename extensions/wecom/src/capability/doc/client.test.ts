import AjvPkg from "ajv";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedAgentAccount } from "../../types/index.js";
import { WecomDocClient } from "./client.js";
import { wecomDocToolSchema } from "./schema.js";

const agent = { accountId: "acct-1" } as ResolvedAgentAccount;
const Ajv = AjvPkg as unknown as new (opts?: object) => import("ajv").default;

function createStubbedClient() {
  const client = new WecomDocClient();
  const postWecomDocApi = vi.fn().mockResolvedValue({ errcode: 0, errmsg: "ok" });
  Object.defineProperty(client, "postWecomDocApi", {
    value: postWecomDocApi,
  });
  return { client, postWecomDocApi };
}

describe("WecomDocClient smartsheet records", () => {
  it("accepts create_collect request aliases and sends official form_info", async () => {
    const { client, postWecomDocApi } = createStubbedClient();
    const formInfo = {
      form_title: "测试收集表",
      form_question: {
        items: [
          {
            question_id: 1,
            title: "姓名",
            pos: 1,
            reply_type: 1,
            must_reply: true,
          },
        ],
      },
    };

    await client.createCollect({
      agent,
      request: { form_info: formInfo },
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/create_collect",
      actionLabel: "create_collect",
      agent,
      body: {
        form_info: {
          ...formInfo,
          form_setting: {},
        },
      },
    });
  });

  it("accepts create_collect request items alias and builds form_question", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.createCollect({
      agent,
      request: {
        form_title: "回归收集表",
        items: [
          {
            question_id: 1,
            title: "姓名",
            pos: 1,
            reply_type: 1,
            must_reply: true,
          },
        ],
      },
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/create_collect",
      actionLabel: "create_collect",
      agent,
      body: {
        form_info: {
          form_title: "回归收集表",
          form_question: {
            items: [
              {
                question_id: 1,
                title: "姓名",
                pos: 1,
                reply_type: 1,
                must_reply: true,
              },
            ],
          },
          form_setting: {},
        },
      },
    });
  });

  it("rejects create_collect title-only aliases before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.createCollect({
        agent,
        docName: "收集表回归C",
      }),
    ).rejects.toThrow("form_question.items");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("sends viewers-only grant_access as update_file_member_list", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.grantDocAccess({
      agent,
      docId: "DOCID",
      viewers: ["WangYiMing"],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/mod_doc_member",
      actionLabel: "mod_doc_member",
      agent,
      body: {
        docid: "DOCID",
        update_file_member_list: [{ userid: "WangYiMing", auth: 1 }],
      },
    });
  });

  it("does not add the same member as viewer when granting collaborator access", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.grantDocAccess({
      agent,
      docId: "DOCID",
      viewers: ["WangYiMing"],
      collaborators: ["WangYiMing"],
    });

    expect(postWecomDocApi).toHaveBeenLastCalledWith({
      path: "/cgi-bin/wedoc/mod_doc_member",
      actionLabel: "mod_doc_member",
      agent,
      body: {
        docid: "DOCID",
        update_file_member_list: [{ userid: "WangYiMing", auth: 7 }],
      },
    });
  });

  it("does not delete an existing viewer in the same collaborator grant request", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi
      .fn()
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: "ok",
        doc_member_list: [{ type: 1, userid: "WangYiMing", auth: 1 }],
      })
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok" });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    await client.grantDocAccess({
      agent,
      docId: "DOCID",
      collaborators: ["WangYiMing"],
    });

    expect(postWecomDocApi).toHaveBeenLastCalledWith({
      path: "/cgi-bin/wedoc/mod_doc_member",
      actionLabel: "mod_doc_member",
      agent,
      body: {
        docid: "DOCID",
        update_file_member_list: [{ userid: "WangYiMing", auth: 7 }],
      },
    });
  });

  it("sends get_form_statistic items as current WeCom single-request objects", async () => {
    const client = new WecomDocClient();
    const response = { errcode: 0, errmsg: "ok", fill_cnt: 1 };
    const postWecomDocApi = vi.fn().mockResolvedValue(response);
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    const result = await client.getFormStatistic({
      agent,
      requests: [{ repeated_id: "REPEATED_ID1", req_type: 1 }],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/get_form_statistic",
      actionLabel: "get_form_statistic",
      agent,
      body: { repeated_id: "REPEATED_ID1", req_type: 1 },
    });
    expect(result.raw).toEqual([response]);
    expect(result.items).toEqual([response]);
    expect(result.successCount).toBe(1);
  });

  it("fans out multiple get_form_statistic requests instead of posting an array", async () => {
    const client = new WecomDocClient();
    const first = { errcode: 0, errmsg: "ok", fill_cnt: 1 };
    const second = { errcode: 0, errmsg: "ok", submit_users: [] };
    const postWecomDocApi = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    const result = await client.getFormStatistic({
      agent,
      requests: [
        { repeated_id: "REPEATED_ID1", req_type: 1 },
        { repeated_id: "REPEATED_ID1", req_type: 2, start_time: 1, end_time: 2, limit: 20 },
      ],
    });

    expect(postWecomDocApi).toHaveBeenNthCalledWith(1, {
      path: "/cgi-bin/wedoc/get_form_statistic",
      actionLabel: "get_form_statistic",
      agent,
      body: { repeated_id: "REPEATED_ID1", req_type: 1 },
    });
    expect(postWecomDocApi).toHaveBeenNthCalledWith(2, {
      path: "/cgi-bin/wedoc/get_form_statistic",
      actionLabel: "get_form_statistic",
      agent,
      body: { repeated_id: "REPEATED_ID1", req_type: 2, start_time: 1, end_time: 2, limit: 20 },
    });
    expect(result.raw).toEqual([first, second]);
    expect(result.successCount).toBe(2);
  });

  it("resolves formId context and defaults req_type 2 statistic windows", async () => {
    const client = new WecomDocClient();
    const response = [{ errcode: 0, errmsg: "ok", submit_users: [] }];
    const postWecomDocApi = vi
      .fn()
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: "ok",
        form_info: { repeated_id: "REPEATED_ID1" },
      })
      .mockResolvedValueOnce(response);
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    await client.getFormStatistic({
      agent,
      formId: "FORMID1",
      requests: [{ repeated_id: "FORMID1", req_type: 2 }],
    } as never);

    expect(postWecomDocApi).toHaveBeenNthCalledWith(1, {
      path: "/cgi-bin/wedoc/get_form_info",
      actionLabel: "get_form_info",
      agent,
      body: { formid: "FORMID1" },
    });
    expect(postWecomDocApi).toHaveBeenNthCalledWith(2, {
      path: "/cgi-bin/wedoc/get_form_statistic",
      actionLabel: "get_form_statistic",
      agent,
      body: {
        repeated_id: "REPEATED_ID1",
        req_type: 2,
        start_time: expect.any(Number),
        end_time: expect.any(Number),
        limit: 100,
      },
    });
  });

  it("requires answer_ids for get_form_answer before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.getFormAnswer({
        agent,
        repeatedId: "REPEATED_ID1",
      }),
    ).rejects.toThrow("answerIds required");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("sends get_form_answer with repeated_id and answer_ids", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.getFormAnswer({
      agent,
      repeatedId: "REPEATED_ID1",
      answerIds: [1],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/get_form_answer",
      actionLabel: "get_form_answer",
      agent,
      body: {
        repeated_id: "REPEATED_ID1",
        answer_ids: [1],
      },
    });
  });

  it("rejects unsupported document join-rule auth values before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.setDocJoinRule({
        agent,
        docId: "DOCID",
        request: { enable_corp_internal: true, corp_internal_auth: 2 },
      }),
    ).rejects.toThrow("corp_internal_auth only supports 1");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("strips disabled join-rule auth branches before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.setDocJoinRule({
      agent,
      docId: "DOCID",
      request: {
        enable_corp_internal: true,
        corp_internal_auth: 1,
        enable_corp_external: false,
        corp_external_auth: 1,
        corp_external_approve_only_by_admin: true,
      },
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/mod_doc_join_rule",
      actionLabel: "mod_doc_join_rule",
      agent,
      body: {
        docid: "DOCID",
        enable_corp_internal: true,
        corp_internal_auth: 1,
        enable_corp_external: false,
      },
    });
  });

  it("accepts create_rule name aliases and sends official name", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableCreateRule({
      agent,
      docId: "DOCID",
      rule_name: "审批规则",
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/content_priv/create_rule",
      actionLabel: "smartsheet_create_rule",
      agent,
      body: {
        docid: "DOCID",
        name: "审批规则",
      },
    });
  });

  it("rejects unverified create_rule privilege object aliases in the public tool schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "smartsheet_create_rule",
      docId: "DOCID",
      name: "审批规则",
      add_member_range: { userid_list: ["zhangsan"] },
      priv_list: [
        {
          sheet_id: "SHEETID",
          priv: { value: "VIEW" },
        },
      ],
    });

    expect(valid).toBe(false);
  });

  it("accepts integer create_rule privileges in the public tool schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "smartsheet_create_rule",
      docId: "DOCID",
      name: "审批规则",
      add_member_range: { userid_list: ["zhangsan"] },
      priv_list: [
        {
          sheet_id: "SHEETID",
          priv: 3,
        },
      ],
    });

    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("rejects long create_rule names in the public tool schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "smartsheet_create_rule",
      docId: "DOCID",
      name: "回归测试额外权限",
    });

    expect(valid).toBe(false);
  });

  it("rejects create_collect docName-only input in the public tool schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "create_collect",
      docName: "收集表回归C",
    });

    expect(valid).toBe(false);
  });

  it("rejects collect-form statistic probes that do not use repeated_id and req_type", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "get_form_statistic",
      requests: [{ question_id: 1 }],
    });

    expect(valid).toBe(false);
  });

  it("accepts official collect-form statistic request items", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "get_form_statistic",
      requests: [{ repeated_id: "REPEATED_ID1", req_type: 1 }],
    });

    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("accepts collect-form statistic requests with ignored formId context", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "get_form_statistic",
      formId: "FORMID1",
      requests: [{ repeated_id: "REPEATED_ID1", req_type: 2 }],
    });

    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("requires answerIds in the public get_form_answer schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "get_form_answer",
      repeatedId: "REPEATED_ID1",
    });

    expect(valid).toBe(false);
  });

  it("accepts get_form_answer with ignored formId context and required answerIds", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "get_form_answer",
      formId: "FORMID1",
      repeatedId: "REPEATED_ID1",
      answerIds: [1],
    });

    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("accepts official smartsheet sheet properties shapes in the public schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const addValid = validate({
      action: "smartsheet_add_sheet",
      docId: "DOCID",
      properties: { title: "官方形状子表" },
    });
    expect(addValid, JSON.stringify(validate.errors, null, 2)).toBe(true);

    const updateValid = validate({
      action: "smartsheet_update_sheet",
      docId: "DOCID",
      properties: { sheet_id: "SHEETID", title: "新标题" },
    });
    expect(updateValid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("keeps legacy flat smartsheet sheet shapes in the public schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const addValid = validate({
      action: "smartsheet_add_sheet",
      docId: "DOCID",
      title: "扁平标题",
    });
    expect(addValid, JSON.stringify(validate.errors, null, 2)).toBe(true);

    const updateValid = validate({
      action: "smartsheet_update_sheet",
      docId: "DOCID",
      sheetId: "SHEETID",
      title: "新标题",
    });
    expect(updateValid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("rejects unsupported set_join_rule write auth values in the public schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "set_join_rule",
      docId: "DOCID",
      request: { enable_corp_internal: true, corp_internal_auth: 2 },
    });

    expect(valid).toBe(false);
  });

  it("accepts read-only set_join_rule auth values in the public schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const valid = validate({
      action: "set_join_rule",
      docId: "DOCID",
      request: { enable_corp_internal: true, corp_internal_auth: 1 },
    });

    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("hides unsupported external-record pseudo endpoints from the public tool schema", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(wecomDocToolSchema);

    const addValid = validate({
      action: "smartsheet_add_external_records",
      docId: "DOCID",
      sheetId: "SHEETID",
      records: [{ values: { 标题: [{ type: "text", text: "文本内容" }] } }],
    });
    expect(addValid).toBe(false);

    const updateValid = validate({
      action: "smartsheet_update_external_records",
      docId: "DOCID",
      sheetId: "SHEETID",
      records: [{ record_id: "rec-1", values: { 标题: [{ type: "text", text: "文本内容" }] } }],
    });
    expect(updateValid).toBe(false);
  });

  it("creates a rule and initializes its sheet privileges when requested", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi
      .fn()
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok", rule_id: 123 })
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok" })
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok" });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    const params = {
      agent,
      docId: "DOCID",
      name: "审批规则",
      add_member_range: { userid_list: ["zhangsan"] },
      priv_list: [
        {
          sheet_id: "SHEETID",
          priv: { value: "VIEW" },
        },
      ],
    } satisfies Parameters<typeof client.smartTableCreateRule>[0] & {
      add_member_range: Record<string, unknown>;
      priv_list: Array<Record<string, unknown>>;
    };

    await client.smartTableCreateRule(params);

    expect(postWecomDocApi).toHaveBeenNthCalledWith(1, {
      path: "/cgi-bin/wedoc/smartsheet/content_priv/create_rule",
      actionLabel: "smartsheet_create_rule",
      agent,
      body: {
        docid: "DOCID",
        name: "审批规则",
      },
    });
    expect(postWecomDocApi).toHaveBeenNthCalledWith(2, {
      path: "/cgi-bin/wedoc/smartsheet/content_priv/update_sheet_priv",
      actionLabel: "smartsheet_update_sheet_priv",
      agent,
      body: {
        docid: "DOCID",
        type: 2,
        rule_id: 123,
        priv_list: [
          {
            sheet_id: "SHEETID",
            priv: 3,
          },
        ],
      },
    });
    expect(postWecomDocApi).toHaveBeenNthCalledWith(3, {
      path: "/cgi-bin/wedoc/smartsheet/content_priv/mod_rule_member",
      actionLabel: "smartsheet_mod_rule_member",
      agent,
      body: {
        docid: "DOCID",
        rule_id: 123,
        add_member_range: { userid_list: ["zhangsan"] },
      },
    });
  });

  it("adds required official field properties for typed smartsheet fields", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableAddFields({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      fields: [
        { field_title: "金额", field_type: "FIELD_TYPE_NUMBER" },
        { field_title: "日期", field_type: "FIELD_TYPE_DATE_TIME" },
        {
          field_title: "状态",
          field_type: "FIELD_TYPE_SINGLE_SELECT",
          options: ["待处理", { text: "完成", style: 3 }],
        },
      ],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/add_fields",
      actionLabel: "smartsheet_add_fields",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        fields: [
          {
            field_title: "金额",
            field_type: "FIELD_TYPE_NUMBER",
            property_number: { decimal_places: 0, use_separate: false },
          },
          {
            field_title: "日期",
            field_type: "FIELD_TYPE_DATE_TIME",
            property_date_time: { format: 'yyyy"年"m"月"d"日"', auto_fill: false },
          },
          {
            field_title: "状态",
            field_type: "FIELD_TYPE_SINGLE_SELECT",
            property_single_select: {
              is_quick_add: true,
              options: [{ text: "待处理" }, { text: "完成", style: 3 }],
            },
          },
        ],
      },
    });
  });

  it("fills field_type and preserves field properties when updating smartsheet fields", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi
      .fn()
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: "ok",
        fields: [
          {
            field_id: "fAmount",
            field_title: "金额",
            field_type: "FIELD_TYPE_NUMBER",
            property_number: { decimal_places: 2, use_separate: true },
          },
        ],
      })
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok" });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    await client.smartTableUpdateFields({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      fields: [{ field_id: "fAmount", field_title: "金额 RMB" }],
    });

    expect(postWecomDocApi).toHaveBeenNthCalledWith(1, {
      path: "/cgi-bin/wedoc/smartsheet/get_fields",
      actionLabel: "smartsheet_get_fields",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
      },
    });
    expect(postWecomDocApi).toHaveBeenNthCalledWith(2, {
      path: "/cgi-bin/wedoc/smartsheet/update_fields",
      actionLabel: "smartsheet_update_fields",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        fields: [
          {
            field_id: "fAmount",
            field_title: "金额 RMB",
            field_type: "FIELD_TYPE_NUMBER",
            property_number: { decimal_places: 2, use_separate: true },
          },
        ],
      },
    });
  });

  it("accepts official smartsheet_add_sheet properties shape", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableAddSheet({
      agent,
      docId: "DOCID",
      properties: { title: "官方形状子表" },
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/add_sheet",
      actionLabel: "smartsheet_add_sheet",
      agent,
      body: {
        docid: "DOCID",
        properties: { title: "官方形状子表" },
      },
    });
  });

  it("keeps the legacy smartsheet_add_sheet flat title shape as compatibility", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableAddSheet({
      agent,
      docId: "DOCID",
      title: "扁平标题",
      index: 1,
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/add_sheet",
      actionLabel: "smartsheet_add_sheet",
      agent,
      body: {
        docid: "DOCID",
        properties: { title: "扁平标题", index: 1 },
      },
    });
  });

  it("accepts official smartsheet_update_sheet properties shape", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableUpdateSheet({
      agent,
      docId: "DOCID",
      properties: { sheet_id: "SHEETID", title: "新标题" },
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/update_sheet",
      actionLabel: "smartsheet_update_sheet",
      agent,
      body: {
        docid: "DOCID",
        properties: { sheet_id: "SHEETID", title: "新标题" },
      },
    });
  });

  it("rejects smartsheet_update_sheet without sheet_id or title before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.smartTableUpdateSheet({
        agent,
        docId: "DOCID",
        properties: { title: "缺少sheet" },
      }),
    ).rejects.toThrow("properties.sheet_id required");

    await expect(
      client.smartTableUpdateSheet({
        agent,
        docId: "DOCID",
        properties: { sheet_id: "SHEETID" },
      }),
    ).rejects.toThrow("properties.title required");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("sends add_records body exactly in the official WeCom shape", async () => {
    const { client, postWecomDocApi } = createStubbedClient();
    const records = [
      {
        values: {
          标题: [{ type: "text", text: "文本内容" }],
          日期: "1704067200000",
          复选框: true,
          邮箱: "user@example.com",
        },
      },
    ];

    await client.smartTableAddRecords({
      agent,
      docId: " DOCID ",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_TITLE",
      records,
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/add_records",
      actionLabel: "smartsheet_add_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        key_type: "CELL_VALUE_KEY_TYPE_FIELD_TITLE",
        records,
      },
    });
  });

  it("normalizes agent-style add_records values to persisted WeCom cell shapes", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi
      .fn()
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: "ok",
        fields: [
          { field_id: "fText", field_title: "标题", field_type: "FIELD_TYPE_TEXT" },
          { field_id: "fAmount", field_title: "金额", field_type: "FIELD_TYPE_NUMBER" },
        ],
      })
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok" });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    await client.smartTableAddRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_ID",
      records: [
        {
          values: {
            fText: { type: "text", text: "values回读复测-A" },
            fAmount: { type: "number", number: 11.1 },
          },
        },
      ],
    });

    expect(postWecomDocApi).toHaveBeenNthCalledWith(1, {
      path: "/cgi-bin/wedoc/smartsheet/get_fields",
      actionLabel: "smartsheet_get_fields",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
      },
    });
    expect(postWecomDocApi).toHaveBeenNthCalledWith(2, {
      path: "/cgi-bin/wedoc/smartsheet/add_records",
      actionLabel: "smartsheet_add_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        key_type: "CELL_VALUE_KEY_TYPE_FIELD_ID",
        records: [
          {
            values: {
              fText: [{ type: "text", text: "values回读复测-A" }],
              fAmount: 11.1,
            },
          },
        ],
      },
    });
  });

  it("sends update_records with key_type and preserves official value types", async () => {
    const { client, postWecomDocApi } = createStubbedClient();
    const records = [
      {
        record_id: "rec-1",
        values: {
          FIELD_ID_TEXT: [{ type: "text", text: "文本内容" }],
          FIELD_ID_DATE: "1704067200000",
          FIELD_ID_CHECKBOX: false,
          FIELD_ID_PHONE: "13800138000",
        },
      },
    ];

    await client.smartTableUpdateRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_ID",
      records,
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/update_records",
      actionLabel: "smartsheet_update_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        key_type: "CELL_VALUE_KEY_TYPE_FIELD_ID",
        records,
      },
    });
  });

  it("normalizes agent-style update_records values to persisted WeCom cell shapes", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi
      .fn()
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: "ok",
        fields: [
          { field_id: "fText", field_title: "标题", field_type: "FIELD_TYPE_TEXT" },
          { field_id: "fAmount", field_title: "金额", field_type: "FIELD_TYPE_NUMBER" },
        ],
      })
      .mockResolvedValueOnce({ errcode: 0, errmsg: "ok" });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    await client.smartTableUpdateRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_TITLE",
      records: [
        {
          record_id: "rec-1",
          values: {
            标题: "values回读复测-B",
            金额: { number: 22.2 },
          },
        },
      ],
    });

    expect(postWecomDocApi).toHaveBeenNthCalledWith(2, {
      path: "/cgi-bin/wedoc/smartsheet/update_records",
      actionLabel: "smartsheet_update_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        key_type: "CELL_VALUE_KEY_TYPE_FIELD_TITLE",
        records: [
          {
            record_id: "rec-1",
            values: {
              标题: [{ type: "text", text: "values回读复测-B" }],
              金额: 22.2,
            },
          },
        ],
      },
    });
  });

  it("rejects key_type values outside the official enum before sending", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.smartTableAddRecords({
        agent,
        docId: "DOCID",
        sheetId: "SHEETID",
        keyType: "FIELD_TITLE",
        records: [{ values: { 标题: [{ type: "text", text: "文本内容" }] } }],
      }),
    ).rejects.toThrow("Unsupported WeCom smartsheet key_type");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("uses the official delete_records endpoint", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableDelRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      record_ids: ["rec-1"],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/delete_records",
      actionLabel: "smartsheet_delete_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        record_ids: ["rec-1"],
      },
    });
  });

  it("sends get_records key_type in the official body", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableGetRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_ID",
      record_ids: ["rec-1"],
      offset: 0,
      limit: 20,
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/get_records",
      actionLabel: "smartsheet_get_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        key_type: "CELL_VALUE_KEY_TYPE_FIELD_ID",
        record_ids: ["rec-1"],
        offset: 0,
        limit: 20,
      },
    });
  });

  it("omits empty get_records filters so WeCom returns record values", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableGetRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      record_ids: [],
      field_titles: [],
      field_ids: [],
      sort: [],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/get_records",
      actionLabel: "smartsheet_get_records",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
      },
    });
  });

  it("preserves raw get_records values and record ids from the WeCom response", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi.fn().mockResolvedValue({
      errcode: 0,
      errmsg: "ok",
      records: [
        {
          record_id: "rec-1",
          values: {
            fText: [{ type: "text", text: "回读值" }],
          },
        },
      ],
    });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    const result = await client.smartTableGetRecords({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      keyType: "CELL_VALUE_KEY_TYPE_FIELD_ID",
    });

    expect(result.raw).toEqual({
      errcode: 0,
      errmsg: "ok",
      records: [
        {
          record_id: "rec-1",
          values: {
            fText: [{ type: "text", text: "回读值" }],
          },
        },
      ],
    });
  });

  it("normalizes field group children to the official field_id object shape", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await client.smartTableAddGroup({
      agent,
      docId: "DOCID",
      sheetId: "SHEETID",
      name: "基础字段",
      children: ["fName", "fAmount"],
    });

    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/add_field_group",
      actionLabel: "smartsheet_add_field_group",
      agent,
      body: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        name: "基础字段",
        children: [{ field_id: "fName" }, { field_id: "fAmount" }],
      },
    });
  });

  it("rejects field groups without children before calling the WeCom API", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.smartTableAddGroup({
        agent,
        docId: "DOCID",
        sheetId: "SHEETID",
        name: "空分组",
      }),
    ).rejects.toThrow("children must be a non-empty array of field ids");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("rejects empty view updates before calling the WeCom API", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.smartTableUpdateView({
        agent,
        docId: "DOCID",
        sheetId: "SHEETID",
        view_id: "view-1",
      }),
    ).rejects.toThrow("view update requires view_title or property");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("rejects unsupported external-record direct endpoints before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.smartTableAddExternalRecords({
        agent,
        docId: "DOCID",
        sheetId: "SHEETID",
        records: [{ values: { 标题: [{ type: "text", text: "文本内容" }] } }],
      }),
    ).rejects.toThrow("smartsheet_add_external_records is not a WeCom Wedoc API endpoint");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });

  it("defaults sheet privilege queries to all-member rules", async () => {
    const client = new WecomDocClient();
    const postWecomDocApi = vi.fn().mockResolvedValue({
      errcode: 0,
      errmsg: "ok",
      rule_list: [{ rule_id: 1, name: "全员权限" }],
    });
    Object.defineProperty(client, "postWecomDocApi", {
      value: postWecomDocApi,
    });

    const result = await client.smartTableGetSheetPriv({
      agent,
      docId: "DOCID",
    });

    expect(result.ruleList).toEqual([{ rule_id: 1, name: "全员权限" }]);
    expect(postWecomDocApi).toHaveBeenCalledWith({
      path: "/cgi-bin/wedoc/smartsheet/content_priv/get_sheet_priv",
      actionLabel: "smartsheet_get_sheet_priv",
      agent,
      body: {
        docid: "DOCID",
        type: 1,
      },
    });
  });

  it("rejects extra sheet privilege queries without rule ids before calling WeCom", async () => {
    const { client, postWecomDocApi } = createStubbedClient();

    await expect(
      client.smartTableGetSheetPriv({
        agent,
        docId: "DOCID",
        type: 2,
      }),
    ).rejects.toThrow("type=2 requires non-empty rule_id_list");

    expect(postWecomDocApi).not.toHaveBeenCalled();
  });
});
