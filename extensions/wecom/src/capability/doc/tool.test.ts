import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const docClient = {
    smartTableAddRecords: vi.fn(),
    smartTableDelRecords: vi.fn(),
    smartTableOperate: vi.fn(),
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

import { registerWecomDocTools } from "./tool.js";

describe("registerWecomDocTools smartsheet record dispatch", () => {
  beforeEach(() => {
    state.registeredFactory = null;
    state.docClient.smartTableAddRecords.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.smartTableDelRecords.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
    state.docClient.smartTableOperate.mockReset().mockResolvedValue({ raw: { errcode: 0 } });
  });

  function registerTool() {
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
    )({ accountId: "acct-1" });
  }

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
});
