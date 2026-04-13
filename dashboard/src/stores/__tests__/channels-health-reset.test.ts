import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let useChannelsStore: typeof import("../channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useChannelsStore } = await import("../channels"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("channels store current-state reset", () => {
  it("clears stale health and probe snapshots on fetchChannels refresh", async () => {
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
        ["telegram", { status: "failure", error: "stale probe", probedAt: Date.now() - 10_000 }],
      ]),
      channelHealthMap: new Map([
        ["telegram", { status: "down", error: "stale health", lastCheckedAt: Date.now() - 10_000 }],
      ]),
    });

    await useChannelsStore.getState().fetchChannels();

    expect(useChannelsStore.getState().probeResults.size).toBe(0);
    expect(useChannelsStore.getState().channelHealthMap.size).toBe(0);
  });
});
