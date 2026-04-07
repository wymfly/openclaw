import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./transport/agent-api/core.js", () => ({
  getAccessToken: vi.fn(),
}));

describe("probeWecomAccount", () => {
  let probeWecomAccount: typeof import("./channel-probe.js").probeWecomAccount;
  let getAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("./channel-probe.js");
    probeWecomAccount = mod.probeWecomAccount;
    const core = await import("./transport/agent-api/core.js");
    getAccessToken = core.getAccessToken as ReturnType<typeof vi.fn>;
  });

  it("returns ok:true for bot-only WS account", async () => {
    const result = await probeWecomAccount({
      account: {
        accountId: "default",
        enabled: true,
        configured: true,
        config: {} as any,
        agent: undefined,
        bot: { configured: true, primaryTransport: "ws", wsConfigured: true } as any,
      },
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    expect(result.transport).toBe("ws");
  });

  it("returns ok:false when agent API not configured", async () => {
    const result = await probeWecomAccount({
      account: {
        accountId: "default",
        enabled: true,
        configured: true,
        config: {} as any,
        agent: { configured: true, apiConfigured: false } as any,
      },
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it("returns ok:true when getAccessToken succeeds", async () => {
    getAccessToken.mockResolvedValue("test-token-123");
    const result = await probeWecomAccount({
      account: {
        accountId: "default",
        enabled: true,
        configured: true,
        config: {} as any,
        agent: {
          configured: true,
          apiConfigured: true,
          corpId: "corp1",
          corpSecret: "s",
          agentId: 1000,
        } as any,
        bot: undefined,
      },
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    expect(result.agentId).toBe(1000);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok:false on auth failure", async () => {
    getAccessToken.mockRejectedValue(new Error("invalid credentials"));
    const result = await probeWecomAccount({
      account: {
        accountId: "default",
        enabled: true,
        configured: true,
        config: {} as any,
        agent: {
          configured: true,
          apiConfigured: true,
          corpId: "corp1",
          corpSecret: "s",
          agentId: 1,
        } as any,
      },
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid credentials/i);
  });
});
