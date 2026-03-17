import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAndSaveMcpConfig, fetchMcpConfig, mcpConfigTestHelpers } from "./mcp-config.js";

/** Minimal WSClient stub that records reply() calls. */
function createFakeClient(
  replyImpl: (
    frame: { headers: { req_id: string } },
    body: Record<string, unknown>,
    cmd: string,
  ) => Promise<unknown>,
) {
  const calls: Array<{
    frame: { headers: { req_id: string } };
    body: Record<string, unknown>;
    cmd: string;
  }> = [];
  return {
    calls,
    reply: async (
      frame: { headers: { req_id: string } },
      body: Record<string, unknown>,
      cmd: string,
    ) => {
      calls.push({ frame, body, cmd });
      return replyImpl(frame, body, cmd);
    },
  };
}

function createLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("fetchMcpConfig", () => {
  it("sends aibot_get_mcp_config with biz_type=doc and returns parsed config", async () => {
    const client = createFakeClient(async () => ({
      errcode: 0,
      body: {
        url: "https://mcp.example.invalid/runtime-doc",
        type: "streamable-http",
        is_authed: true,
      },
    }));

    const result = await fetchMcpConfig(client);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].cmd).toBe("aibot_get_mcp_config");
    expect(client.calls[0].body).toEqual({ biz_type: "doc" });
    expect(client.calls[0].frame.headers.req_id).toMatch(/^mcp_config_/);

    expect(result).toEqual({
      key: "doc",
      type: "streamable-http",
      url: "https://mcp.example.invalid/runtime-doc",
      isAuthed: true,
    });
  });

  it("defaults type to 'streamable-http' when response lacks type field", async () => {
    const client = createFakeClient(async () => ({
      errcode: 0,
      body: {
        url: "https://mcp.example.invalid/runtime-doc",
        is_authed: true,
        // no type field
      },
    }));

    const result = await fetchMcpConfig(client);
    expect(result.type).toBe("streamable-http");
  });

  it("throws on non-zero errcode", async () => {
    const client = createFakeClient(async () => ({
      errcode: 40001,
      errmsg: "invalid token",
      body: {},
    }));

    await expect(fetchMcpConfig(client)).rejects.toThrow("errcode=40001");
  });

  it("throws when response body is missing url", async () => {
    const client = createFakeClient(async () => ({
      errcode: 0,
      body: { is_authed: true },
    }));

    await expect(fetchMcpConfig(client)).rejects.toThrow("missing required 'url' field");
  });

  it("times out after configured timeout", async () => {
    const client = createFakeClient(
      () => new Promise(() => {}), // never resolves
    );

    await expect(fetchMcpConfig(client, 50)).rejects.toThrow(/timed out/i);
  });

  it("resolves transport type from alternate field names", async () => {
    const client = createFakeClient(async () => ({
      errcode: 0,
      body: {
        url: "https://mcp.example.invalid/doc",
        transport_type: "sse",
        is_authed: true,
      },
    }));

    const result = await fetchMcpConfig(client);
    expect(result.type).toBe("sse");
  });
});

describe("fetchAndSaveMcpConfig", () => {
  let tempHome: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "wecom-mcp-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHome;
    mcpConfigTestHelpers.resetWriteQueue();
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(tempHome, { recursive: true, force: true });
  });

  it("fetches config and saves to per-account config path", async () => {
    const client = createFakeClient(async () => ({
      errcode: 0,
      body: {
        url: "https://mcp.example.invalid/runtime-doc",
        is_authed: true,
      },
    }));
    const log = createLog();

    await fetchAndSaveMcpConfig(client, "acct-123", log);

    const configPath = mcpConfigTestHelpers.getConfigPath("acct-123");
    const saved = JSON.parse(await readFile(configPath, "utf8"));

    expect(saved.mcpConfig.doc).toEqual({
      type: "streamable-http",
      url: "https://mcp.example.invalid/runtime-doc",
    });
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("MCP config fetched"));
  });

  it("logs warning for is_authed=false but still saves config", async () => {
    const client = createFakeClient(async () => ({
      errcode: 0,
      body: {
        url: "https://mcp.example.invalid/runtime-doc",
        is_authed: false,
      },
    }));
    const log = createLog();

    await fetchAndSaveMcpConfig(client, "acct-456", log);

    const configPath = mcpConfigTestHelpers.getConfigPath("acct-456");
    const saved = JSON.parse(await readFile(configPath, "utf8"));
    expect(saved.mcpConfig.doc.url).toBe("https://mcp.example.invalid/runtime-doc");
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("not authorized"));
  });

  it("logs error but does not throw when fetch fails", async () => {
    const client = createFakeClient(async () => ({
      errcode: 50001,
      errmsg: "server error",
      body: {},
    }));
    const log = createLog();

    // Should NOT throw
    await fetchAndSaveMcpConfig(client, "acct-789", log);

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("MCP config fetch failed"));
  });

  it("logs error but does not throw on timeout", async () => {
    const client = createFakeClient(
      () => new Promise(() => {}), // never resolves
    );
    const log = createLog();

    // Use short timeout for test
    await fetchAndSaveMcpConfig(client, "acct-timeout", log, 50);

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("MCP config fetch failed"));
  });

  it("isolates config files per account", async () => {
    const client1 = createFakeClient(async () => ({
      errcode: 0,
      body: { url: "https://mcp.example.invalid/a", is_authed: true },
    }));
    const client2 = createFakeClient(async () => ({
      errcode: 0,
      body: { url: "https://mcp.example.invalid/b", is_authed: true },
    }));
    const log = createLog();

    await fetchAndSaveMcpConfig(client1, "acct-a", log);
    await fetchAndSaveMcpConfig(client2, "acct-b", log);

    const savedA = JSON.parse(await readFile(mcpConfigTestHelpers.getConfigPath("acct-a"), "utf8"));
    const savedB = JSON.parse(await readFile(mcpConfigTestHelpers.getConfigPath("acct-b"), "utf8"));
    expect(savedA.mcpConfig.doc.url).toBe("https://mcp.example.invalid/a");
    expect(savedB.mcpConfig.doc.url).toBe("https://mcp.example.invalid/b");
  });
});
