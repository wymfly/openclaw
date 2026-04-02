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

import { WecomContactClient } from "./client.js";

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

describe("WecomContactClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getMember returns member details for valid userid", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        userid: "zhangsan",
        name: "Zhang San",
        department: [1, 2],
        email: "zhangsan@example.com",
      }),
    );

    const client = new WecomContactClient();
    const result = await client.getMember(createAgent(), "zhangsan");

    expect(result.member).toMatchObject({
      userid: "zhangsan",
      name: "Zhang San",
      department: [1, 2],
      email: "zhangsan@example.com",
    });
    expect(result.raw.errcode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/cgi-bin/user/get?"),
      { method: "GET" },
      { proxyUrl: "http://proxy.local:8080", timeoutMs: expect.any(Number) },
    );
  });

  it("listMembers returns member list for department", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        userlist: [
          { userid: "u1", name: "User One", department: [10] },
          { userid: "u2", name: "User Two", department: [10] },
        ],
      }),
    );

    const client = new WecomContactClient();
    const result = await client.listMembers(createAgent(), 10);

    expect(result.departmentId).toBe(10);
    expect(result.simple).toBe(false);
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({ userid: "u1", name: "User One" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/user/list?");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("department_id=10");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("fetch_child=1");
  });

  it("listDepartments returns full department tree when no parent specified", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        department: [
          { id: 1, name: "Root", parentid: 0 },
          { id: 2, name: "Engineering", parentid: 1 },
          { id: 3, name: "Sales", parentid: 1 },
        ],
      }),
    );

    const client = new WecomContactClient();
    const result = await client.listDepartments(createAgent());

    expect(result.parentId).toBeUndefined();
    expect(result.departments).toHaveLength(3);
    expect(result.departments.map((d) => d.name)).toEqual(["Root", "Engineering", "Sales"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/department/list?");
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("&id=");
  });

  it("search filters members by name query", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        userlist: [
          { userid: "u1", name: "Alice", department: [1], email: "alice@corp.com" },
          { userid: "u2", name: "Alina", department: [1], email: "alina@corp.com" },
          { userid: "u3", name: "Bob", department: [1], email: "bob@corp.com" },
        ],
      }),
    );

    const client = new WecomContactClient();
    const result = await client.search(createAgent(), 1, "ali");

    expect(result.total).toBe(3);
    expect(result.members).toHaveLength(2);
    expect(result.members.map((member) => member.name)).toEqual(["Alice", "Alina"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on network failure up to 3 times and succeeds on 3rd", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          errmsg: "ok",
          userid: "u-retry",
          name: "Retry User",
          department: [1],
        }),
      );

    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === "function") handler();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    try {
      const client = new WecomContactClient();
      const result = await client.getMember(createAgent(), "u-retry");

      expect(result.member.userid).toBe("u-retry");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
