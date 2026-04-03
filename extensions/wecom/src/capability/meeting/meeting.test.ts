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

import { WecomMeetingClient } from "./client.js";

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

describe("WecomMeetingClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create creates meeting and returns meetingid", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        meeting_info: {
          meetingid: "m-123",
          title: "Team Sync",
          meeting_start: "1710000000",
          meeting_end: "1710003600",
        },
      }),
    );

    const client = new WecomMeetingClient();
    const result = await client.create(createAgent(), {
      title: "Team Sync",
      start_time: "1710000000",
      end_time: "1710003600",
      invitees: ["u1", "u2"],
    });

    expect(result.meeting.meetingid).toBe("m-123");
    expect(result.raw.errcode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/cgi-bin/meeting/create?"),
      expect.objectContaining({ method: "POST" }),
      { proxyUrl: "http://proxy.local:8080", timeoutMs: expect.any(Number) },
    );
  });

  it("cancel cancels meeting without error", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ errcode: 0, errmsg: "ok" }));

    const client = new WecomMeetingClient();
    const result = await client.cancel(createAgent(), "m-cancel-1");

    expect(result.meetingid).toBe("m-cancel-1");
    expect(result.raw.errcode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      meetingid?: string;
    };
    expect(body.meetingid).toBe("m-cancel-1");
  });

  it("getInfo returns meeting details from meeting_info", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        meeting_info: {
          meetingid: "m-info-1",
          title: "Info Meeting",
          password: "123456",
        },
      }),
    );

    const client = new WecomMeetingClient();
    const result = await client.getInfo(createAgent(), "m-info-1");

    expect(result).toMatchObject({
      meetingid: "m-info-1",
      title: "Info Meeting",
      password: "123456",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/meeting/get_info?");
  });

  it("listUserMeetings returns meeting list", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
        meeting_list: [
          { meetingid: "m-1", title: "One" },
          { meetingid: "m-2", title: "Two" },
        ],
      }),
    );

    const client = new WecomMeetingClient();
    const result = await client.listUserMeetings(createAgent(), "zhangsan");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ meetingid: "m-1", title: "One" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/cgi-bin/meeting/get_user_meetinglist?");
  });

  it("listUserMeetings tolerates empty result sets", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: "ok",
      }),
    );

    const client = new WecomMeetingClient();
    const result = await client.listUserMeetings(createAgent(), "zhangsan");

    expect(result).toEqual([]);
  });

  it("surfaces WeCom business errors with errcode and errmsg", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          errcode: 40001,
          errmsg: "invalid credential",
        }),
      ),
    );

    const client = new WecomMeetingClient();
    await expect(
      client.create(createAgent(), {
        title: "Broken Meeting",
        start_time: "1710000000",
        end_time: "1710003600",
      }),
    ).rejects.toThrow(/invalid credential.*40001/i);
  });

  it("retry retries on failure and succeeds on 3rd attempt", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          errmsg: "ok",
          meeting_info: {
            meetingid: "m-retry",
            title: "Retry Meeting",
          },
        }),
      );

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: TimerHandler,
    ) => {
      if (typeof handler === "function") handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);

    try {
      const client = new WecomMeetingClient();
      const result = await client.create(createAgent(), {
        title: "Retry Meeting",
        start_time: "1710000000",
        end_time: "1710003600",
      });

      expect(result.meeting.meetingid).toBe("m-retry");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("fails after exhausting all retry attempts", async () => {
    const { wecomFetch } = await import("../../http.js");
    const fetchMock = vi.mocked(wecomFetch);
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("temporary timeout"))
      .mockRejectedValueOnce(new Error("still failing"));

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: TimerHandler,
    ) => {
      if (typeof handler === "function") handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);

    try {
      const client = new WecomMeetingClient();
      await expect(
        client.create(createAgent(), {
          title: "Broken Meeting",
          start_time: "1710000000",
          end_time: "1710003600",
        }),
      ).rejects.toThrow("still failing");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
