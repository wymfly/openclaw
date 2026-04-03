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
