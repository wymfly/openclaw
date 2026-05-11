import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadOutboundMediaFromUrlMock } = vi.hoisted(() => ({
  loadOutboundMediaFromUrlMock: vi.fn(),
}));

vi.mock("openclaw/plugin-sdk/outbound-media", () => {
  return { loadOutboundMediaFromUrl: loadOutboundMediaFromUrlMock };
});

vi.mock("./transport/agent-api/core.js", () => ({
  sendText: vi.fn(),
  sendMedia: vi.fn(),
  uploadMedia: vi.fn(),
}));

async function getOutboundFns() {
  const { wecomOutbound } = await import("./outbound.js");
  if (!wecomOutbound.sendText || !wecomOutbound.sendMedia) {
    throw new Error("wecomOutbound text/media handlers are required");
  }
  return {
    sendText: wecomOutbound.sendText,
    sendMedia: wecomOutbound.sendMedia,
  };
}

describe("wecomOutbound", () => {
  beforeEach(async () => {
    loadOutboundMediaFromUrlMock.mockReset();
    loadOutboundMediaFromUrlMock.mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      contentType: "image/png",
      fileName: "media.png",
      kind: "image",
    });
    const runtime = await import("./runtime.js");
    runtime.setWecomRuntime({
      channel: {
        text: {
          chunkText: (text: string) => [text],
        },
      },
    } as any);
  });

  afterEach(async () => {
    const runtime = await import("./runtime.js");
    runtime.unregisterBotWsPushHandle("default");
    runtime.unregisterBotWsPushHandle("acct-ws");
    vi.unstubAllGlobals();
  });

  it("does not crash when called with core outbound params", async () => {
    const { sendMedia } = await getOutboundFns();
    await expect(
      sendMedia({
        cfg: {},
        to: "wr-test-chat",
        text: "caption",
        mediaUrl: "https://example.com/media.png",
      } as any),
    ).rejects.toThrow(/requires Agent mode for account=default/i);
  });

  it("throws explicit error when outbound accountId does not exist", async () => {
    const { sendText } = await getOutboundFns();
    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          defaultAccount: "acct-a",
          accounts: {
            "acct-a": {
              enabled: true,
              agent: {
                corpId: "corp-a",
                corpSecret: "secret-a",
                agentId: 10001,
                token: "token-a",
                encodingAESKey: "aes-a",
              },
            },
          },
        },
      },
    };
    await expect(
      sendText({
        cfg,
        accountId: "acct-missing",
        to: "user:zhangsan",
        text: "hello",
      } as any),
    ).rejects.toThrow(/account "acct-missing" not found/i);
  });

  it("routes sendText to agent chatId/userid", async () => {
    const { sendText } = await getOutboundFns();
    const api = await import("./transport/agent-api/core.js");
    const now = vi.spyOn(Date, "now").mockReturnValue(123);
    (api.sendText as any).mockResolvedValue(undefined);

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          agent: {
            corpId: "corp",
            corpSecret: "secret",
            agentId: 1000002,
            token: "token",
            encodingAESKey: "aes",
          },
        },
      },
    };

    // Chat ID (wr/wc) is intentionally NOT supported for Agent outbound.
    await expect(sendText({ cfg, to: "wr123", text: "hello" } as any)).rejects.toThrow(
      /不支持向群 chatId 发送/,
    );
    expect(api.sendText).not.toHaveBeenCalled();

    // Test: User ID (Default)
    const userResult = await sendText({
      cfg,
      to: "userid123",
      text: "hi",
    } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: undefined,
        toUser: "userid123",
        toParty: undefined,
        toTag: undefined,
        text: "hi",
      }),
    );
    expect(userResult.messageId).toBe("agent-123");

    (api.sendText as any).mockClear();

    // Test: User ID explicit
    await sendText({ cfg, to: "user:zhangsan", text: "hi" } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ toUser: "zhangsan", toParty: undefined }),
    );

    (api.sendText as any).mockClear();

    // Test: Party ID (Numeric)
    await sendText({ cfg, to: "1001", text: "hi party" } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ toUser: undefined, toParty: "1001" }),
    );

    (api.sendText as any).mockClear();

    // Test: Party ID Explicit
    await sendText({ cfg, to: "party:2002", text: "hi party 2" } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ toUser: undefined, toParty: "2002" }),
    );

    (api.sendText as any).mockClear();

    // Test: Tag ID Explicit
    await sendText({ cfg, to: "tag:1", text: "hi tag" } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ toUser: undefined, toTag: "1" }),
    );

    now.mockRestore();
  });

  it("suppresses /new ack for bot sessions but not agent sessions", async () => {
    const { sendText } = await getOutboundFns();
    const api = await import("./transport/agent-api/core.js");
    const now = vi.spyOn(Date, "now").mockReturnValue(456);
    (api.sendText as any).mockResolvedValue(undefined);
    (api.sendText as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          agent: {
            corpId: "corp",
            corpSecret: "secret",
            agentId: 1000002,
            token: "token",
            encodingAESKey: "aes",
          },
        },
      },
    };

    const ack = "✅ New session started · model: openai-codex/gpt-5.2";

    // Bot 会话（wecom:...）应抑制，避免私信回执
    const r1 = await sendText({ cfg, to: "wecom:userid123", text: ack } as any);
    expect(api.sendText).not.toHaveBeenCalled();
    expect(r1.messageId).toBe("suppressed-456");

    (api.sendText as any).mockClear();

    // Agent 会话（wecom-agent:...）允许发送回执
    await sendText({ cfg, to: "wecom-agent:userid123", text: ack } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        toUser: "userid123",
        text: "✅ 已开启新会话（模型：openai-codex/gpt-5.2）",
      }),
    );

    now.mockRestore();
  });

  it("prefers Bot WS active push for text when ws is the active bot transport", async () => {
    const { sendText } = await getOutboundFns();
    const runtime = await import("./runtime.js");
    const api = await import("./transport/agent-api/core.js");
    const sendMarkdown = vi.fn().mockResolvedValue(undefined);
    const now = vi.spyOn(Date, "now").mockReturnValue(789);
    runtime.registerBotWsPushHandle("acct-ws", {
      isConnected: () => true,
      sendMarkdown,
    });
    (api.sendText as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          defaultAccount: "acct-ws",
          accounts: {
            "acct-ws": {
              enabled: true,
              bot: {
                primaryTransport: "ws",
                ws: {
                  botId: "bot-1",
                  secret: "secret-1",
                },
              },
              agent: {
                corpId: "corp-ws",
                corpSecret: "agent-secret",
                agentId: 10001,
                token: "token-ws",
                encodingAESKey: "aes-ws",
              },
            },
          },
        },
      },
    };

    const result = await sendText({
      cfg,
      accountId: "acct-ws",
      to: "user:lisi",
      text: "hello ws",
    } as any);

    expect(sendMarkdown).toHaveBeenCalledWith("lisi", "hello ws");
    expect(api.sendText).not.toHaveBeenCalled();
    expect(result.messageId).toBe("bot-ws-789");

    now.mockRestore();
  });

  it("does not silently fall back to Agent when Bot WS active push is configured but unavailable", async () => {
    const { sendText } = await getOutboundFns();
    const api = await import("./transport/agent-api/core.js");
    (api.sendText as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          bot: {
            primaryTransport: "ws",
            ws: {
              botId: "bot-1",
              secret: "secret-1",
            },
          },
          agent: {
            corpId: "corp",
            corpSecret: "secret",
            agentId: 1000002,
            token: "token",
            encodingAESKey: "aes",
          },
        },
      },
    };

    await expect(
      sendText({
        cfg,
        to: "user:zhangsan",
        text: "hello",
      } as any),
    ).rejects.toThrow(/no live ws runtime is registered/i);
    expect(api.sendText).not.toHaveBeenCalled();
  });

  it("keeps outbound media on Agent even when Bot WS is active", async () => {
    const { sendMedia } = await getOutboundFns();
    const runtime = await import("./runtime.js");
    const api = await import("./transport/agent-api/core.js");
    const sendMarkdown = vi.fn().mockResolvedValue(undefined);
    runtime.registerBotWsPushHandle("default", {
      isConnected: () => true,
      sendMarkdown,
    });
    (api.uploadMedia as any).mockResolvedValue("media-1");
    (api.sendMedia as any).mockResolvedValue(undefined);
    (api.sendMedia as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          bot: {
            primaryTransport: "ws",
            ws: {
              botId: "bot-1",
              secret: "secret-1",
            },
          },
          agent: {
            corpId: "corp",
            corpSecret: "secret",
            agentId: 1000002,
            token: "token",
            encodingAESKey: "aes",
          },
        },
      },
    };

    await sendMedia({
      cfg,
      to: "user:zhangsan",
      text: "caption",
      mediaUrl: "https://example.com/media.png",
    } as any);

    expect(api.sendMedia).toHaveBeenCalledTimes(1);
    expect(api.uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "image",
        filename: "media.png",
      }),
    );
    expect(loadOutboundMediaFromUrlMock).toHaveBeenCalledWith(
      "https://example.com/media.png",
      expect.objectContaining({
        maxBytes: 20 * 1024 * 1024,
      }),
    );
    expect(sendMarkdown).not.toHaveBeenCalled();
  });

  it("loads local workspace media through shared outbound media roots", async () => {
    const { sendMedia } = await getOutboundFns();
    const api = await import("./transport/agent-api/core.js");
    const mediaBuffer = Buffer.from("a,b\n1,2\n");
    const readFile = vi.fn(async () => mediaBuffer);
    const workspace = "D:\\openclaw\\data\\.openclaw\\workspace";
    const mediaUrl = `${workspace}\\wecom_doc_test_report_2026-05-07.csv`;
    loadOutboundMediaFromUrlMock.mockResolvedValueOnce({
      buffer: mediaBuffer,
      contentType: undefined,
      fileName: "wecom_doc_test_report_2026-05-07.csv",
      kind: "document",
    });
    (api.uploadMedia as any).mockResolvedValue("media-csv");
    (api.sendMedia as any).mockResolvedValue(undefined);
    (api.uploadMedia as any).mockClear();
    (api.sendMedia as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          agent: {
            corpId: "corp",
            corpSecret: "secret",
            agentId: 1000002,
            token: "token",
            encodingAESKey: "aes",
          },
        },
      },
    };

    await sendMedia({
      cfg,
      to: "user:zhangsan",
      text: "csv report",
      mediaUrl,
      mediaAccess: {
        localRoots: [workspace],
        readFile,
        workspaceDir: workspace,
      },
      mediaLocalRoots: ["D:\\fallback-root"],
      mediaReadFile: readFile,
    } as any);

    expect(loadOutboundMediaFromUrlMock).toHaveBeenCalledWith(mediaUrl, {
      maxBytes: 20 * 1024 * 1024,
      mediaAccess: {
        localRoots: [workspace],
        workspaceDir: workspace,
      },
      mediaLocalRoots: undefined,
    });
    expect(api.uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "file",
        buffer: mediaBuffer,
        filename: "wecom_doc_test_report_2026-05-07.csv",
      }),
    );
    expect(api.sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: "media-csv",
        mediaType: "file",
        toUser: "zhangsan",
      }),
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  it("downgrades oversized image uploads to file media", async () => {
    const { sendMedia } = await getOutboundFns();
    const api = await import("./transport/agent-api/core.js");
    const oversizedImage = Buffer.alloc(10 * 1024 * 1024 + 1);
    loadOutboundMediaFromUrlMock.mockResolvedValueOnce({
      buffer: oversizedImage,
      contentType: "image/png",
      fileName: "large.png",
      kind: "image",
    });
    (api.uploadMedia as any).mockResolvedValue("media-large");
    (api.sendMedia as any).mockResolvedValue(undefined);
    (api.uploadMedia as any).mockClear();
    (api.sendMedia as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          agent: {
            corpId: "corp",
            corpSecret: "secret",
            agentId: 1000002,
            token: "token",
            encodingAESKey: "aes",
          },
        },
      },
    };

    await sendMedia({
      cfg,
      to: "user:zhangsan",
      text: "large image",
      mediaUrl: "https://example.com/large.png",
    } as any);

    expect(api.uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "file",
        buffer: oversizedImage,
        filename: "large.png",
      }),
    );
    expect(api.sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: "media-large",
        mediaType: "file",
      }),
    );
  });

  it("uses account-scoped agent config in matrix mode", async () => {
    const { sendText } = await getOutboundFns();
    const api = await import("./transport/agent-api/core.js");
    (api.sendText as any).mockResolvedValue(undefined);
    (api.sendText as any).mockClear();

    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          defaultAccount: "acct-a",
          accounts: {
            "acct-a": {
              enabled: true,
              agent: {
                corpId: "corp-a",
                corpSecret: "secret-a",
                agentId: 10001,
                token: "token-a",
                encodingAESKey: "aes-a",
              },
            },
            "acct-b": {
              enabled: true,
              agent: {
                corpId: "corp-b",
                corpSecret: "secret-b",
                agentId: 10002,
                token: "token-b",
                encodingAESKey: "aes-b",
              },
            },
          },
        },
      },
    };

    await sendText({
      cfg,
      accountId: "acct-b",
      to: "user:lisi",
      text: "hello b",
    } as any);
    expect(api.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        toUser: "lisi",
        agent: expect.objectContaining({
          accountId: "acct-b",
          agentId: 10002,
          corpId: "corp-b",
        }),
      }),
    );
  });

  it("rejects outbound when target account has matrix conflict", async () => {
    const { sendText } = await getOutboundFns();
    const cfg = {
      channels: {
        wecom: {
          enabled: true,
          defaultAccount: "acct-a",
          accounts: {
            "acct-a": {
              enabled: true,
              agent: {
                corpId: "corp-shared",
                corpSecret: "secret-a",
                agentId: 10001,
                token: "token-a",
                encodingAESKey: "aes-a",
              },
            },
            "acct-b": {
              enabled: true,
              agent: {
                corpId: "corp-shared",
                corpSecret: "secret-b",
                agentId: 10001,
                token: "token-b",
                encodingAESKey: "aes-b",
              },
            },
          },
        },
      },
    };

    await expect(
      sendText({
        cfg,
        accountId: "acct-b",
        to: "user:lisi",
        text: "hello",
      } as any),
    ).rejects.toThrow(/duplicate wecom agent identity/i);
  });
});
