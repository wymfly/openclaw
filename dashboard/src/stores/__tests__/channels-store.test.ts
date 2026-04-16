import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  useConfigStore: {
    getState: () => ({
      rawConfig: "",
      baseHash: "base-hash",
      schema: null,
      fetchConfig: vi.fn(async () => {}),
      fetchSchema: vi.fn(async () => {}),
    }),
  },
}));

let useChannelsStore: typeof import("../channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useChannelsStore } = await import("../channels"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("channels store", () => {
  it("clears stale probe results when channels are refreshed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          channelOrder: ["telegram"],
          channelLabels: { telegram: "Telegram" },
          channels: { telegram: {} },
          channelAccounts: {
            telegram: {
              main: {
                accountId: "main",
                enabled: true,
                configured: true,
                linked: true,
                connected: true,
              },
            },
          },
          channelDefaultAccountId: { telegram: "main" },
        }),
      ),
    );

    useChannelsStore.setState({
      probeResults: new Map([
        ["telegram", { status: "failure", error: "stale", probedAt: Date.now() - 10_000 }],
      ]),
    });

    await useChannelsStore.getState().fetchChannels();

    expect(useChannelsStore.getState().probeResults.size).toBe(0);
  });

  it("hydrates plugin-aware metadata from channels.status channelMeta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          channelOrder: ["telegram"],
          channelLabels: { telegram: "Telegram" },
          channelDetailLabels: { telegram: "Telegram Bot" },
          channelSystemImages: { telegram: "paperplane" },
          channelMeta: [
            {
              id: "telegram",
              label: "Telegram",
              detailLabel: "Telegram Bot",
              systemImage: "paperplane",
              pluginId: "telegram",
              pluginOrigin: "bundled",
              pluginNpmSpec: "@openclaw/telegram",
              pluginConfigPath: "plugins.entries.telegram.config",
            },
          ],
          channels: { telegram: {} },
          channelAccounts: {
            telegram: {
              main: {
                accountId: "main",
                enabled: true,
                configured: true,
                linked: true,
                connected: true,
              },
            },
          },
          channelDefaultAccountId: { telegram: "main" },
        }),
      ),
    );

    await useChannelsStore.getState().fetchChannels();

    expect(useChannelsStore.getState().channels.get("telegram")).toMatchObject({
      id: "telegram",
      label: "Telegram",
      detailLabel: "Telegram Bot",
      systemImage: "paperplane",
      pluginId: "telegram",
      pluginOrigin: "bundled",
      pluginNpmSpec: "@openclaw/telegram",
      pluginConfigPath: "plugins.entries.telegram.config",
    });
  });
});
