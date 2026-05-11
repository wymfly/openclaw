import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { handleAgentWebhook } from "./handler.js";

vi.mock("../transport/agent-api/client.js", () => ({
  downloadAgentApiMedia: vi.fn(),
  sendAgentApiText: vi.fn().mockResolvedValue(undefined),
}));

function createRequest(): IncomingMessage {
  const req = new IncomingMessage(new Socket());
  req.method = "POST";
  req.url = "/plugins/wecom/agent/default?msg_signature=sig&timestamp=1&nonce=2";
  return req;
}

function createResponse(): ServerResponse & { data: string } {
  const res = new ServerResponse(new IncomingMessage(new Socket())) as ServerResponse & {
    data: string;
  };
  res.data = "";
  const appendChunk = (chunk: string | Uint8Array) => {
    res.data += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  };
  res.write = ((chunk: string | Uint8Array) => {
    appendChunk(chunk);
    return true;
  }) as typeof res.write;
  res.end = ((chunk?: string | Uint8Array) => {
    if (chunk !== undefined) {
      appendChunk(chunk);
    }
    return res;
  }) as typeof res.end;
  return res;
}

describe("handleAgentWebhook reply dispatch", () => {
  it("keeps agent callback replies final-only to avoid fragmented WeCom markdown", async () => {
    const dispatchReplyWithBufferedBlockDispatcher = vi.fn().mockResolvedValue(undefined);
    const recordInboundSession = vi.fn().mockResolvedValue(undefined);
    const core = {
      channel: {
        routing: {
          resolveAgentRoute: () => ({
            agentId: "main",
            sessionKey: "agent:main:wecom:default:dm:alice",
            accountId: "default",
            matchedBy: "binding",
          }),
        },
        commands: {
          shouldComputeCommandAuthorized: () => false,
          resolveCommandAuthorizedFromAuthorizers: () => true,
        },
        session: {
          resolveStorePath: () => "store/path",
          readSessionUpdatedAt: () => 0,
          recordInboundSession,
        },
        reply: {
          formatAgentEnvelope: ({ body }: { body: string }) => body,
          finalizeInboundContext: (ctx: unknown) => ctx,
          resolveEnvelopeFormatOptions: () => ({}),
          dispatchReplyWithBufferedBlockDispatcher,
        },
      },
    } as any;

    await handleAgentWebhook({
      req: createRequest(),
      res: createResponse(),
      verifiedPost: {
        timestamp: "1",
        nonce: "2",
        signature: "sig",
        encrypted: "encrypted",
        decrypted: "<xml />",
        parsed: {
          MsgType: "text",
          FromUserName: "alice",
          ToUserName: "corp",
          Content: "测试",
          MsgId: `msg-${Date.now()}`,
          AgentID: 10001,
        },
      },
      agent: {
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
      },
      config: {} as any,
      core,
    });

    await vi.waitFor(() => expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalled());
    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        replyOptions: expect.objectContaining({
          disableBlockStreaming: true,
        }),
      }),
    );
  });
});
