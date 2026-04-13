// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
    const table: Record<string, Record<string, string>> = {
      common: { cancel: "Cancel" },
      channels: {
        tabs: "tabs",
        linked: "Linked",
        error: "Error",
        enabled: "Enabled",
        disabled: "Disabled",
        configured: "Configured",
        unconfigured: "Not Configured",
        accounts: "Accounts",
        noChannels: "No channels",
        logout: "Disconnect",
        confirmLogout: "Disconnect this channel?",
        disable: "Disable",
        enable: "Enable",
        aggregateHealthNote:
          "Channel health is aggregated. Use the account diagnostics below to find the actual failing account.",
        "alerts.title": "Active Alerts",
        "alerts.summary": `${values?.count ?? 0} account alert(s) currently need attention.`,
        "alerts.accountTitle": "Alert",
        "alerts.probeSummary": "The latest channel probe is still failing and needs investigation.",
        "diagnostics.title": "Account Diagnostics",
        "diagnostics.nextStep": "Next step",
        "diagnostics.lastError": "Last error",
        "diagnostics.healthyTitle": "Healthy",
        "diagnostics.healthyDescription": "This account is linked and connected.",
        "diagnostics.healthyNextStep": "No immediate action needed.",
        "diagnostics.configIncompleteTitle": "Configuration incomplete",
        "diagnostics.configIncompleteDescription": "Required channel settings are still missing.",
        "diagnostics.configIncompleteNextStep":
          "Open settings and complete the required configuration fields.",
        "diagnostics.enabledNotLinkedTitle": "Enabled but not linked",
        "diagnostics.enabledNotLinkedDescription":
          "The account is enabled, but the gateway is not linked to it yet.",
        "diagnostics.enabledNotLinkedNextStep":
          "Run probe, then relink or log in again if the account still does not connect.",
        "diagnostics.linkedDisconnectedTitle": "Linked but disconnected",
        "diagnostics.linkedDisconnectedDescription":
          "The account was linked before, but it is not currently connected.",
        "diagnostics.linkedDisconnectedNextStep":
          "Run probe and inspect the last error before reconnecting or logging in again.",
        "diagnostics.accountErrorTitle": "Account error",
        "diagnostics.accountErrorDescription":
          "The gateway reported an account-level error for this channel.",
        "diagnostics.accountErrorNextStep":
          "Review the last error, then run probe or open settings to fix the account.",
        "diagnostics.probeFailureTitle": "Probe failed",
        "diagnostics.probeFailureDescription":
          "The latest connection probe failed for this channel.",
        "diagnostics.probeFailureNextStep":
          "Start with the probe error, then inspect channel settings or relink the account.",
        "diagnostics.disabledTitle": "Disabled",
        "diagnostics.disabledDescription":
          "This account is disabled, so it is not expected to connect.",
        "diagnostics.disabledNextStep":
          "Enable the account only if you want this channel to handle traffic.",
        probe: "probe",
        test: "test",
        settings: "settings",
        analytics: "analytics",
        bindings: "bindings",
        status: "status",
      },
      "channels.probe": {
        title: "Connection Probe",
        testConnection: "Test Connection",
        testing: "Probing...",
        success: "Connected",
        failure: "Connection Failed",
        timeout: "Connection Timeout",
      },
    };
    const scoped = table[ns];
    if (key === "tabs.status") return "Status";
    if (key === "tabs.bindings") return "Bindings";
    if (key === "tabs.settings") return "Settings";
    if (key === "tabs.analytics") return "Analytics";
    if (key === "probe.title") return "Connection Probe";
    if (key === "test.title") return "Test Message";
    return scoped?.[key] ?? key;
  },
}));

vi.mock("./BindingsTab", () => ({ BindingsTab: () => null }));
vi.mock("./ChannelAnalytics", () => ({ ChannelAnalytics: () => null }));
vi.mock("./ChannelSettingsTab", () => ({ ChannelSettingsTab: () => null }));
vi.mock("./ChannelTestTool", () => ({ ChannelTestTool: () => null }));
vi.mock("./AccountConfigDialog", () => ({ AccountConfigDialog: () => null }));

let ChannelDetail: typeof import("./ChannelDetail").ChannelDetail;
let useChannelsStore: typeof import("@/stores/channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelDetail } = await import("./ChannelDetail"));
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
              name: "Main Account",
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
    selectedId: "telegram",
    loading: false,
    error: null,
    throughput: new Map(),
    throughputWindow: "1h",
    channelConfig: null,
    channelConfigSaveError: null,
    channelSchemas: new Map(),
    probeResults: new Map([
      [
        "telegram",
        {
          status: "failure",
          error: "Probe auth failed",
          probedAt: Date.now(),
        },
      ],
    ]),
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

describe("ChannelDetail diagnostics", () => {
  it("renders aggregate note plus account-first diagnostics and next step guidance", () => {
    render(<ChannelDetail channelId="telegram" />);

    expect(screen.getByText("Active Alerts")).toBeTruthy();
    expect(screen.getByText("1 account alert(s) currently need attention.")).toBeTruthy();
    expect(
      screen.getByText("The latest channel probe is still failing and needs investigation."),
    ).toBeTruthy();
    expect(screen.getByText(/Alert · Account error/)).toBeTruthy();
    expect(screen.getByText("Account Diagnostics")).toBeTruthy();
    expect(
      screen.getByText(
        "Channel health is aggregated. Use the account diagnostics below to find the actual failing account.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Account error")).toBeTruthy();
    expect(
      screen.getByText(
        /Review the last error, then run probe or open settings to fix the account\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Last error: Token invalid/)).toBeTruthy();
  });
});
