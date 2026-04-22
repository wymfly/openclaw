import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
// @vitest-environment jsdom
import React, { createContext, useContext } from "react";
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

const TabsContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
}>({
  value: "status",
  onValueChange: () => {},
});

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
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
        "permissionSummary.title": "Permission Summary",
        "permissionSummary.botAllowlistEmpty": `${values?.account}: bot allowlist mode is enabled but allowFrom is empty.`,
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
        "access.title": "WeCom Access Controls",
        "access.description":
          "Manage who can use this channel, how direct messages are authorized, and how dynamic agents behave.",
      },
      "channels.wecomShell": {
        sectionLabel: "WeCom Pages",
        overview: "Overview",
        onboarding: "Onboarding",
        access: "Access",
        overviewTitle: "WeCom Overview",
        overviewDescription: "Overview description",
        onboardingTitle: "WeCom Onboarding",
        onboardingDescription: "Onboarding description",
        onboardingConnected: `${values?.count ?? 0} connected account(s) detected.`,
        onboardingNotConnected: "No connected WeCom accounts detected yet.",
        openWizard: "Open Setup Wizard",
      },
      wizard: {
        "wecom.accessTabHint":
          "Detailed permission controls live in the Access tab after setup completes.",
      },
      "channels.access": {
        title: "WeCom Access Controls",
        description:
          "Manage who can use this channel, how direct messages are authorized, and how dynamic agents behave.",
      },
      "channels.bindingsTab": {
        summaryTitle: "Routing Scope Summary",
        summaryBindings: `Bindings in scope: ${values?.count ?? ""}`,
        openRouting: "View all routing rules",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

vi.mock("../../../stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

const { navigateToPlugin, navigateToRouting } = vi.hoisted(() => ({
  navigateToPlugin: vi.fn(),
  navigateToRouting: vi.fn(),
}));

vi.mock("@/stores/deck-routing", () => ({
  useDeckRoutingStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      bindings: [],
      fetchBindings: vi.fn(async () => {}),
    }),
}));

vi.mock("../../../lib/panel-navigation", () => ({
  navigateToPlugin,
  navigateToRouting,
}));

vi.mock("../../ui/tabs", () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => {
    const ctx = useContext(TabsContext);
    return (
      <button type="button" onClick={() => ctx.onValueChange(value)}>
        {children}
      </button>
    );
  },
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => {
    const ctx = useContext(TabsContext);
    return ctx.value === value ? <div>{children}</div> : null;
  },
}));

vi.mock("./BindingsTab", () => ({ BindingsTab: () => <div>Bindings Host</div> }));
vi.mock("./ChannelAnalytics", () => ({ ChannelAnalytics: () => <div>Analytics Host</div> }));
vi.mock("./ChannelHealthBadge", () => ({ ChannelHealthBadge: () => null }));
vi.mock("./ChannelProbeStatus", () => ({ ChannelProbeStatus: () => <div>Probe Host</div> }));
vi.mock("./ChannelSettingsTab", () => ({ ChannelSettingsTab: () => <div>Settings Host</div> }));
vi.mock("./ChannelTestTool", () => ({ ChannelTestTool: () => <div>Test Host</div> }));
vi.mock("./AccountConfigDialog", () => ({ AccountConfigDialog: () => null }));
vi.mock("./CapabilityActionBar", () => ({ CapabilityActionBar: () => null }));
vi.mock("./WeComWizard", () => ({
  WeComWizard: ({ open }: { open: boolean }) => (open ? <div>WeCom Wizard Modal</div> : null),
}));
vi.mock("./ChannelAccessTab", () => ({
  ChannelAccessTab: ({ selectedAccountId }: { selectedAccountId?: string }) => (
    <div>{`Access Host:${selectedAccountId ?? "none"}`}</div>
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

describe("ChannelDetail WeCom page shell", () => {
  it("renders a WeCom-only secondary nav and hosts onboarding inside legacy status", async () => {
    render(<ChannelDetail channelId="wecom" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    });
    const shellNav = screen.getByTestId("wecom-shell-nav");
    expect(within(shellNav).getByRole("button", { name: "Onboarding" })).toBeTruthy();
    expect(within(shellNav).getByRole("button", { name: "Access", pressed: false })).toBeTruthy();
    expect(within(shellNav).queryByRole("button", { name: "Settings" })).toBeNull();
    expect(within(shellNav).queryByRole("button", { name: "Bindings" })).toBeNull();
    expect(within(shellNav).queryByRole("button", { name: "Analytics" })).toBeNull();
    expect(within(shellNav).queryByRole("button", { name: "Diagnostics" })).toBeNull();
    expect(within(shellNav).queryByRole("button", { name: "Capabilities" })).toBeNull();
    expect(screen.getByRole("button", { name: "Bindings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analytics" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Plugin" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View all routing rules" })).toBeTruthy();

    fireEvent.click(within(shellNav).getByRole("button", { name: "Onboarding", pressed: false }));

    expect(screen.getByRole("heading", { name: "WeCom Onboarding" })).toBeTruthy();
    expect(screen.getByText("Open Setup Wizard")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Status" }));

    expect(screen.getByRole("heading", { name: "WeCom Overview" })).toBeTruthy();
    expect(screen.queryByText("WeCom Onboarding")).toBeNull();
  });

  it("routes Open Access from the overview summary into the Access shell", async () => {
    render(<ChannelDetail channelId="wecom" />);

    await waitFor(() => {
      expect(screen.getByText("Permission Summary")).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText("Open Access")[0]);

    expect(screen.getByRole("button", { name: "Access", pressed: true })).toBeTruthy();
    expect(screen.getByText("Access Host:default")).toBeTruthy();
  });

  it("keeps routing as a summary/deep-link instead of a page-shell entry", async () => {
    render(<ChannelDetail channelId="wecom" />);

    await waitFor(() => {
      expect(screen.getByText("Routing Scope Summary")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "View all routing rules" }));

    expect(navigateToRouting).toHaveBeenCalledWith({
      channelId: "wecom",
      accountId: "default",
    });
  });
});
