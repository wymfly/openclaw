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
