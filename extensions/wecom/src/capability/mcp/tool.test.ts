import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handles: new Map<
    string,
    { isConnected: () => boolean; replyCommand?: (...args: any[]) => any }
  >(),
  sendJsonRpc: vi.fn(),
  clearWecomMcpCategoryCache: vi.fn(),
}));

vi.mock("../../runtime.js", () => ({
  getBotWsPushHandle: (accountId: string) => state.handles.get(accountId),
}));

vi.mock("./transport.js", () => ({
  sendJsonRpc: state.sendJsonRpc,
  clearWecomMcpCategoryCache: state.clearWecomMcpCategoryCache,
}));

import { createWeComMcpToolFactory } from "./tool.js";

describe("createWeComMcpToolFactory", () => {
  beforeEach(() => {
    state.handles.clear();
    state.sendJsonRpc.mockReset();
    state.clearWecomMcpCategoryCache.mockReset();
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
});
