// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
    const tables: Record<string, Record<string, string>> = {
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
        "permissionSummary.title": "Permission Summary",
        "permissionSummary.botAllowlistEmpty": `${values?.account}: bot allowlist mode is enabled but allowFrom is empty.`,
        "permissionSummary.agentAllowlistEmpty": `${values?.account}: agent allowlist mode is enabled but allowFrom is empty.`,
        "permissionSummary.dynamicAgentsMissingAdmins":
          "Dynamic agents are enabled but no admin users are configured.",
        "permissionSummary.dynamicAgentsMissingRouting":
          "Dynamic agents are enabled but no routing bindings are configured.",
        "permissionSummary.botPolicy": `Bot: ${values?.policy} · allowFrom ${values?.count}`,
        "permissionSummary.agentPolicy": `Agent: ${values?.policy} · allowFrom ${values?.count}`,
        "permissionSummary.allowFromPreview": `allowFrom: ${values?.preview ?? ""}${values?.extra ?? ""}`,
        "permissionSummary.allowFromEmpty": "allowFrom: none",
        "permissionSummary.dynamicAgents": `Dynamic agents: ${values?.enabled} · admins ${values?.admins}`,
        "permissionSummary.routing": `Routing: ${values?.mode}`,
        "permissionSummary.openAccess": "Open Access",
        "permissionSummary.enabled": "enabled",
        "permissionSummary.disabled": "disabled",
        "permissionSummary.failClosed": "reject unmatched",
        "permissionSummary.fallback": "fallback to default route",
        "settings.dmPolicy.allowlist": "Allowlist",
        "settings.dmPolicy.open": "Open",
        "diagnostics.title": "Diagnostics",
        aggregateHealthNote: "Aggregate note",
      },
    };
    return tables[ns]?.[key] ?? key;
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
vi.mock("./ChannelAccessTab", () => ({ ChannelAccessTab: () => null }));

let ChannelDetail: typeof import("./ChannelDetail").ChannelDetail;
let fetchChannelConfigMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelDetail } = await import("./ChannelDetail"));
  fetchChannelConfigMock = vi.fn(async () => {});
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
    channelConfig: {
      bot: { dm: { policy: "allowlist", allowFrom: [] } },
      agent: { dm: { policy: "open", allowFrom: ["user-a"] } },
      dynamicAgents: { enabled: true, adminUsers: [] },
      routing: { failClosedOnDefaultRoute: true },
    },
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
    fetchChannelConfig: fetchChannelConfigMock,
    saveChannelConfig: vi.fn(async () => true),
    fetchChannelSchemas: vi.fn(async () => {}),
    probeChannel: vi.fn(async () => {}),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelDetail permission summary", () => {
  it("renders WeCom permission summary cards and config alerts in the status view", async () => {
    render(<ChannelDetail channelId="wecom" />);

    await waitFor(() => {
      expect(screen.getByText("Permission Summary")).toBeTruthy();
    });
    expect(
      screen.getByText("default: bot allowlist mode is enabled but allowFrom is empty."),
    ).toBeTruthy();
    expect(
      screen.getByText("Dynamic agents are enabled but no admin users are configured."),
    ).toBeTruthy();
    expect(screen.getByText("Bot: Allowlist · allowFrom 0")).toBeTruthy();
    expect(screen.getByText("allowFrom: none")).toBeTruthy();
    expect(screen.getByText("Agent: Open · allowFrom 1")).toBeTruthy();
    expect(screen.getByText("allowFrom: user-a")).toBeTruthy();
    expect(screen.getByText("Dynamic agents: enabled · admins 0")).toBeTruthy();
    expect(screen.getByText("Routing: reject unmatched")).toBeTruthy();
    expect(screen.getAllByText("Open Access").length).toBeGreaterThan(0);
  });

  it("waits for WeCom config loading before rendering permission summaries", async () => {
    let resolveFetch: (() => void) | null = null;
    fetchChannelConfigMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = () => {
            useChannelsStoreMock.setState({
              ...storeState,
              channelConfig: {
                bot: { dm: { policy: "allowlist", allowFrom: [] } },
                agent: { dm: { policy: "open", allowFrom: ["user-a"] } },
                dynamicAgents: { enabled: true, adminUsers: [] },
                routing: { failClosedOnDefaultRoute: true },
              },
            });
            resolve();
          };
        }),
    );
    useChannelsStoreMock.setState({
      ...storeState,
      channelConfig: null,
    });

    render(<ChannelDetail channelId="wecom" />);

    expect(screen.queryByText("Permission Summary")).toBeNull();
    expect(
      screen.queryByText("default: bot allowlist mode is enabled but allowFrom is empty."),
    ).toBeNull();

    resolveFetch?.();

    await waitFor(() => {
      expect(screen.getByText("Permission Summary")).toBeTruthy();
    });
  });

  it("ignores stale shared channelConfig until WeCom config finishes loading", async () => {
    let resolveFetch: (() => void) | null = null;
    fetchChannelConfigMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = () => {
            useChannelsStoreMock.setState({
              ...storeState,
              channelConfig: {
                bot: { dm: { policy: "allowlist", allowFrom: [] } },
                agent: { dm: { policy: "open", allowFrom: ["user-a"] } },
                dynamicAgents: { enabled: true, adminUsers: [] },
                routing: { failClosedOnDefaultRoute: true },
              },
            });
            resolve();
          };
        }),
    );
    useChannelsStoreMock.setState({
      ...storeState,
      channelConfig: {
        token: "not-wecom",
      },
    });

    render(<ChannelDetail channelId="wecom" />);

    expect(screen.queryByText("Permission Summary")).toBeNull();
    expect(screen.queryByText("Bot: Allowlist · allowFrom 0")).toBeNull();
    expect(fetchChannelConfigMock).toHaveBeenCalledWith("wecom");

    resolveFetch?.();

    await waitFor(() => {
      expect(screen.getByText("Permission Summary")).toBeTruthy();
    });
  });
});
