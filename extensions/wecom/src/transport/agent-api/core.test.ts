import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  wecomFetch: vi.fn(),
  resolveProxy: vi.fn(),
  getAccountRuntime: vi.fn(),
}));

vi.mock("../../http.js", () => ({
  wecomFetch: state.wecomFetch,
  readResponseBodyAsBuffer: vi.fn(),
}));

vi.mock("../../config/index.js", () => ({
  resolveWecomEgressProxyUrlFromNetwork: state.resolveProxy,
}));

vi.mock("../../runtime.js", () => ({
  getAccountRuntime: state.getAccountRuntime,
}));

import { sendText } from "./core.js";

function jsonResponse(payload: unknown) {
  return {
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe("agent api sendText", () => {
  beforeEach(() => {
    state.wecomFetch.mockReset();
    state.resolveProxy.mockReset();
    state.resolveProxy.mockReturnValue(undefined);
    state.getAccountRuntime.mockReset();
    state.getAccountRuntime.mockReturnValue({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it("falls back to legacy markdown when markdown_v2 is rejected", async () => {
    state.wecomFetch
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "token-1",
          expires_in: 7200,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 40001,
          errmsg: "unsupported markdown_v2 msgtype",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          errmsg: "ok",
        }),
      );

    await sendText({
      agent: {
        accountId: "acct-1",
        corpId: "corp-1",
        corpSecret: "secret-1",
        agentId: 10001,
      } as any,
      toUser: "alice",
      text: "hello",
    });

    expect(state.wecomFetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(state.wecomFetch.mock.calls[1]?.[1]?.body as string)).toEqual({
      touser: "alice",
      toparty: undefined,
      totag: undefined,
      msgtype: "markdown_v2",
      agentid: 10001,
      markdown_v2: { content: "hello" },
    });
    expect(JSON.parse(state.wecomFetch.mock.calls[2]?.[1]?.body as string)).toEqual({
      touser: "alice",
      toparty: undefined,
      totag: undefined,
      msgtype: "markdown",
      agentid: 10001,
      markdown: { content: "hello" },
    });
  });

  it("falls back to legacy markdown when WeCom returns generic invalid message type", async () => {
    state.wecomFetch
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "token-2",
          expires_in: 7200,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 40008,
          errmsg:
            "invalid message type, hint: [1778149113022873125205048], from ip: 60.204.148.217",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errcode: 0,
          errmsg: "ok",
        }),
      );

    await sendText({
      agent: {
        accountId: "acct-2",
        corpId: "corp-2",
        corpSecret: "secret-2",
        agentId: 10002,
      } as any,
      toUser: "bob",
      text: "hello",
    });

    expect(state.wecomFetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(state.wecomFetch.mock.calls[1]?.[1]?.body as string)).toEqual({
      touser: "bob",
      toparty: undefined,
      totag: undefined,
      msgtype: "markdown_v2",
      agentid: 10002,
      markdown_v2: { content: "hello" },
    });
    expect(JSON.parse(state.wecomFetch.mock.calls[2]?.[1]?.body as string)).toEqual({
      touser: "bob",
      toparty: undefined,
      totag: undefined,
      msgtype: "markdown",
      agentid: 10002,
      markdown: { content: "hello" },
    });
  });
});
