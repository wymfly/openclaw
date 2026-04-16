// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
        "tabs.status": "Status",
        "tabs.access": "Access",
        "tabs.bindings": "Bindings",
        "tabs.settings": "Settings",
        "tabs.analytics": "Analytics",
        linked: "Linked",
        error: "Error",
        enabled: "Enabled",
        disabled: "Disabled",
        configured: "Configured",
        unconfigured: "Not configured",
        accounts: "Accounts",
        noChannels: "No channels",
        logout: "Disconnect",
        confirmLogout: "Disconnect this channel?",
        disable: "Disable",
        enable: "Enable",
        "probe.title": "Connection Probe",
        "test.title": "Connection Check",
        "pluginInfo.label": "Plugin",
        "pluginInfo.origin": "Origin",
        "pluginInfo.configPath": "Plugin Config Key",
        "pluginInfo.unavailable": "Not available in Deck yet",
        "access.manage": "Manage Access",
        "diagnostics.title": "Diagnostics",
        aggregateHealthNote: "Aggregate note",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

vi.mock("../../../stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("../../ui/tabs", () => ({
  Tabs: ({ children }: { children: unknown }) => children,
  TabsList: ({ children }: { children: unknown }) => children,
  TabsTrigger: ({ children }: { children: unknown }) => children,
  TabsContent: ({ children }: { children: unknown }) => children,
}));

vi.mock("./BindingsTab", () => ({ BindingsTab: () => null }));
vi.mock("./ChannelAnalytics", () => ({ ChannelAnalytics: () => null }));
vi.mock("./ChannelHealthBadge", () => ({ ChannelHealthBadge: () => null }));
vi.mock("./ChannelProbeStatus", () => ({ ChannelProbeStatus: () => null }));
vi.mock("./ChannelSettingsTab", () => ({ ChannelSettingsTab: () => null }));
vi.mock("./ChannelTestTool", () => ({ ChannelTestTool: () => null }));
vi.mock("./AccountConfigDialog", () => ({ AccountConfigDialog: () => null }));
vi.mock("./ChannelAccessTab", () => ({
  ChannelAccessTab: ({ selectedAccountId }: { selectedAccountId?: string }) => (
    <div>access-selected:{selectedAccountId ?? "none"}</div>
  ),
}));

let ChannelDetail: typeof import("./ChannelDetail").ChannelDetail;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelDetail } = await import("./ChannelDetail"));
  useChannelsStoreMock.setState({
    channels: new Map([
      [
        "wecom",
        {
          id: "wecom",
          label: "WeCom",
          pluginId: "wecom",
          accounts: [
            {
              accountId: "default",
              name: "Default",
              enabled: true,
              configured: true,
              linked: true,
              connected: true,
            },
            {
              accountId: "tenant-b",
              name: "Tenant B",
              enabled: true,
              configured: true,
              linked: true,
              connected: true,
            },
          ],
          defaultAccountId: "default",
        },
      ],
    ]),
    channelOrder: ["wecom"],
    selectedId: "wecom",
    loading: false,
    error: null,
    throughput: new Map(),
    throughputWindow: "1h",
    channelConfig: null,
    channelConfigSaveError: null,
    channelSchemas: new Map(),
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
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelDetail access handoff", () => {
  it("passes the clicked account into the Access tab handoff for WeCom", () => {
    render(<ChannelDetail channelId="wecom" />);

    const buttons = screen.getAllByText("Manage Access");
    fireEvent.click(buttons[1]);

    expect(screen.getByText("access-selected:tenant-b")).toBeTruthy();
  });

  it("preserves the selected account after channel refreshes", () => {
    const { rerender } = render(<ChannelDetail channelId="wecom" />);

    const buttons = screen.getAllByText("Manage Access");
    fireEvent.click(buttons[1]);
    expect(screen.getByText("access-selected:tenant-b")).toBeTruthy();

    useChannelsStoreMock.setState({
      ...storeState,
      channels: new Map([
        [
          "wecom",
          {
            id: "wecom",
            label: "WeCom",
            pluginId: "wecom",
            accounts: [
              {
                accountId: "default",
                name: "Default",
                enabled: true,
                configured: true,
                linked: true,
                connected: true,
              },
              {
                accountId: "tenant-b",
                name: "Tenant B",
                enabled: true,
                configured: true,
                linked: true,
                connected: true,
              },
            ],
            defaultAccountId: "default",
          },
        ],
      ]),
    });

    rerender(<ChannelDetail channelId="wecom" />);
    expect(screen.getByText("access-selected:tenant-b")).toBeTruthy();
  });
});
