import { describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import { deckAuthHandlers } from "./deck-auth.js";

vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    models: { providers: { anthropic: {} } },
    agents: { defaults: { model: "anthropic/claude-sonnet-4-20250514" } },
  })),
}));

vi.mock("../../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(() => "/tmp/test-agent-dir"),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: vi.fn(() => "main"),
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

function createInvokeParams(method: string, params: Record<string, unknown>) {
  const respond = vi.fn();
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
    const { respond, invoke } = createInvokeParams("deck.auth.overview", {});
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(true);
    const payload = call?.[1] as { providers: Array<{ provider: string; status: string }> };
    expect(payload.providers).toHaveLength(1);
    expect(payload.providers[0]?.provider).toBe("anthropic");
    expect(payload.providers[0]?.status).toBe("ready");
  });
});

describe("deck.auth.probe handler", () => {
  it("rejects when provider param is missing", async () => {
    const { respond, invoke } = createInvokeParams("deck.auth.probe", {});
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
    expect(call?.[2]?.message).toContain("missing required param: provider");
  });

  it("rejects when provider param is empty string", async () => {
    const { respond, invoke } = createInvokeParams("deck.auth.probe", { provider: "  " });
    await invoke();

    const call = respond.mock.calls[0] as RespondCall | undefined;
    expect(call?.[0]).toBe(false);
    expect(call?.[2]?.code).toBe(ErrorCodes.INVALID_REQUEST);
  });

  it("returns probe result with status and latencyMs", async () => {
    const { respond, invoke } = createInvokeParams("deck.auth.probe", {
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

    const { invoke } = createInvokeParams("deck.auth.probe", {
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

    const { invoke } = createInvokeParams("deck.auth.probe", {
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
