// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
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

function renderPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(PluginsPanel)));
  });
}

function buttonByText(text: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function cardByText(text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find((card) =>
    card.textContent?.includes(text),
  );
}

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
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    expect(container.textContent).toContain("Inventory ready");
    expect(container.textContent).toContain("Inventory Scope: workspace");
    expect(container.textContent).toContain("Channel plugins");
    expect(container.textContent).toContain("All plugins");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("ready: 1");
    expect(container.textContent).toContain("error: 1");
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).toContain("Slack");
    expect(container.textContent).toContain("channel, tool");
    expect(container.textContent).toContain("github, teams");
    expect(container.querySelector(".deck-ui-control-single.deck-ui-plugins")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-plugins-body")).toHaveLength(1);
    expect(container.querySelectorAll(".deck-ui-plugins-status-row").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(container.querySelector(".deck-ui-plugins-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-actions")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-plugins-button").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".deck-ui-plugins-list")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-plugins-row")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-plugins-detail-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-plugins-diagnostics")).toBeTruthy();

    const selectedCard = cardByText("GitHub");
    expect(selectedCard?.className).toContain("is-selected");
  });

  it("renders selected plugin metadata when the operator changes selection", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    const slackCard = cardByText("Slack");
    expect(slackCard).toBeTruthy();

    await act(async () => {
      slackCard?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(cardByText("Slack")?.className).toContain("is-selected");
    expect(container.textContent).toContain("workspace");
    expect(container.textContent).toContain("error");
    expect(container.textContent).toContain("No");
    expect(container.textContent).toContain("plugins.entries.slack.config");
  });

  it("selects the plugin requested by cross-panel navigation params", async () => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=plugins&pluginId=slack");

    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    await waitFor(() => expect(cardByText("Slack")?.className).toContain("is-selected"));
    expect(container.textContent).toContain("plugins.entries.slack.config");
  });

  it("switches between channel and all capability inventory modes", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    await act(async () => {
      buttonByText("All plugins")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenLastCalledWith("all"),
    );
    expect(buttonByText("All plugins")?.className).toContain("is-primary");
  });

  it("renders plugin capability diagnostics and cross-panel handoffs", async () => {
    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    expect(container.textContent).toContain("Version");
    expect(container.textContent).toContain("1.2.3");
    expect(container.textContent).toContain("Plugin Config Key");
    expect(container.textContent).toContain("plugins.entries.github.config");
    expect(container.textContent).toContain("Deck Actions");
    expect(container.textContent).toContain("login, probe");
    expect(container.textContent).toContain("Activation Source: config");
    expect(container.textContent).toContain("Activation Reason: channel enabled in config");
    expect(container.textContent).toContain("[warn] token missing");
    expect(container.textContent).toContain("Not visible in Channels: teams");
    expect(container.textContent).not.toContain("Open teams");

    await act(async () => {
      buttonByText("Open github")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToChannel).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "github",
    });
    expect(container.textContent).toContain("Opened Channels panel; target channel: github");

    await act(async () => {
      buttonByText("Open routing for github")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(deckUIMocks.navigateToRouting).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "github",
    });
    expect(container.textContent).toContain("Opened Routing panel; target channel: github");
  });

  it("offers WeCom access handoff for channels with access controls", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    apiMocks.fetchPluginsWithCapability.mockResolvedValue(wecomPluginsPayload());

    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    await act(async () => {
      buttonByText("Open access for wecom")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(deckUIMocks.navigateToChannelAccess).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "wecom",
    });
    expect(container.textContent).toContain("Opened Channels access controls for wecom");
  });

  it("renders the migrated plugin inventory shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );

    await waitFor(() => expect(container.textContent).toContain("清单就绪"));
    expect(container.textContent).toContain("清单范围");
    expect(container.textContent).toContain("workspace");
    expect(container.textContent).toContain("渠道插件");
    expect(container.textContent).toContain("全部插件");
    expect(container.textContent).toContain("2 个插件");
  });
});
