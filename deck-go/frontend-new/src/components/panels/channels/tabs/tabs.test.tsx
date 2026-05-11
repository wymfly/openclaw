// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../../i18n/provider";
import {
  emptyRoutingFixture,
  emptyThroughputFixture,
  probeSuccessFixture,
  routingFixture,
  telegramDiscordChannelsFixture,
  throughputFixture,
  wecomChannelsFixture,
} from "../__fixtures__/channels.fixture";
import { buildChannelInventory } from "../lib/channel-selectors";
import type { ChannelInventoryItem, ChannelTranslator } from "../types";
import { TabOverview } from "./TabOverview";
import { TabProbe } from "./TabProbe";
import { TabRouting } from "./TabRouting";
import { TabSettings } from "./TabSettings";
import { TabThroughput } from "./TabThroughput";
import { TabWeComAccess } from "./TabWeComAccess";

const apiMocks = vi.hoisted(() => ({
  fetchChannelThroughput: vi.fn(),
  fetchChannels: vi.fn(),
  fetchDeckConfig: vi.fn(),
  fetchRoutingBindings: vi.fn(),
  logoutChannel: vi.fn(),
  patchDeckConfig: vi.fn(),
  patchChannelConfig: vi.fn(),
  testChannel: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToPlugin: vi.fn(),
  navigateToRouting: vi.fn(),
  ui: {
    setActivePanel: vi.fn(),
  },
}));

vi.mock("../../../../api", () => apiMocks);
vi.mock("../../../../deck-ui/panel-navigation", () => ({
  navigateToPlugin: deckUIMocks.navigateToPlugin,
  navigateToRouting: deckUIMocks.navigateToRouting,
}));
vi.mock("../../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

const t: ChannelTranslator = ((key: string, values?: Record<string, unknown>) => {
  if (!values) {
    return key;
  }
  const formatted = Object.entries(values)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(",");
  return `${key}{${formatted}}`;
}) as ChannelTranslator;
(t as { rich?: unknown }).rich = (key: string) => key;
(t as { raw?: unknown }).raw = (key: string) => key;

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: ReturnType<typeof createElement>) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(DeckIntlProvider, { locale: "en" }, node),
      ),
    );
  });
}

