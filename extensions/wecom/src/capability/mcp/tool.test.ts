import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handles: new Map<
    string,
    { isConnected: () => boolean; replyCommand?: (...args: any[]) => any }
  >(),
  sendJsonRpc: vi.fn(),
  clearWecomMcpCategoryCache: vi.fn(),
  saveMediaBuffer: vi.fn(),
}));

vi.mock("../../runtime.js", () => ({
  getBotWsPushHandle: (accountId: string) => state.handles.get(accountId),
  getWecomRuntime: () => ({
    channel: {
      media: {
        saveMediaBuffer: state.saveMediaBuffer,
      },
    },
  }),
}));

vi.mock("./transport.js", () => ({
  sendJsonRpc: state.sendJsonRpc,
  clearWecomMcpCategoryCache: state.clearWecomMcpCategoryCache,
}));

import { createWeComMcpToolFactory } from "./tool.js";

function expectSingleTool(tool: ReturnType<ReturnType<typeof createWeComMcpToolFactory>>) {
  expect(tool).toBeTruthy();
  expect(Array.isArray(tool)).toBe(false);
  return tool as AnyAgentTool;
}

describe("createWeComMcpToolFactory", () => {
  beforeEach(() => {
    state.handles.clear();
    state.sendJsonRpc.mockReset();
    state.clearWecomMcpCategoryCache.mockReset();
    state.saveMediaBuffer.mockReset();
  });

  it("does not register outside wecom sessions", () => {
    const factory = createWeComMcpToolFactory();

    const tool = factory({
      messageChannel: "telegram",
      agentAccountId: "acct-1",
    });

    expect(tool).toBeNull();
  });

  it("does not register when the session has no resolvable accountId", () => {
    const factory = createWeComMcpToolFactory();

    const tool = factory({
      messageChannel: "wecom",
    });

    expect(tool).toBeNull();
  });

  it("does not register when bot ws is not connected for the account", () => {
    const factory = createWeComMcpToolFactory();

    const tool = factory({
      messageChannel: "wecom",
      agentAccountId: "acct-1",
    });

    expect(tool).toBeNull();
  });

  it("does not register when bot ws lacks replyCommand support", () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
    });
    const factory = createWeComMcpToolFactory();

    const tool = factory({
      messageChannel: "wecom",
      agentAccountId: "acct-1",
    });

    expect(tool).toBeNull();
  });

  it("registers when bot ws is connected for the account", () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    const factory = createWeComMcpToolFactory();

    const tool = factory({
      messageChannel: "wecom",
      agentAccountId: "acct-1",
    });

    expect(tool).toEqual(
      expect.objectContaining({
        name: "wecom_mcp",
      }),
    );
  });

  it("uploads local smartsheet image and attachment paths before calling MCP records API", async () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wecom-mcp-"));
    const imagePath = path.join(tmpDir, "cover.png");
    const filePath = path.join(tmpDir, "report.pdf");
    fs.writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(filePath, "pdf");
    state.sendJsonRpc
      .mockResolvedValueOnce({
        content: [
          { type: "text", text: JSON.stringify({ errcode: 0, url: "https://img.example/1" }) },
        ],
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({ errcode: 0, fileid: "file-1" }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({ errcode: 0, errmsg: "ok" }) }],
      });
    const tool = expectSingleTool(
      createWeComMcpToolFactory()({
        messageChannel: "wecom",
        agentAccountId: "acct-1",
      }),
    );

    const result = await tool.execute("call-1", {
      action: "call",
      category: "doc",
      method: "smartsheet_add_records",
      args: {
        docid: "DOCID",
        sheet_id: "SHEETID",
        records: [
          {
            values: {
              封面: [{ image_path: imagePath, title: "封面图" }],
              附件: [{ file_path: filePath }],
            },
          },
        ],
      },
    });

    expect(result?.details).toEqual({
      content: [{ type: "text", text: JSON.stringify({ errcode: 0, errmsg: "ok" }) }],
    });
    expect(state.sendJsonRpc).toHaveBeenNthCalledWith(
      1,
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "upload_doc_image",
        arguments: {
          docid: "DOCID",
          base64_content: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
        },
      },
      { timeoutMs: 60_000 },
    );
    expect(state.sendJsonRpc).toHaveBeenNthCalledWith(
      2,
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "upload_doc_file",
        arguments: {
          file_name: "report.pdf",
          file_base64_content: Buffer.from("pdf").toString("base64"),
        },
      },
      { timeoutMs: 60_000 },
    );
    expect(state.sendJsonRpc).toHaveBeenNthCalledWith(
      3,
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "smartsheet_add_records",
        arguments: {
          docid: "DOCID",
          sheet_id: "SHEETID",
          records: [
            {
              values: {
                封面: [{ image_url: "https://img.example/1", title: "封面图" }],
                附件: [{ file_id: "file-1" }],
              },
            },
          ],
        },
      },
      { timeoutMs: 120_000 },
    );
  });

  it("normalizes smart sheet privilege aliases before calling MCP", async () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    state.sendJsonRpc.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ errcode: 0, errmsg: "ok" }) }],
    });
    const tool = expectSingleTool(
      createWeComMcpToolFactory()({
        messageChannel: "wecom",
        agentAccountId: "acct-1",
      }),
    );

    await tool.execute("call-1", {
      action: "call",
      category: "doc",
      method: "smartsheet_create_rule",
      args: {
        docid: "DOCID",
        name: "审批规则",
        priv_list: [
          {
            sheet_id: "SHEETID",
            priv: { value: "VIEW" },
          },
        ],
      },
    });

    expect(state.sendJsonRpc).toHaveBeenCalledWith(
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "smartsheet_create_rule",
        arguments: {
          docid: "DOCID",
          name: "审批规则",
          priv_list: [
            {
              sheet_id: "SHEETID",
              priv: 3,
            },
          ],
        },
      },
      undefined,
    );
  });

  it("maps create_collect flat request items to official form_info before calling MCP", async () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    state.sendJsonRpc.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ errcode: 0, errmsg: "ok" }) }],
    });
    const tool = expectSingleTool(
      createWeComMcpToolFactory()({
        messageChannel: "wecom",
        agentAccountId: "acct-1",
      }),
    );

    await tool.execute("call-1", {
      action: "call",
      category: "doc",
      method: "create_collect",
      args: {
        form_title: "收集表回归C",
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

    expect(state.sendJsonRpc).toHaveBeenCalledWith(
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "create_collect",
        arguments: {
          form_info: {
            form_title: "收集表回归C",
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
      },
      undefined,
    );
  });

  it("does not synthesize create_collect form_info from docName-only args", async () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    state.sendJsonRpc.mockResolvedValueOnce({
      content: [
        { type: "text", text: JSON.stringify({ errcode: 640027, errmsg: "Invalid param" }) },
      ],
    });
    const tool = expectSingleTool(
      createWeComMcpToolFactory()({
        messageChannel: "wecom",
        agentAccountId: "acct-1",
      }),
    );

    await tool.execute("call-1", {
      action: "call",
      category: "doc",
      method: "create_collect",
      args: {
        docName: "收集表回归C",
      },
    });

    expect(state.sendJsonRpc).toHaveBeenCalledWith(
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "create_collect",
        arguments: {
          docName: "收集表回归C",
        },
      },
      undefined,
    );
  });

  it("stores get_msg_media base64 data as a local media file before returning to the agent", async () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    state.saveMediaBuffer.mockResolvedValue({
      path: "/tmp/wecom-media/message.txt",
      contentType: "text/plain",
    });
    state.sendJsonRpc.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            media_item: {
              media_id: "MEDIAID",
              name: "message.txt",
              type: "file",
              base64_data: Buffer.from("hello").toString("base64"),
            },
          }),
        },
      ],
    });
    const tool = expectSingleTool(
      createWeComMcpToolFactory()({
        messageChannel: "wecom",
        agentAccountId: "acct-1",
      }),
    );

    const result = await tool.execute("call-1", {
      action: "call",
      category: "doc",
      method: "get_msg_media",
      args: { media_id: "MEDIAID" },
    });

    expect(state.sendJsonRpc).toHaveBeenCalledWith(
      "acct-1",
      "doc",
      "tools/call",
      {
        name: "get_msg_media",
        arguments: { media_id: "MEDIAID" },
      },
      { timeoutMs: 120_000 },
    );
    expect(state.saveMediaBuffer).toHaveBeenCalledWith(
      Buffer.from("hello"),
      "text/plain",
      "inbound",
      20 * 1024 * 1024,
      "message.txt",
    );
    expect(result?.details).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            errcode: 0,
            errmsg: "ok",
            media_item: {
              media_id: "MEDIAID",
              name: "message.txt",
              type: "file",
              local_path: "/tmp/wecom-media/message.txt",
              size: 5,
              content_type: "text/plain",
            },
          }),
        },
      ],
    });
  });

  it("clears MCP cache for official business auth errors embedded in tool results", async () => {
    state.handles.set("acct-1", {
      isConnected: () => true,
      replyCommand: vi.fn(),
    });
    state.sendJsonRpc.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ errcode: 850001, errmsg: "need config" }) }],
    });
    const tool = expectSingleTool(
      createWeComMcpToolFactory()({
        messageChannel: "wecom",
        agentAccountId: "acct-1",
      }),
    );

    await tool.execute("call-1", {
      action: "call",
      category: "doc",
      method: "smartsheet_get_fields",
      args: { docid: "DOCID", sheet_id: "SHEETID" },
    });

    expect(state.clearWecomMcpCategoryCache).toHaveBeenCalledWith("acct-1", "doc");
  });
});
