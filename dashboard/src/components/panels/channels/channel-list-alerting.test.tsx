// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const table: Record<string, Record<string, string>> = {
      channels: {
        title: "Channels",
        noChannels: "No channels",
        "health.down": "Down",
        linked: "Linked",
        error: "Error",
        configured: "Configured",
        unconfigured: "Not Configured",
        accounts: "Accounts",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

let ChannelList: typeof import("./ChannelList").ChannelList;
let useChannelsStore: typeof import("@/stores/channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelList } = await import("./ChannelList"));
  ({ useChannelsStore } = await import("@/stores/channels"));

  useChannelsStore.setState({
    channels: new Map([
      [
        "telegram",
        {
          id: "telegram",
          label: "Telegram",
          accounts: [
            {
              accountId: "main",
              enabled: true,
              configured: true,
              linked: false,
              connected: false,
              lastError: "Token invalid",
            },
          ],
        },
      ],
    ]),
    channelOrder: ["telegram"],
    selectedId: null,
    loading: false,
    error: null,
    throughput: new Map(),
    throughputWindow: "1h",
    channelConfig: null,
    channelConfigSaveError: null,
    channelSchemas: new Map(),
    probeResults: new Map(),
    probing: new Set(),
    channelHealthMap: new Map([
      ["telegram", { status: "down", error: "Gateway disconnected", lastCheckedAt: Date.now() }],
    ]),
    updateChannelHealth: vi.fn(),
    fetchChannels: vi.fn(async () => {}),
    selectChannel: vi.fn(),
    updateChannelConfig: vi.fn(async () => true),
    logoutChannel: vi.fn(async () => true),
    fetchThroughput: vi.fn(),
    setThroughputWindow: vi.fn(),
    fetchChannelConfig: vi.fn(async () => {}),
    saveChannelConfig: vi.fn(async () => true),
    fetchChannelSchemas: vi.fn(async () => {}),
    probeChannel: vi.fn(async () => {}),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelList current-state label", () => {
  it("uses live health status text when channelHealthMap is present", () => {
    render(<ChannelList />);
    expect(screen.getByText("Down")).toBeTruthy();
  });
});
