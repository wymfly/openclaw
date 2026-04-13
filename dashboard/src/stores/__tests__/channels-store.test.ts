import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});
