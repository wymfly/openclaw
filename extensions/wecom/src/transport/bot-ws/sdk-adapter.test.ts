import { afterEach, describe, expect, it, vi } from "vitest";

const sdkMockState = vi.hoisted(() => {
  class MockWSClient {
    readonly handlers = new Map<string, Array<(payload: any) => void>>();
    readonly isConnected = true;
    readonly replyStream = vi.fn().mockResolvedValue(undefined);
    readonly sendMessage = vi.fn().mockResolvedValue(undefined);

    constructor(_options: unknown) {
      sdkMockState.client = this;
    }

    on(event: string, handler: (payload: any) => void): void {
      const current = this.handlers.get(event) ?? [];
      current.push(handler);
      this.handlers.set(event, current);
    }

    emit(event: string, payload: any): void {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(payload);
      }
    }

    connect(): void {}

    disconnect(): void {}
  }

  return {
    client: null as InstanceType<typeof MockWSClient> | null,
    MockWSClient,
  };
});

vi.mock("@wecom/aibot-node-sdk", () => ({
  default: {
    WSClient: sdkMockState.MockWSClient,
  },
  WSClient: sdkMockState.MockWSClient,
  generateReqId: (prefix: string) => `${prefix}-1`,
}));

import { getBotWsPushHandle, unregisterBotWsPushHandle } from "../../runtime.js";
import { BotWsSdkAdapter } from "./sdk-adapter.js";

const waitForAsyncCallbacks = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("BotWsSdkAdapter", () => {
  const unhandledRejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejections.push(reason);
  };

  afterEach(() => {
    process.off("unhandledRejection", onUnhandledRejection);
    unhandledRejections.length = 0;
    unregisterBotWsPushHandle("acc-1");
    sdkMockState.client = null;
  });

  it("contains frame handler rejections instead of leaking unhandled rejections", async () => {
    process.on("unhandledRejection", onUnhandledRejection);

    const runtime = {
      account: {
        accountId: "acc-1",
        bot: {
          wsConfigured: true,
          ws: {
            botId: "bot-1",
            secret: "secret-1",
          },
          config: {},
        },
      },
      handleEvent: vi.fn().mockRejectedValue(new Error("frame exploded")),
      updateTransportSession: vi.fn(),
      touchTransportSession: vi.fn(),
      recordOperationalIssue: vi.fn(),
    };
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    new BotWsSdkAdapter(runtime as any, log as any).start();

    sdkMockState.client?.emit("message", {
      cmd: "aibot_msg_callback",
      headers: { req_id: "req-1" },
      body: {
        msgid: "msg-1",
        msgtype: "text",
        from: { userid: "user-1" },
        text: { content: "hello" },
      },
    });

    await waitForAsyncCallbacks();

    expect(runtime.handleEvent).toHaveBeenCalledTimes(1);
    expect(runtime.recordOperationalIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: "bot-ws",
        category: "runtime-error",
        messageId: "msg-1",
        error: "frame exploded",
      }),
    );
    expect(runtime.touchTransportSession).toHaveBeenCalledWith(
      "bot-ws",
      expect.objectContaining({
        lastError: "frame exploded",
      }),
    );
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "frame handler failed account=acc-1 reqId=req-1 message=frame exploded",
      ),
    );
    expect(unhandledRejections).toHaveLength(0);
  });

  it("falls back to legacy markdown for active push when markdown_v2 is rejected", async () => {
    const runtime = {
      account: {
        accountId: "acc-1",
        bot: {
          wsConfigured: true,
          ws: {
            botId: "bot-1",
            secret: "secret-1",
          },
          config: {},
        },
      },
      handleEvent: vi.fn(),
      updateTransportSession: vi.fn(),
      touchTransportSession: vi.fn(),
      recordOperationalIssue: vi.fn(),
    };
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    new BotWsSdkAdapter(runtime as any, log as any).start();

    sdkMockState.client?.sendMessage
      .mockRejectedValueOnce(new Error("unsupported markdown_v2"))
      .mockResolvedValueOnce(undefined);

    const handle = getBotWsPushHandle("acc-1");
    expect(handle).toBeDefined();

    await handle?.sendMarkdown("user-1", "hello");

    expect(sdkMockState.client?.sendMessage).toHaveBeenCalledTimes(2);
    expect(sdkMockState.client?.sendMessage).toHaveBeenNthCalledWith(1, "user-1", {
      msgtype: "markdown_v2",
      markdown_v2: { content: "hello" },
    });
    expect(sdkMockState.client?.sendMessage).toHaveBeenNthCalledWith(2, "user-1", {
      msgtype: "markdown",
      markdown: { content: "hello" },
    });
  });
});
