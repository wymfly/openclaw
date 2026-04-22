// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    (
      ({
        "channels.weixinWizard.title": "Connect Weixin",
        "channels.weixinWizard.stepIntro": "Plugin Status",
        "channels.weixinWizard.stepLogin": "Login Command",
        "channels.weixinWizard.stepStatus": "Status Confirmation",
        "channels.weixinWizard.intro":
          "Use the shared onboarding shell for the installed Weixin plugin instead of a bespoke heavy wizard.",
        "channels.weixinWizard.pluginVisible":
          "The channel is visible to Deck and can be configured through this guided login flow.",
        "channels.weixinWizard.pluginHidden":
          "If the channel is not yet visible, ensure the plugin is installed and enabled before login.",
        "channels.weixinWizard.loginDesc":
          "Run the channel login command in your local shell, then return here and refresh status.",
        "channels.weixinWizard.copyCommand": "Copy Login Command",
        "channels.weixinWizard.statusDesc":
          "After login completes, refresh status to confirm the channel is connected.",
        "channels.weixinWizard.connected": "Weixin channel connected",
        "channels.weixinWizard.notConnected": "Still not connected",
        "channels.weixinWizard.statusUnknown": "Connection status not checked yet",
        "channels.weixinWizard.refreshStatus": "Refresh Status",
        "common.copied": "Copied",
        "common.loading": "Loading",
      }) as Record<string, string>
    )[namespace ? `${namespace}.${key}` : key] ?? key,
}));

vi.mock("../ConfigWizard", () => ({
  ConfigWizard: ({
    title,
    steps,
  }: {
    title: string;
    steps: Array<{ title: string; validate?: () => boolean | Promise<boolean> }>;
  }) => {
    const [validationResult, setValidationResult] = useState("idle");
    const runValidation = async () => {
      const valid = await steps[2]?.validate?.();
      setValidationResult(valid ? "pass" : "fail");
    };

    return (
      <div>
        <div>{title}</div>
        <div>{steps.map((step) => step.title).join(" | ")}</div>
        <button type="button" onClick={() => void runValidation()}>
          Run Status Validation
        </button>
        <div>{validationResult}</div>
      </div>
    );
  },
}));

let OpenClawWeixinWizard: typeof import("../OpenClawWeixinWizard").OpenClawWeixinWizard;
let useChannelsStore: typeof import("@/stores/channels").useChannelsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ OpenClawWeixinWizard } = await import("../OpenClawWeixinWizard"));
  ({ useChannelsStore } = await import("@/stores/channels"));

  const fetchChannels = vi.fn(async () => {
    useChannelsStore.setState((state) => {
      const nextChannels = new Map(state.channels);
      nextChannels.set("openclaw-weixin", {
        id: "openclaw-weixin",
        label: "openclaw-weixin",
        accounts: [{ accountId: "default", linked: true, connected: true }],
      });
      return { channels: nextChannels };
    });
  });

  useChannelsStore.setState({
    channels: new Map(),
    channelOrder: ["openclaw-weixin"],
    selectedId: "openclaw-weixin",
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
    fetchChannels,
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

describe("OpenClawWeixinWizard", () => {
  it("uses the status step validation to refresh channel state and pass when connection appears", async () => {
    render(createElement(OpenClawWeixinWizard, { open: true, onOpenChange: () => {} }));

    fireEvent.click(screen.getByRole("button", { name: "Run Status Validation" }));

    await waitFor(() => {
      expect(screen.getByText("pass")).toBeTruthy();
    });
    expect(useChannelsStore.getState().channels.get("openclaw-weixin")?.accounts[0]?.linked).toBe(
      true,
    );
  });
});
