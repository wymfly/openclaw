// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PluginsPanel } from "./PluginsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchChannels: vi.fn(),
  fetchPluginsWithCapability: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToChannel: vi.fn(),
  navigateToChannelAccess: vi.fn(),
  navigateToRouting: vi.fn(),
  ui: {
    setActivePanel: vi.fn(),
  },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToChannel: deckUIMocks.navigateToChannel,
  navigateToChannelAccess: deckUIMocks.navigateToChannelAccess,
  navigateToRouting: deckUIMocks.navigateToRouting,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;

function pluginsPayload() {
  return {
    scope: "workspace",
    plugins: [
      {
        id: "github",
        name: "GitHub",
        origin: "bundled",
        status: "ready",
        enabled: true,
        version: "1.2.3",
        activationSource: "config",
        activationReason: "channel enabled in config",
        configPath: "plugins.entries.github.config",
        capabilityKinds: ["channel", "tool"],
        channelIds: ["github", "teams"],
        providerIds: ["github-provider"],
        toolNames: ["issues.search"],
        deckActionCapabilities: { login: true, probe: true },
        diagnostics: [{ level: "warn", message: "token missing" }],
      },
      {
        id: "slack",
        name: "Slack",
        origin: "workspace",
        status: "error",
        enabled: false,
        configPath: "plugins.entries.slack.config",
        capabilityKinds: ["channel"],
        channelIds: ["slack"],
        providerIds: [],
        toolNames: [],
        diagnostics: [],
      },
    ],
  };
}

function channelsPayload() {
  return {
    channelOrder: ["github"],
    channels: {
      github: { status: "ready" },
    },
  };
}

function wecomPluginsPayload() {
  return {
    scope: "workspace",
    plugins: [
      {
        id: "wecom",
        name: "WeCom",
        origin: "bundled",
        status: "ready",
        enabled: true,
        configPath: "plugins.entries.wecom.config",
        capabilityKinds: ["channel"],
        channelIds: ["wecom"],
        providerIds: [],
        toolNames: [],
        diagnostics: [],
      },
    ],
  };
}

function wecomChannelsPayload() {
  return {
    channelOrder: ["wecom"],
    channels: {
      wecom: { status: "ready" },
    },
    channelMeta: [
      {
        id: "wecom",
        pluginId: "wecom",
      },
    ],
  };
}

describe("PluginsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchChannels.mockResolvedValue(channelsPayload());
    apiMocks.fetchPluginsWithCapability.mockResolvedValue(pluginsPayload());
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    window.history.replaceState({}, "", "/");
    vi.clearAllMocks();
  });

  it("loads plugin inventory and selects the first plugin by default", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PluginsPanel));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    expect(container.textContent).toContain("Inventory ready");
    expect(container.textContent).toContain("scope: workspace");
    expect(container.textContent).toContain("capability: channel");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("ready: 1");
    expect(container.textContent).toContain("error: 1");
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).toContain("Slack");
    expect(container.textContent).toContain("capabilities: channel, tool");
    expect(container.textContent).toContain("channels: github, teams");
    expect(container.querySelector(".deck-ui-plugins")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-plugins-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-plugins-body")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-plugins-status-row").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(container.querySelector(".deck-ui-plugins-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-actions")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-plugins-button").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".deck-ui-plugins-list")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-plugins-row")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-plugins-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-detail-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-diagnostics")).toBeTruthy();

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("GitHub");
  });

  it("renders selected plugin metadata when the operator changes selection", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PluginsPanel));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    const slackButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Slack"),
    );
    expect(slackButton).toBeTruthy();

    await act(async () => {
      slackButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Slack");
    expect(container.textContent).toContain("origin workspace");
    expect(container.textContent).toContain("status error");
    expect(container.textContent).toContain("enabled: no");
    expect(container.textContent).toContain("plugins.entries.slack.config");
  });

  it("selects the plugin requested by cross-panel navigation params", async () => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=plugins&pluginId=slack");

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PluginsPanel));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Slack");
    expect(container.textContent).toContain("plugins.entries.slack.config");
  });

  it("switches between channel and all capability inventory modes", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PluginsPanel));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "All plugins")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenLastCalledWith("all"),
    );
    expect(container.textContent).toContain("capability: all");
  });

  it("renders plugin capability diagnostics and cross-panel handoffs", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PluginsPanel));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    expect(container.textContent).toContain("version");
    expect(container.textContent).toContain("1.2.3");
    expect(container.textContent).toContain("config path");
    expect(container.textContent).toContain("plugins.entries.github.config");
    expect(container.textContent).toContain("deck actions");
    expect(container.textContent).toContain("login, probe");
    expect(container.textContent).toContain("source: config");
    expect(container.textContent).toContain("channel enabled in config");
    expect(container.textContent).toContain("[warn] token missing");
    expect(container.textContent).toContain("Not visible in Channels: teams");
    expect(container.textContent).not.toContain("Open channel teams");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open channel github")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToChannel).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "github",
    });
    expect(container.textContent).toContain("Opened Channels panel; target channel: github");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open routing for github")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToRouting).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "github",
    });
    expect(container.textContent).toContain("Opened Routing panel; target channel: github");
  });

  it("offers WeCom access handoff for channels with access controls", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    apiMocks.fetchPluginsWithCapability.mockResolvedValue(wecomPluginsPayload());

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(PluginsPanel));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open access for wecom")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToChannelAccess).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "wecom",
    });
    expect(container.textContent).toContain("Opened Channels access controls for wecom");
  });
});
