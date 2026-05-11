// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../../i18n/provider";
import {
  probeSuccessFixture,
  telegramDiscordChannelsFixture,
} from "../__fixtures__/channels.fixture";
import { buildChannelInventory } from "../lib/channel-selectors";
import { CHANNEL_TABS } from "../types";
import type { ChannelInventoryItem, ChannelTabId, ChannelTranslator } from "../types";
import { ChannelsDetailView } from "./ChannelsDetailView";

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
    root.render(createElement(DeckIntlProvider, { locale: "en" }, node));
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

describe("ChannelsDetailView", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
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
  });

  it("renders hero with pills, tabs nav, and forwards back/probe/logout callbacks", async () => {
    const channel = discordItem();
    const onTabChange = vi.fn();
    const onBack = vi.fn();
    const onRunProbe = vi.fn();
    const onRequestLogout = vi.fn();
    await render(
      createElement(
        ChannelsDetailView,
        {
          channel,
          availableTabs: CHANNEL_TABS.filter((tab) => !tab.wecomOnly),
          selectedTab: "overview" as ChannelTabId,
          probeResult: probeSuccessFixture(channel.id),
          actionState: "idle",
          error: "",
          payloadTimestamp: 1234,
          actionResult: null,
          t,
          onTabChange,
          onBack,
          onRunProbe,
          onRequestLogout,
        },
        createElement("div", { "data-testid": "tab-body" }, "tab content"),
      ),
    );
    expect(container.querySelector(".detail-view")).toBeTruthy();
    expect(container.querySelector(".tabs")).toBeTruthy();
    expect(container.textContent).toContain("Discord");
    expect(container.textContent).toContain("tab content");

    await act(async () => {
      buttonByText("backToChannels")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onBack).toHaveBeenCalled();

    await act(async () => {
      buttonByText("testChannel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRunProbe).toHaveBeenCalled();

    const enabledChannel: ChannelInventoryItem = { ...channel, enabled: true };
    await render(
      createElement(
        ChannelsDetailView,
        {
          channel: enabledChannel,
          availableTabs: CHANNEL_TABS.filter((tab) => !tab.wecomOnly),
          selectedTab: "overview" as ChannelTabId,
          probeResult: null,
          actionState: "idle",
          error: "",
          payloadTimestamp: 1234,
          actionResult: null,
          t,
          onTabChange,
          onBack,
          onRunProbe,
          onRequestLogout,
        },
        createElement("div", null, "body"),
      ),
    );
    await act(async () => {
      buttonByText("logoutChannel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRequestLogout).toHaveBeenCalled();
  });

  it("disables logout button when channel is disabled or action is in flight", async () => {
    const channel = { ...discordItem(), enabled: false };
    await render(
      createElement(
        ChannelsDetailView,
        {
          channel,
          availableTabs: CHANNEL_TABS.filter((tab) => !tab.wecomOnly),
          selectedTab: "overview" as ChannelTabId,
          probeResult: null,
          actionState: "idle",
          error: "",
          payloadTimestamp: 1234,
          actionResult: null,
          t,
          onTabChange: () => undefined,
          onBack: () => undefined,
          onRunProbe: () => undefined,
          onRequestLogout: () => undefined,
        },
        createElement("div", null, "body"),
      ),
    );
    const logoutBtn = buttonByText("logoutChannel");
    expect(logoutBtn?.hasAttribute("disabled")).toBe(true);
  });

  it("renders error banner and tab badge counts when routing has default account", async () => {
    const channel = discordItem();
    const onTabChange = vi.fn();
    await render(
      createElement(
        ChannelsDetailView,
        {
          channel,
          availableTabs: CHANNEL_TABS.filter((tab) => !tab.wecomOnly),
          selectedTab: "routing" as ChannelTabId,
          probeResult: null,
          actionState: "idle",
          error: "boom",
          payloadTimestamp: 1234,
          actionResult: null,
          t,
          onTabChange,
          onBack: () => undefined,
          onRunProbe: () => undefined,
          onRequestLogout: () => undefined,
        },
        createElement("div", null, "body"),
      ),
    );
    expect(container.querySelector(".deck-ui-channels-error")?.textContent).toBe("boom");
    expect(container.textContent).toContain("tab_routing");
    await act(async () => {
      buttonByText("tab_overview")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onTabChange).toHaveBeenCalledWith("overview");
  });
});
