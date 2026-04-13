// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        "channels.settings.configureWizard": "Configure Connection (Wizard)",
        "channels.weixinWizard.title": "Connect Weixin",
        "channels.weixinWizard.connected": "Weixin channel connected",
        "channels.weixinWizard.notConnected": "Still not connected",
        "channels.weixinWizard.pluginVisible":
          "The channel is visible to Deck and can be configured through this guided login flow.",
        "channels.weixinWizard.pluginHidden":
          "If the channel is not yet visible, ensure the plugin is installed and enabled before login.",
        "common.loading": "Loading",
        "common.save": "Save",
        "common.copied": "Copied",
        "wecom.step1Title": "Transport",
        "wecom.step2Title": "Credentials",
        "wecom.step3Title": "DM Policy",
        "wecom.step4Title": "Callback URL",
        "wecom.step5Title": "Validation",
        "wecom.title": "Configure WeCom",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("../ConfigWizard", () => ({
  ConfigWizard: ({
    title,
    steps,
    open,
  }: {
    title: string;
    steps: Array<{ title: string }>;
    open: boolean;
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{steps.map((step) => step.title).join(" | ")}</div>
      </div>
    ) : null,
}));

let getChannelOnboardingDescriptor: typeof import("../onboarding-registry").getChannelOnboardingDescriptor;
let ChannelSettingsTab: typeof import("../ChannelSettingsTab").ChannelSettingsTab;
let useChannelsStore: typeof import("@/stores/channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ getChannelOnboardingDescriptor } = await import("../onboarding-registry"));
  ({ ChannelSettingsTab } = await import("../ChannelSettingsTab"));
  ({ useChannelsStore } = await import("@/stores/channels"));

  useChannelsStore.setState({
    channels: new Map(),
    channelOrder: ["wecom", "openclaw-weixin"],
    selectedId: "wecom",
    loading: false,
    error: null,
    throughput: new Map(),
    throughputWindow: "1h",
    channelConfig: {},
    channelConfigSaveError: null,
    channelSchemas: new Map([
      [
        "openclaw-weixin",
        {
          configPath: "channels.openclaw-weixin",
          schema: { properties: { fakeField: { type: "string" } } },
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
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("channel onboarding integration", () => {
  it("wecom descriptor injects a multi-step adapter wizard into the shared shell", () => {
    const descriptor = getChannelOnboardingDescriptor("wecom");
    expect(descriptor?.kind).toBe("adapter");

    render(
      descriptor?.renderDialog({
        open: true,
        onOpenChange: () => {},
      }) as ReturnType<typeof createElement>,
    );

    expect(screen.getByText("Configure WeCom")).toBeTruthy();
    expect(
      screen.getByText(/Transport \| Credentials \| DM Policy \| Callback URL \| Validation/),
    ).toBeTruthy();
  });

  it("openclaw-weixin stays login/status oriented even when schema exists", () => {
    render(createElement(ChannelSettingsTab, { channelId: "openclaw-weixin" }));

    expect(screen.getByText("copyCommand")).toBeTruthy();
    expect(screen.getByText("refreshStatus")).toBeTruthy();
    expect(screen.queryByText("fakeField")).toBeNull();
  });
});
