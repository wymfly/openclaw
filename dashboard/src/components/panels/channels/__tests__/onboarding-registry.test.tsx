// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        configureWizard: "Configure Connection (Wizard)",
        loading: "Loading",
        save: "Save",
        reset: "Reset",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("../WeComWizard", () => ({
  WeComWizard: ({ open }: { open: boolean }) => (open ? <div>WeCom Wizard</div> : null),
}));

vi.mock("../ChannelLegacySettingsPanel", () => ({
  ChannelLegacySettingsPanel: ({
    channelId,
    hideDmPolicy,
  }: {
    channelId: string;
    hideDmPolicy?: boolean;
  }) => <div>{`Legacy Settings ${channelId} hideDmPolicy=${hideDmPolicy ? "yes" : "no"}`}</div>,
}));

vi.mock("../OpenClawWeixinWizard", () => ({
  OpenClawWeixinWizard: ({ open }: { open: boolean }) =>
    open ? <div>Weixin Login Wizard</div> : null,
  OpenClawWeixinStatusPanel: () => <div>Weixin Status Panel</div>,
}));

let ChannelSettingsTab: typeof import("../ChannelSettingsTab").ChannelSettingsTab;
let getChannelOnboardingDescriptor: typeof import("../onboarding-registry").getChannelOnboardingDescriptor;
let useChannelsStore: typeof import("@/stores/channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelSettingsTab } = await import("../ChannelSettingsTab"));
  ({ getChannelOnboardingDescriptor } = await import("../onboarding-registry"));
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

describe("channel onboarding registry", () => {
  it("returns descriptors for wecom and openclaw-weixin", () => {
    expect(getChannelOnboardingDescriptor("wecom")?.kind).toBe("adapter");
    expect(getChannelOnboardingDescriptor("openclaw-weixin")?.kind).toBe("login");
    expect(getChannelOnboardingDescriptor("telegram")).toBeNull();
  });

  it("renders the configured wizard entry for openclaw-weixin", () => {
    render(createElement(ChannelSettingsTab, { channelId: "openclaw-weixin" }));

    expect(screen.getByText("Weixin Status Panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Configure Connection (Wizard)" }));

    expect(screen.getByText("Weixin Login Wizard")).toBeTruthy();
  });

  it("keeps wecom on the adapter path with legacy settings content", () => {
    render(createElement(ChannelSettingsTab, { channelId: "wecom" }));

    expect(screen.queryByText("Weixin Status Panel")).toBeNull();
    expect(screen.getByText("Legacy Settings wecom hideDmPolicy=yes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Configure Connection (Wizard)" })).toBeTruthy();
  });
});
