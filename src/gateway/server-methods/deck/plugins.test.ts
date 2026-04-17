import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";

const { mockLoadConfig, mockBuildPluginSnapshotReport } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockBuildPluginSnapshotReport: vi.fn(),
}));

vi.mock("../../../config/config.js", () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock("../../../plugins/status.js", () => ({
  buildPluginSnapshotReport: mockBuildPluginSnapshotReport,
}));

import { deckPluginsHandlers } from "./plugins.js";

function callList(
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => resolve({ ok, payload, error });
    void deckPluginsHandlers["deck.plugins.list"]({
      params,
      respond,
      req: { type: "req" as const, id: "1", method: "deck.plugins.list", params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadConfig.mockReturnValue({});
  mockBuildPluginSnapshotReport.mockReturnValue({
    workspaceDir: "/workspace",
    diagnostics: [{ level: "warn", message: "warn a", pluginId: "wecom" }],
    plugins: [
      {
        id: "wecom",
        name: "WeCom",
        version: "1.0.0",
        origin: "bundled",
        enabled: true,
        status: "loaded",
        explicitlyEnabled: true,
        activated: true,
        imported: true,
        activationSource: "config",
        activationReason: "channel enabled in config",
        toolNames: ["message_actions"],
        channelIds: ["wecom"],
        providerIds: [],
        setupWizardSpec: {
          steps: [
            {
              id: "intro",
              type: "info",
              title: "$t:wizard.feishu.step1Title",
              body: "hello",
            },
          ],
          onComplete: {
            action: "channel.feishu.saveConfig",
          },
        },
      },
      {
        id: "openai",
        name: "OpenAI",
        version: "1.0.0",
        origin: "bundled",
        enabled: true,
        status: "loaded",
        toolNames: [],
        channelIds: [],
        providerIds: ["openai"],
      },
    ],
  });
});

describe("deck.plugins.list", () => {
  it("defaults to channel-capable plugins only", async () => {
    const result = await callList({});
    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      scope: "channel",
      plugins: [
        expect.objectContaining({
          id: "wecom",
          configPath: "plugins.entries.wecom.config",
          capabilityKinds: ["channel", "tool"],
          activationSource: "config",
          activationReason: "channel enabled in config",
          channelIds: ["wecom"],
          setupWizardSpec: {
            steps: [
              {
                id: "intro",
                type: "info",
                title: "$t:wizard.feishu.step1Title",
                body: "hello",
              },
            ],
            onComplete: {
              action: "channel.feishu.saveConfig",
            },
          },
          diagnostics: [{ level: "warn", message: "warn a" }],
        }),
      ],
    });
  });

  it("returns all plugins when capability=all", async () => {
    const result = await callList({ capability: "all" });
    expect(result.ok).toBe(true);
    const payload = result.payload as { plugins: Array<{ id: string }> };
    expect(payload.plugins.map((plugin) => plugin.id)).toEqual(["openai", "wecom"]);
  });

  it("rejects invalid params", async () => {
    const result = await callList({ capability: "invalid", unexpected: true });
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: "INVALID_REQUEST" });
  });
});
