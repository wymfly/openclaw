// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeState: Record<string, unknown> = {};
const useChannelsStoreMock = ((selector?: (state: Record<string, unknown>) => unknown) =>
  selector ? selector(storeState) : storeState) as ((
  selector?: (state: Record<string, unknown>) => unknown,
) => unknown) & {
  setState: (next: Record<string, unknown>) => void;
};
useChannelsStoreMock.setState = (next) => {
  for (const key of Object.keys(storeState)) {
    delete storeState[key];
  }
  Object.assign(storeState, next);
};

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const table: Record<string, Record<string, string>> = {
      common: { cancel: "Cancel" },
      channels: {
        unconfigured: "Not configured",
        noChannels: "No channels",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

vi.mock("../../../stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("./ChannelSettingsTab", () => ({
  ChannelSettingsTab: ({ channelId }: { channelId: string }) => (
    <div>{`Settings:${channelId}`}</div>
  ),
}));

let ChannelDetail: typeof import("./ChannelDetail").ChannelDetail;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelDetail } = await import("./ChannelDetail"));
  useChannelsStoreMock.setState({
    channels: new Map(),
    channelOrder: ["telegram"],
    selectedId: "telegram",
    loading: false,
    error: null,
    throughput: new Map(),
    throughputWindow: "1h",
    channelConfig: null,
    channelConfigSaveError: null,
    channelSchemas: new Map([
      [
        "telegram",
        {
          configPath: "channels.telegram",
          schema: { type: "object", properties: { token: { type: "string" } } },
        },
      ],
    ]),
    probeResults: new Map(),
    probing: new Set(),
    channelHealthMap: new Map(),
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
    pendingAccessTarget: null,
    setPendingAccessTarget: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelDetail schema-only channel", () => {
  it("renders the schema-only settings path instead of the empty-state message", () => {
    render(<ChannelDetail channelId="telegram" />);

    expect(screen.getByText("telegram")).toBeTruthy();
    expect(screen.getByText("Not configured")).toBeTruthy();
    expect(screen.getByText("Settings:telegram")).toBeTruthy();
    expect(screen.queryByText("No channels")).toBeNull();
  });
});