function buttonByText(text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function discordItem(): ChannelInventoryItem {
  const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
  return items.find((item) => item.id === "discord")!;
}

function wecomItem(): ChannelInventoryItem {
  const items = buildChannelInventory(wecomChannelsFixture(), t);
  return items[0];
}

describe("channels tabs", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.patchDeckConfig.mockResolvedValue({ ok: true, hash: "config-h2" });
    apiMocks.patchChannelConfig.mockResolvedValue({ ok: true, changed: true });
    apiMocks.fetchDeckConfig.mockResolvedValue({ hash: "config-h1", config: {} });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("TabOverview shows kpi tiles, alerts, and quick links", async () => {
    const channel = discordItem();
    const switchTab = vi.fn();
    const openPlugin = vi.fn();
    await render(
      createElement(TabOverview, {
        channel,
        probeResult: null,
        channelLatencyMs: undefined,
        throughputMessagesIn: 12,
        throughputMessagesOut: 9,
        throughputWindow: "1h",
        pluginId: channel.meta?.pluginId,
        t,
        onOpenPlugin: openPlugin,
        onSwitchTab: switchTab,
      }),
    );
    expect(container.textContent).toContain("inventorySnapshot");
    expect(container.textContent).toContain("messagesInStat");
    expect(container.textContent).toContain("accountAlerts");

    await act(async () => {
      buttonByText("routingBindings")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(switchTab).toHaveBeenCalledWith("routing");

    await act(async () => {
      buttonByText("openChannelPlugin")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(openPlugin).toHaveBeenCalledWith(channel.meta?.pluginId);
  });

  it("TabThroughput switches windows", async () => {
    const fixture = throughputFixture();
    const onWindowChange = vi.fn();
    await render(
      createElement(TabThroughput, {
        buckets: fixture.buckets ?? [],
        messagesIn: fixture.messagesIn ?? 0,
        messagesOut: fixture.messagesOut ?? 0,
        window: "1h",
        t,
        onWindowChange,
      }),
    );
    expect(container.querySelectorAll(".chart__bar").length).toBeGreaterThan(0);
    await act(async () => {
      buttonByText("6h")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onWindowChange).toHaveBeenCalledWith("6h");
  });

  it("TabThroughput renders empty state when buckets are empty", async () => {
    const fixture = emptyThroughputFixture();
    await render(
      createElement(TabThroughput, {
        buckets: fixture.buckets ?? [],
        messagesIn: 0,
        messagesOut: 0,
        window: "1h",
        t,
        onWindowChange: () => undefined,
      }),
    );
    expect(container.textContent).toContain("noThroughputBucketsTitle");
  });

  it("TabProbe runs probe via parent and renders empty/result states", async () => {
    const channel = discordItem();
    const onRunProbe = vi.fn();
    await render(
      createElement(TabProbe, {
        channel,
        probeResult: null,
        actionState: "idle",
        t,
        onRunProbe,
      }),
    );
    expect(container.textContent).toContain("noProbeResultTitle");
    await act(async () => {
      buttonByText("testChannel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRunProbe).toHaveBeenCalled();
  });

  it("TabProbe disables run button while testing", async () => {
    const channel = discordItem();
    await render(
      createElement(TabProbe, {
        channel,
        probeResult: probeSuccessFixture(channel.id),
        actionState: "testing",
        t,
        onRunProbe: () => undefined,
      }),
    );
    const runButton = buttonByText("testingChannel");
    expect(runButton?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("probeSuccess");
  });

  it("TabSettings bridges to ChannelSettingsEditor and toggles", async () => {
    const channel = discordItem();
    const toggle = vi.fn();
    const onSaved = vi.fn(async () => undefined);
    await render(
      createElement(TabSettings, {
        channel,
        actionState: "idle",
        isWecomAccessChannel: false,
        configPatchResult: null,
        t,
        onToggleEnabled: toggle,
        onSettingsSaved: onSaved,
        onAccountPolicySaved: onSaved,
      }),
    );
    expect(container.textContent).toContain("channelSettings");
    expect(buttonByText("disableChannel") || buttonByText("enableChannel")).toBeTruthy();
    await act(async () => {
      const btn = buttonByText("disableChannel") || buttonByText("enableChannel");
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(toggle).toHaveBeenCalled();
  });

  it("TabSettings shows wecom-delegated copy on access channel", async () => {
    const channel = wecomItem();
    await render(
      createElement(TabSettings, {
        channel,
        actionState: "idle",
        isWecomAccessChannel: true,
        configPatchResult: null,
        t,
        onToggleEnabled: () => undefined,
        onSettingsSaved: async () => undefined,
        onAccountPolicySaved: async () => undefined,
      }),
    );
    expect(container.textContent).toContain("wecomSettingsDelegated");
  });

  it("TabRouting renders ready bindings and calls onOpenRouting", async () => {
    const onOpenRouting = vi.fn();
    await render(
      createElement(TabRouting, {
        channelId: "wecom",
        accountId: "default",
        routing: routingFixture(),
        loadState: "ready",
        error: "",
        t,
        onOpenRouting,
      }),
    );
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("wecom");
    await act(async () => {
      buttonByText("openRouting")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenRouting).toHaveBeenCalledWith({ channelId: "wecom", accountId: "default" });
  });

  it("TabRouting renders loading hint and empty state from props", async () => {
    await render(
      createElement(TabRouting, {
        channelId: "discord",
        accountId: "acct_disc_bot",
        routing: null,
        loadState: "loading",
        error: "",
        t,
        onOpenRouting: () => undefined,
      }),
    );
    expect(container.textContent).toContain("routingBindingsLoading");
    expect(container.textContent).toContain("noRoutingBindings");

    await render(
      createElement(TabRouting, {
        channelId: "discord",
        accountId: "acct_disc_bot",
        routing: emptyRoutingFixture(),
        loadState: "ready",
        error: "boom",
        t,
        onOpenRouting: () => undefined,
      }),
    );
    expect(container.textContent).toContain("boom");
    expect(container.textContent).toContain("noRoutingBindings");
  });

  it("TabWeComAccess composes the existing WecomAccessControls smart component", async () => {
    const channel = wecomItem();
    await render(
      createElement(TabWeComAccess, {
        channel,
        accessAccounts: channel.accounts.map((account) => ({
          accountId: account.accountId,
          label: account.accountId,
        })),
        initialAccountId: "tenant-b",
        initialFocus: "access",
        onSaved: async () => undefined,
      }),
    );
    expect(container.textContent).toContain("WeCom access controls");
  });
});
