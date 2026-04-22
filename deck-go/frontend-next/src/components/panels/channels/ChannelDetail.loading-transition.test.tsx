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
        "pluginInfo.open": "Open Plugin",
        "pluginInfo.unavailable": "Not available in Deck yet",
        "access.manage": "Manage Access",
        "diagnostics.title": "Diagnostics",
        aggregateHealthNote: "Aggregate note",
      },
      "channels.wecomShell": {
        sectionLabel: "WeCom Pages",
        overview: "Overview",
        onboarding: "Onboarding",
        access: "Access",
        overviewTitle: "WeCom Overview",
        overviewDescription: "Overview description",
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
vi.mock("./CapabilityActionBar", () => ({ CapabilityActionBar: () => null }));
vi.mock("./ChannelAccessTab", () => ({ ChannelAccessTab: () => null }));
vi.mock("./WecomPageShellNav", () => ({
  WecomPageShellNav: () => <div>WeCom Pages</div>,
}));
vi.mock("./WecomOverviewPage", () => ({
  WecomOverviewPage: () => <div>WeCom Overview</div>,
}));
vi.mock("./WecomOnboardingPage", () => ({
  WecomOnboardingPage: () => <div>WeCom Onboarding</div>,
}));
vi.mock("./WecomAccessPage", () => ({
  WecomAccessPage: () => <div>WeCom Access</div>,
}));

let ChannelDetail: typeof import("./ChannelDetail").ChannelDetail;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelDetail } = await import("./ChannelDetail"));
  useChannelsStoreMock.setState({
    channels: new Map(),
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
    pendingAccessTarget: null,
    setPendingAccessTarget: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelDetail loading transition", () => {
  it("stays mounted safely when the selected channel appears after an initial empty render", () => {
    const { rerender } = render(<ChannelDetail channelId="wecom" />);

    expect(screen.getByText("loading")).toBeTruthy();

    useChannelsStoreMock.setState({
      ...storeState,
      channels: new Map([
        [
          "wecom",
          {
            id: "wecom",
            label: "WeCom",
            pluginId: "wecom",
            accounts: [{ accountId: "default", linked: true, connected: true }],
            defaultAccountId: "default",
          },
        ],
      ]),
    });

    rerender(<ChannelDetail channelId="wecom" />);

    expect(screen.getByText("WeCom")).toBeTruthy();
    expect(screen.getByText("WeCom Pages")).toBeTruthy();
    expect(screen.getAllByText("WeCom Overview").length).toBeGreaterThan(0);
  });
});
