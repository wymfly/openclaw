import { describe, expect, it, vi } from "vitest";
import type { ResolvedAgentAccount } from "../../types/index.js";
import { WecomDocClient } from "./client.js";

const agent = { accountId: "acct-1" } as ResolvedAgentAccount;

function createStubbedClient() {
  const client = new WecomDocClient();
  const postWecomDocApi = vi.fn().mockResolvedValue({ errcode: 0, errmsg: "ok" });
  Object.defineProperty(client, "postWecomDocApi", {
    value: postWecomDocApi,
  });
  return { client, postWecomDocApi };
}

describe("WecomDocClient smartsheet records", () => {
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
});
