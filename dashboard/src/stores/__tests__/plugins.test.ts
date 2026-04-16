import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePluginsStore } from "../plugins";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
  usePluginsStore.setState({
    loading: false,
    error: null,
    scope: "channel",
    plugins: [],
    selectedId: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("plugins inventory store", () => {
  it("fetches the default channel-capable inventory scope", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: "channel",
        plugins: [
          {
            id: "wecom",
            name: "WeCom",
            origin: "bundled",
            status: "loaded",
            enabled: true,
            configPath: "plugins.entries.wecom.config",
            capabilityKinds: ["channel"],
            channelIds: ["wecom"],
            providerIds: [],
            toolNames: [],
            diagnostics: [],
          },
        ],
      }),
    });

    await usePluginsStore.getState().fetchPlugins();

    expect(mockFetch).toHaveBeenCalledWith("/api/deck/plugins");
    expect(usePluginsStore.getState().scope).toBe("channel");
    expect(usePluginsStore.getState().plugins[0]).toMatchObject({
      id: "wecom",
      origin: "bundled",
    });
  });

  it("sets an error when inventory fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Gateway unavailable" }),
    });

    await usePluginsStore.getState().fetchPlugins();

    expect(usePluginsStore.getState().error).toBe("Gateway unavailable");
  });
});
