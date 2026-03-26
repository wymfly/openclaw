import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the dependencies
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../../agents/model-selection.js", () => ({
  buildAllowedModelSet: vi.fn(),
  buildConfiguredModelCatalog: vi.fn(),
}));
vi.mock("../../agents/auth-diagnostics.js", () => ({
  buildAuthOverview: vi.fn(),
}));
vi.mock("../../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(() => "/tmp/test-agent"),
}));
vi.mock("../../agents/defaults.js", () => ({
  DEFAULT_PROVIDER: "anthropic",
}));

describe("models.configured", () => {
  let modelsHandlers: Record<string, Function>;
  let loadConfig: ReturnType<typeof vi.fn>;
  let buildConfiguredModelCatalog: ReturnType<typeof vi.fn>;
  let buildAuthOverview: ReturnType<typeof vi.fn>;

  const dummyReq = { id: "1", method: "models.configured", params: {} } as never;

  beforeEach(async () => {
    const configMod = await import("../../config/config.js");
    loadConfig = configMod.loadConfig as unknown as ReturnType<typeof vi.fn>;

    const selectionMod = await import("../../agents/model-selection.js");
    buildConfiguredModelCatalog = selectionMod.buildConfiguredModelCatalog as unknown as ReturnType<
      typeof vi.fn
    >;

    const authMod = await import("../../agents/auth-diagnostics.js");
    buildAuthOverview = authMod.buildAuthOverview as unknown as ReturnType<typeof vi.fn>;

    // Re-import handlers after mocks are set up
    const mod = await import("./models.js");
    modelsHandlers = mod.modelsHandlers;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns configured models with auth status and merged cost data", async () => {
    const cfg = {
      models: {
        providers: {
          deepseek: {
            apiKey: "sk-xxx",
            models: [{ id: "deepseek-chat", name: "DeepSeek Chat" }],
          },
        },
      },
    };
    loadConfig.mockReturnValue(cfg);
    buildConfiguredModelCatalog.mockReturnValue([
      { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
    ]);
    buildAuthOverview.mockResolvedValue({
      providers: [
        { provider: "deepseek", status: "ready", auth: { type: "api_key", source: "config" } },
      ],
    });

    const mockContext = {
      loadGatewayModelCatalog: vi.fn().mockResolvedValue([
        {
          id: "deepseek-chat",
          name: "DeepSeek Chat",
          provider: "deepseek",
          cost: { input: 0.14, output: 0.28, cacheRead: 0, cacheWrite: 0 },
          maxTokens: 8192,
        },
      ]),
    };
    const respond = vi.fn();
    await modelsHandlers["models.configured"]({
      req: dummyReq,
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: mockContext as never,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        models: [
          expect.objectContaining({
            id: "deepseek-chat",
            provider: "deepseek",
            authStatus: "ready",
            cost: expect.objectContaining({ input: 0.14, output: 0.28 }),
            maxTokens: 8192,
          }),
        ],
      }),
      undefined,
    );
  });

  it("returns empty array when no providers configured", async () => {
    loadConfig.mockReturnValue({});
    buildConfiguredModelCatalog.mockReturnValue([]);
    buildAuthOverview.mockResolvedValue({ providers: [] });

    const mockContext = { loadGatewayModelCatalog: vi.fn().mockResolvedValue([]) };
    const respond = vi.fn();
    await modelsHandlers["models.configured"]({
      req: dummyReq,
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: mockContext as never,
    });

    expect(respond).toHaveBeenCalledWith(true, { models: [] }, undefined);
  });

  it("marks models with missing auth as 'missing'", async () => {
    const cfg = {
      models: {
        providers: {
          openai: { models: [{ id: "gpt-5.4", name: "GPT 5.4" }] },
        },
      },
    };
    loadConfig.mockReturnValue(cfg);
    buildConfiguredModelCatalog.mockReturnValue([
      { id: "gpt-5.4", name: "GPT 5.4", provider: "openai" },
    ]);
    buildAuthOverview.mockResolvedValue({
      providers: [{ provider: "openai", status: "missing", auth: null }],
    });

    const mockContext = {
      loadGatewayModelCatalog: vi
        .fn()
        .mockResolvedValue([{ id: "gpt-5.4", name: "GPT 5.4", provider: "openai" }]),
    };
    const respond = vi.fn();
    await modelsHandlers["models.configured"]({
      req: dummyReq,
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: mockContext as never,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        models: [
          expect.objectContaining({
            id: "gpt-5.4",
            authStatus: "missing",
          }),
        ],
      }),
      undefined,
    );
  });
});
