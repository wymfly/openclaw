import { beforeEach, describe, expect, it, vi } from "vitest";
import * as runtime from "../../runtime.js";
import { deliverAgentApiText } from "../../transport/agent-api/delivery.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import { WecomAgentDeliveryService } from "./delivery-service.js";

vi.mock("../../transport/agent-api/delivery.js", () => ({
  deliverAgentApiText: vi.fn().mockResolvedValue(undefined),
  deliverAgentApiMedia: vi.fn().mockResolvedValue(undefined),
}));

describe("WecomAgentDeliveryService markdown delivery", () => {
  const agent: ResolvedAgentAccount = {
    accountId: "default",
    configured: true,
    callbackConfigured: true,
    apiConfigured: true,
    corpId: "corp",
    corpSecret: "secret",
    agentId: 10001,
    token: "token",
    encodingAESKey: "aes",
    config: {
      corpId: "corp",
      token: "token",
      encodingAESKey: "aes",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(runtime, "getWecomRuntime").mockReturnValue({
      channel: {
        text: {
          chunkText: (text: string) => [text],
        },
      },
    } as any);
  });

  it("downgrades unsupported WeCom markdown before sending agent replies", async () => {
    const service = new WecomAgentDeliveryService(agent);

    await service.sendText({
      to: "user:alice",
      text: [
        "## 工具测试结果",
        "",
        "```ts",
        "smartTableAddRecords({ records })",
        "```",
        "",
        "> `smartsheet_add_fields` 的部分字段类型：",
        "> `FIELD_TYPE_DATE_TIME` / `FIELD_TYPE_NUMBER`",
        "",
        "文档权限类：`get_auth` / `grant_access` / `set_member_auth`",
      ].join("\n"),
    });

    expect(deliverAgentApiText).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(deliverAgentApiText).mock.calls[0]?.[0]?.text ?? "";
    expect(sent).toContain("工具测试结果");
    expect(sent).toContain("smartTableAddRecords({ records })");
    expect(sent).toContain("smartsheet_add_fields");
    expect(sent).toContain("FIELD_TYPE_DATE_TIME / FIELD_TYPE_NUMBER");
    expect(sent).toContain("文档权限类：get_auth / grant_access / set_member_auth");
    expect(sent).not.toContain("```");
    expect(sent).not.toContain("`");
    expect(sent.split("\n").some((line) => line.trimStart().startsWith(">"))).toBe(false);
  });
});
