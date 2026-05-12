// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
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
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(DeckIntlProvider, { locale }, createElement(PluginsPanel)),
      ),
    );
  });
}

function buttonByText(text: string | RegExp) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    typeof text === "string" ? button.textContent === text : text.test(button.textContent ?? ""),
  );
}

function rowByText(text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>(".row")).find((row) =>
    row.textContent?.includes(text),
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
        imported: true,
        activated: true,
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
      {
        id: "docs-tools",
        name: "Docs Tools",
        origin: "managed",
        status: "ready",
        enabled: true,
        configPath: "plugins.entries.docs-tools.config",
        capabilityKinds: ["tool"],
        channelIds: [],
        providerIds: ["docs-provider"],
        toolNames: ["docs.search"],
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
        deckActionCapabilities: { qrCodeAuth: true },
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

async function waitForInventory() {
  await waitFor(() => expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"));
  await waitFor(() => expect(container.textContent).toContain("GitHub"));
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

  it("loads plugin inventory into the prototype-shaped list view", async () => {
    renderPanel();
    await waitForInventory();

    expect(container.querySelector(".list-view")).toBeTruthy();
    expect(container.querySelector(".ds-kpi-strip")).toBeTruthy();
    expect(container.querySelector(".toolbar")).toBeTruthy();
    expect(container.querySelector(".row-head")?.textContent).toContain("Plugin");
    expect(container.textContent).toContain("Inventory Scope: workspace");
    expect(container.textContent).toContain("runtime inventory");
    expect(container.textContent).toContain("Channel-capable");
    expect(container.textContent).toContain("Tool-capable");
    expect(rowByText("GitHub")?.className).toContain("row--selected");
    expect(rowByText("Slack")?.textContent).toContain("error");
    expect(rowByText("Docs Tools")?.textContent).toContain("Tool");
  });

  it("filters by search, origin, and capability without mutating loaded inventory", async () => {
    renderPanel();
    await waitForInventory();

    expect(buttonByText("Provider")).toBeUndefined();
    expect(buttonByText("Tool")).toBeTruthy();

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search plugins by id, name, capability, channel, tool..."]',
    );
    expect(search).toBeTruthy();
    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "docs" } });
    });
    expect(container.querySelector(".list")?.textContent).toContain("Docs Tools");
    expect(container.querySelector(".list")?.textContent).not.toContain("GitHub");

    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "" } });
      fireEvent.click(buttonByText("bundled") as HTMLButtonElement);
      fireEvent.click(buttonByText("Channel") as HTMLButtonElement);
    });
    expect(container.querySelector(".list")?.textContent).toContain("GitHub");
    expect(container.querySelector(".list")?.textContent).not.toContain("Slack");
    expect(container.textContent).toContain("runtime inventory");
  });

  it("explains filtered-empty plugin inventory and clears local criteria", async () => {
    renderPanel();
    await waitForInventory();

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search plugins by id, name, capability, channel, tool..."]',
    );
    expect(search).toBeTruthy();

    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "not-a-plugin" } });
    });

    expect(container.textContent).toContain("No plugins match this filter.");
    expect(container.textContent).toContain("Search: not-a-plugin");
    expect(buttonByText("Clear filters")).toBeTruthy();

    await act(async () => {
      fireEvent.click(buttonByText("Clear filters") as HTMLButtonElement);
    });

    expect((search as HTMLInputElement).value).toBe("");
    expect(container.querySelector(".list")?.textContent).toContain("GitHub");
  });

  it("selects navigation targets and exposes prototype detail tabs", async () => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=plugins&pluginId=slack");
    renderPanel();
    await waitFor(() => expect(rowByText("Slack")?.className).toContain("row--selected"));

    await act(async () => {
      fireEvent.click(rowByText("Slack") as HTMLElement);
    });
    expect(container.querySelector(".detail")).toBeTruthy();
    expect(container.textContent).toContain("plugins.entries.slack.config");

    for (const tab of ["Capabilities", "Diagnostics", "Activation", "Manifest", "Audit"]) {
      await act(async () => {
        fireEvent.click(buttonByText(tab) as HTMLButtonElement);
      });
      expect(container.textContent).toContain(tab === "Activation" ? "State chain" : tab);
    }

    await act(async () => {
      fireEvent.click(buttonByText("Plugins") as HTMLButtonElement);
    });
    expect(container.querySelector(".list-view")).toBeTruthy();
  });

  it("switches between channel and all capability inventory modes", async () => {
    renderPanel();
    await waitForInventory();

    await act(async () => {
      fireEvent.click(buttonByText("scope=all") as HTMLButtonElement);
    });

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenLastCalledWith("all"),
    );
    expect(buttonByText("scope=all")?.className).toContain("seg__btn--active");
  });

  it("renders diagnostics and cross-panel handoffs without implying plugin mutation", async () => {
    renderPanel();
    await waitForInventory();

    await act(async () => {
      fireEvent.click(rowByText("GitHub") as HTMLElement);
    });

    expect(container.textContent).toContain("Plugin Config Key");
    expect(container.textContent).toContain("plugins.entries.github.config");
    expect(container.textContent).toContain("Deck Actions");
    expect(container.textContent).toContain("Activation Source");
    expect(container.textContent).toContain("Not visible in Channels: teams");

    await act(async () => {
      fireEvent.click(buttonByText("Diagnostics") as HTMLButtonElement);
    });
    expect(container.textContent).toContain("token missing");
    await act(async () => {
      fireEvent.click(buttonByText(/token missing/) as HTMLButtonElement);
    });
    expect(container.textContent).toContain("Diagnostic detail");
    expect(container.textContent).toContain("Remediation hint");
    await act(async () => {
      fireEvent.click(buttonByText("Close") as HTMLButtonElement);
    });

    await act(async () => {
      fireEvent.click(buttonByText("Overview") as HTMLButtonElement);
    });
    await act(async () => {
      fireEvent.click(buttonByText("Open github") as HTMLButtonElement);
    });
    expect(deckUIMocks.navigateToChannel).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "github",
    });
    expect(container.textContent).toContain("Opened Channels panel; target channel: github");

    await act(async () => {
      fireEvent.click(buttonByText("Open routing for github") as HTMLButtonElement);
    });
    expect(deckUIMocks.navigateToRouting).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "github",
    });

    await act(async () => {
      fireEvent.click(buttonByText("Manifest") as HTMLButtonElement);
    });
    expect(container.textContent).toContain("Manifest preview");
    await act(async () => {
      fireEvent.click(buttonByText("Close") as HTMLButtonElement);
    });
    await act(async () => {
      fireEvent.click(buttonByText("Raw") as HTMLButtonElement);
    });
    expect(container.textContent).toContain("Raw inventory entry");
  });

  it("offers WeCom access handoff for channels with access controls", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    apiMocks.fetchPluginsWithCapability.mockResolvedValue(wecomPluginsPayload());

    renderPanel();
    await waitFor(() => expect(rowByText("WeCom")).toBeTruthy());

    await act(async () => {
      fireEvent.click(rowByText("WeCom") as HTMLElement);
    });
    await act(async () => {
      fireEvent.click(buttonByText("Open access for wecom") as HTMLButtonElement);
    });

    expect(deckUIMocks.navigateToChannelAccess).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "wecom",
    });
    expect(container.textContent).toContain("Opened Channels access controls for wecom");
  });

  it("renders the plugin product flow in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() =>
      expect(apiMocks.fetchPluginsWithCapability).toHaveBeenCalledWith("channel"),
    );
    await waitFor(() => expect(container.textContent).toContain("GitHub"));

    expect(container.textContent).toContain("清单范围");
    expect(container.textContent).toContain("workspace");
    expect(container.textContent).toContain("渠道能力");
    expect(container.textContent).toContain("scope=channel");
    expect(container.textContent).toContain("插件");
    expect(container.textContent).toContain("能力");
  });
});
