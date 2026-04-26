// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("slash command executor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const { useChatStore } = await import("@/stores/chat");
    useChatStore.setState({
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
      activeSessionKey: null,
      activeAgentId: null,
      canvasCommands: [],
    });
  });

  it("removes kill from local slash commands", async () => {
    const { LOCAL_COMMAND_DEFS } = await import("../slash-commands");
    expect(LOCAL_COMMAND_DEFS.map((command) => command.name)).not.toContain("kill");
  });

  it("registers the migrated export command", async () => {
    const { LOCAL_COMMAND_DEFS } = await import("../slash-commands");
    expect(LOCAL_COMMAND_DEFS.map((command) => command.name)).toContain("export");
  });

  it("returns local actions for new and stop commands", async () => {
    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("", "new", "")).resolves.toEqual({
      content: "",
      action: "new-session",
    });
    await expect(executeSlashCommand("sess-1", "stop", "")).resolves.toMatchObject({
      action: "stop",
    });
  });

  it("renders help from the active local command list", async () => {
    const { executeSlashCommand } = await import("../slash-command-executor");

    const result = await executeSlashCommand("sess-1", "help", "");

    expect(result.content).toContain("/new");
    expect(result.content).toContain("/reset");
    expect(result.content).toContain("/export");
    expect(result.content).toContain("/think <off|low|medium|high>");
    expect(result.content).toContain("/sendpolicy <allow|deny>");
    expect(result.content).toContain("/usage");
    expect(result.content).toContain("/agents");
  });

  it("returns an error toast for unknown local commands", async () => {
    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("sess-1", "missing", "")).resolves.toMatchObject({
      content: "",
      toastKey: "toastUnknownCommand",
      toastValue: "missing",
      toastType: "error",
    });
  });

  it("routes registered remote commands through the chat send route", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "started" }), { status: 200 }));
    const { commandRegistry } = await import("@/lib/command-registry");
    const { SOURCE_PRIORITY } = await import("@/lib/command-types");
    const { executeSlashCommand } = await import("../slash-command-executor");

    commandRegistry.register({
      name: "deploy",
      source: "skill",
      execMode: "remote",
      description: "Deploy",
      category: "skills",
      priority: SOURCE_PRIORITY.skill,
    });

    const result = await executeSlashCommand("sess-1", "deploy", "prod");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", message: "/deploy prod" }),
      }),
    );
    expect(result).toMatchObject({
      content: "",
      toastKey: "toastCommandSent",
      toastValue: "deploy",
      toastType: "success",
    });
  });

  it("honors registry priority when remote commands shadow local command names", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "started" }), { status: 200 }));
    const { commandRegistry } = await import("@/lib/command-registry");
    const { SOURCE_PRIORITY } = await import("@/lib/command-types");
    const { executeSlashCommand } = await import("../slash-command-executor");

    commandRegistry.register({
      name: "reset",
      source: "plugin",
      execMode: "remote",
      description: "Plugin reset",
      category: "plugins",
      priority: SOURCE_PRIORITY.plugin,
    });

    const result = await executeSlashCommand("sess-1", "reset", "target");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", message: "/reset target" }),
      }),
    );
    expect(result).toMatchObject({
      toastKey: "toastCommandSent",
      toastValue: "reset",
    });
    expect(result).not.toHaveProperty("action");
  });

  it("reset calls the reset route and reports the migrated success toast", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, key: "sess-1" }), { status: 200 }),
      );

    const { executeSlashCommand } = await import("../slash-command-executor");
    const result = await executeSlashCommand("sess-1", "reset", "");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/reset",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toMatchObject({
      action: "reset",
      toastKey: "toastReset",
      toastType: "success",
    });
  });

  it("clear calls the clear route and reports the migrated info toast", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, key: "sess-1" }), { status: 200 }),
      );

    const { executeSlashCommand } = await import("../slash-command-executor");
    const result = await executeSlashCommand("sess-1", "clear", "");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/clear",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toMatchObject({
      action: "clear",
      toastKey: "toastCleared",
      toastType: "info",
    });
  });

  it("returns failure toasts when reset or clear mutations are rejected", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }));

    const { executeSlashCommand } = await import("../slash-command-executor");

    const reset = await executeSlashCommand("sess-1", "reset", "");
    expect(reset).toMatchObject({
      content: "",
      toastKey: "toastResetFailed",
      toastType: "error",
    });
    expect(reset).not.toHaveProperty("action");

    const clear = await executeSlashCommand("sess-1", "clear", "");
    expect(clear).toMatchObject({
      content: "",
      toastKey: "toastClearFailed",
      toastType: "error",
    });
    expect(clear).not.toHaveProperty("action");
  });

  it("compact calls the compact route and reports the migrated refresh toast", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }));

    const { executeSlashCommand } = await import("../slash-command-executor");
    const result = await executeSlashCommand("sess-1", "compact", "");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/compact",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1" }),
      }),
    );
    expect(result).toMatchObject({
      action: "refresh",
      toastKey: "toastCompacted",
      toastType: "success",
    });
  });

  it("returns the compact failure toast when compaction fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "failed" }), { status: 500 }),
    );

    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("sess-1", "compact", "")).resolves.toMatchObject({
      content: "",
      toastKey: "toastCompactFailed",
      toastType: "error",
    });
  });

  it("patches session config for local model commands", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("sess-1", "think", "high")).resolves.toMatchObject({
      toastKey: "toastThink",
      toastValue: "high",
      toastType: "success",
      configUpdate: { thinkingLevel: "high" },
    });
    await expect(executeSlashCommand("sess-1", "fast", "on")).resolves.toMatchObject({
      configUpdate: { fastMode: true },
    });
    await expect(executeSlashCommand("sess-1", "reasoning", "stream")).resolves.toMatchObject({
      configUpdate: { reasoningLevel: "stream" },
    });
    await expect(executeSlashCommand("sess-1", "sendpolicy", "deny")).resolves.toMatchObject({
      configUpdate: { sendPolicy: "deny" },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/sessions/patch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionKey: "sess-1", thinkingLevel: "high" }),
      }),
    );
  });

  it("distinguishes missing and invalid local model command args", async () => {
    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("sess-1", "think", "")).resolves.toEqual({
      content: "Usage: /think <off|low|medium|high>",
    });
    await expect(executeSlashCommand("sess-1", "think", "huge")).resolves.toEqual({
      content: 'Invalid thinking level "huge". Valid: off, low, medium, high',
    });
    await expect(executeSlashCommand("sess-1", "verbose", "")).resolves.toEqual({
      content: "Usage: /verbose <on|off|full>",
    });
    await expect(executeSlashCommand("sess-1", "verbose", "loud")).resolves.toEqual({
      content: 'Invalid verbose level "loud". Valid: on, off, full',
    });
    await expect(executeSlashCommand("sess-1", "fast", "maybe")).resolves.toEqual({
      content: 'Invalid fast mode "maybe". Valid: status, on, off',
    });
    await expect(executeSlashCommand("sess-1", "reasoning", "")).resolves.toEqual({
      content: "Usage: /reasoning <off|on|stream>",
    });
    await expect(executeSlashCommand("sess-1", "reasoning", "deep")).resolves.toEqual({
      content: 'Invalid reasoning level "deep". Valid: off, on, stream',
    });
    await expect(executeSlashCommand("sess-1", "sendpolicy", "")).resolves.toEqual({
      content: "Usage: /sendpolicy <allow|deny>",
    });
    await expect(executeSlashCommand("sess-1", "sendpolicy", "maybe")).resolves.toEqual({
      content: 'Invalid send policy "maybe". Valid: allow, deny',
    });
  });

  it("renders model, fast mode, and usage from the active sessions route", async () => {
    const sessionsBody = JSON.stringify({
      sessions: [
        {
          key: "sess-1",
          model: "gpt-5.4",
          fastMode: true,
          inputTokens: 1200,
          outputTokens: 34,
          totalTokens: 1234,
          estimatedCostUsd: 0.12,
        },
      ],
    });
    const configuredModelsBody = JSON.stringify({
      runtimeId: "rt_local",
      payload: {
        models: [
          { id: "gpt-5.4" },
          { model: "sonnet-4.6" },
          { modelIdentifier: "local/qwen" },
          { name: "fallback-name" },
        ],
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "/api/v1/runtimes/rt_local/models/configured") {
        return new Response(configuredModelsBody, { status: 200 });
      }
      return new Response(sessionsBody, { status: 200 });
    });

    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("sess-1", "model", "")).resolves.toEqual({
      content: "Current model: gpt-5.4\nAvailable: gpt-5.4, sonnet-4.6, local/qwen, fallback-name",
    });
    await expect(executeSlashCommand("sess-1", "fast", "")).resolves.toEqual({
      content: "Fast mode: on",
    });
    await expect(executeSlashCommand("sess-1", "usage", "")).resolves.toEqual({
      content:
        "Input: 1,200 tokens\nOutput: 34 tokens\nTotal: 1,234 tokens\nModel: gpt-5.4\nCost: $0.1200",
    });
    expect(fetchSpy).toHaveBeenCalledWith("/api/sessions", expect.any(Object));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/runtimes/rt_local/models/configured",
      expect.any(Object),
    );
  });

  it("lists agents through the current agents route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          defaultId: "main",
          agents: [
            { id: "main", name: "Main Agent" },
            { id: "ops", name: "Ops Agent" },
          ],
        }),
        { status: 200 },
      ),
    );

    const { executeSlashCommand } = await import("../slash-command-executor");

    await expect(executeSlashCommand("sess-1", "agents", "")).resolves.toEqual({
      content: "Main Agent (default)\nOps Agent",
    });
    expect(fetchSpy).toHaveBeenCalledWith("/api/agents", expect.any(Object));
  });

  it("exports the active session as markdown", async () => {
    const createObjectURL = vi.fn(() => "blob:session-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi.fn();
    const createElement = vi.spyOn(document, "createElement");
    createElement.mockImplementation((tagName: string) => {
      const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
      if (tagName === "a") {
        Object.defineProperty(element, "click", { value: click });
      }
      return element;
    });

    const { useChatStore } = await import("@/stores/chat");
    useChatStore.setState({
      sessions: new Map([
        [
          "sess/1",
          {
            messages: [
              {
                id: "msg-1",
                role: "assistant",
                content: [
                  { type: "text", text: "Exported answer" },
                  { type: "tool_use", id: "tool-1", name: "read_file", input: { path: "a.ts" } },
                  { type: "tool_result", toolUseId: "tool-1", content: "file content" },
                ],
                timestamp: 123,
              },
            ],
            isStreaming: false,
            status: "done",
            streamingRunId: null,
            error: null,
            toolProgress: {},
            activeApproval: null,
            runMetadata: {},
            a2uiState: null,
            lastAccessedAt: Date.now(),
          },
        ],
      ]),
    });

    const { buildSessionMarkdown } = await import("../export-session");
    expect(buildSessionMarkdown("sess/1")).toContain("Exported answer");
    expect(buildSessionMarkdown("sess/1")).toContain("### Tool: read_file");
    expect(buildSessionMarkdown("sess/1")).toContain("file content");

    const { executeSlashCommand } = await import("../slash-command-executor");
    const result = await executeSlashCommand("sess/1", "export", "");

    expect(result).toMatchObject({
      action: "export",
      toastKey: "toastExported",
      toastType: "success",
    });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:session-export");
  });
});
