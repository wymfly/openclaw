import { describe, expect, it, vi } from "vitest";
import { dispatchRuntimeReply } from "./reply-orchestrator.js";

describe("dispatchRuntimeReply", () => {
  it("enables block streaming for bot-ws replies", async () => {
    const dispatchReplyWithBufferedBlockDispatcher = vi.fn().mockResolvedValue(undefined);
    const core = {
      channel: {
        reply: {
          dispatchReplyWithBufferedBlockDispatcher,
        },
      },
    } as any;

    await dispatchRuntimeReply({
      core,
      cfg: {} as any,
      session: { ctx: { SessionKey: "session-a" } } as any,
      replyHandle: {
        context: {
          transport: "bot-ws",
          accountId: "default",
          raw: { transport: "bot-ws", envelopeType: "ws", body: {} },
        },
        deliver: vi.fn(),
      } as any,
    });

    expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        replyOptions: expect.objectContaining({
          disableBlockStreaming: false,
        }),
      }),
    );
  });
});
