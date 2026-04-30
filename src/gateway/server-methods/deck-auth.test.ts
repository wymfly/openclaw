import { describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    models: { providers: { anthropic: {} } },
    agents: { defaults: { model: "anthropic/claude-sonnet-4-20250514" } },
  })),
  readConfigFileSnapshotForWrite: vi.fn(),
  resolveConfigSnapshotHash: vi.fn(),
  writeConfigFile: vi.fn(),
}));

vi.mock("../../config/sessions.js", () => ({
  loadSessionStore: vi.fn(() => ({})),
}));

vi.mock("../../config/sessions/paths.js", () => ({
  resolveSessionTranscriptsDirForAgent: vi.fn(() => "/tmp/test-transcripts"),
  resolveStorePath: vi.fn(() => "/tmp/test-sessions"),
}));

vi.mock("../../config/paths.js", () => ({
  resolveStateDir: vi.fn(() => "/tmp/test-state"),
}));

vi.mock("../../infra/json-file.js", () => ({
  loadJsonFile: vi.fn(() => undefined),
}));

vi.mock("../../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(() => "/tmp/test-agent-dir"),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentEntries: vi.fn(() => []),
  listAgentIds: vi.fn(() => []),
  resolveAgentConfig: vi.fn(() => ({})),
  resolveDefaultAgentId: vi.fn(() => "main"),
  resolveAgentSkillsFilter: vi.fn(() => undefined),
  resolveAgentWorkspaceDir: vi.fn(() => "/tmp/test-workspace"),
}));

vi.mock("../../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: vi.fn(() => ({ commands: [] })),
}));

vi.mock("../../agents/workspace.js", () => ({
  DEFAULT_AGENTS_FILENAME: "AGENTS.md",
  DEFAULT_BOOTSTRAP_FILENAME: "bootstrap.md",
  DEFAULT_HEARTBEAT_FILENAME: "heartbeat.md",
  DEFAULT_IDENTITY_FILENAME: "identity.md",
  DEFAULT_SOUL_FILENAME: "soul.md",
  DEFAULT_TOOLS_FILENAME: "tools.md",
  DEFAULT_USER_FILENAME: "user.md",
  loadWorkspaceBootstrapFiles: vi.fn(() => ({})),
}));

vi.mock("../../agents/auth-profiles.js", () => ({
  ensureAuthProfileStore: vi.fn(() => ({
    profiles: {
      "anthropic-default": { provider: "anthropic", type: "api_key" },
    },
    order: {},
  })),
  listProfilesForProvider: vi.fn(() => ["anthropic-default"]),
  resolveProfileUnusableUntilForDisplay: vi.fn(() => undefined),
}));

vi.mock("../../agents/model-auth.js", () => ({
  resolveEnvApiKey: vi.fn(() => null),
}));

vi.mock("../../agents/model-selection.js", () => ({
  buildConfiguredModelCatalog: vi.fn(() => []),
  parseModelRef: vi.fn((raw: string) => {
    if (!raw) {
      return null;
    }
    const parts = raw.split("/");
    if (parts.length >= 2) {
      return { provider: parts[0], model: parts[1] };
    }
    return { provider: "anthropic", model: raw };
  }),
}));

vi.mock("../../agents/auth-diagnostics.js", () => ({
  buildAuthOverview: vi.fn(async () => ({
    providers: [
      {
        provider: "anthropic",
        status: "ready",
        auth: { type: "api_key", source: "store", profileId: "anthropic-default" },
      },
    ],
  })),
}));

vi.mock("../../commands/models/list.probe.js", () => ({
  runAuthProbes: vi.fn(async () => ({
    startedAt: 1000,
    finishedAt: 1500,
    durationMs: 500,
    totalTargets: 1,
    options: { provider: "anthropic", timeoutMs: 8000, concurrency: 1, maxTokens: 8 },
    results: [
      {
        provider: "anthropic",
        model: "anthropic/claude-sonnet-4-20250514",
        profileId: "anthropic-default",
        label: "default",
        source: "profile",
        status: "ok",
        latencyMs: 450,
      },
    ],
  })),
}));

type RespondCall = [boolean, unknown?, { code: number; message: string }?];

async function createInvokeParams(method: string, params: Record<string, unknown>) {
  const respond = vi.fn();
  const { deckAuthHandlers } = await import("./deck-auth.js");
  const handler = deckAuthHandlers[method];
  return {
    respond,
    invoke: async () =>
      await handler({
        params,
        respond: respond as never,
        context: {} as never,
        client: null,
        req: { type: "req" as const, id: "req-1", method },
        isWebchatConnect: () => false,
      }),
  };
}

describe("deck.auth.overview handler", () => {
  it("responds with a provider list from buildAuthOverview", async () => {
    const { respond, invoke } = await createInvokeParams("deck.auth.overview", {});
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as { providers: Array<{ provider: string; status: string }> };
    expect(payload.providers).toHaveLength(1);
    expect(payload.providers[0]?.provider).toBe("anthropic");
    expect(payload.providers[0]?.status).toBe("ready");
    expect(payload.providers[0]).toMatchObject({
      source: "mixed",
      scope: "agent:main",
      configPresent: true,
      authPresent: true,
      editable: true,
    });
  });
});

describe("deck.auth.probe handler", () => {
  it("rejects when provider param is missing", async () => {
    const { respond, invoke } = await createInvokeParams("deck.auth.probe", {});
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain("missing required param: provider");
  });

  it("rejects when provider param is empty string", async () => {
    const { respond, invoke } = await createInvokeParams("deck.auth.probe", { provider: "  " });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
  });

  it("returns probe result with status and latencyMs", async () => {
    const { respond, invoke } = await createInvokeParams("deck.auth.probe", {
      provider: "anthropic",
    });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as {
      provider: string;
      status: string;
      latencyMs?: number;
    };
    expect(payload.provider).toBe("anthropic");
    expect(payload.status).toBe("ok");
    expect(payload.latencyMs).toBe(450);
  });

  it("uses default timeoutMs and maxTokens when not provided", async () => {
    const { runAuthProbes } = await import("../../commands/models/list.probe.js");
    vi.mocked(runAuthProbes).mockClear();

    const { invoke } = await createInvokeParams("deck.auth.probe", {
      provider: "anthropic",
    });
    await invoke();

    expect(runAuthProbes).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          timeoutMs: 8_000,
          maxTokens: 8,
          concurrency: 1,
        }),
      }),
    );
  });

  it("respects custom timeoutMs and maxTokens", async () => {
    const { runAuthProbes } = await import("../../commands/models/list.probe.js");
    vi.mocked(runAuthProbes).mockClear();

    const { invoke } = await createInvokeParams("deck.auth.probe", {
      provider: "anthropic",
      timeoutMs: 15_000,
      maxTokens: 16,
    });
    await invoke();

    expect(runAuthProbes).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          timeoutMs: 15_000,
          maxTokens: 16,
        }),
      }),
    );
  });
});
