// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ChannelsPanel } from "./ChannelsPanel";

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

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToPlugin: deckUIMocks.navigateToPlugin,
  navigateToRouting: deckUIMocks.navigateToRouting,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;

function renderChannelsPanel(locale: "en" | "zh" = "en") {
  return createElement(
    DataFabricTestProvider,
    null,
    createElement(DeckIntlProvider, { locale }, createElement(ChannelsPanel)),
  );
}

function channelsPayload() {
  return {
    ts: 1_234,
    channelOrder: ["telegram", "discord"],
    channels: {
      telegram: {
        status: "ready",
        connected: true,
        dmPolicy: "pairing",
        retry: { attempts: 3, minDelayMs: 1_000, maxDelayMs: 30_000, jitter: 0.2 },
      },
      discord: { status: "ready", connected: false },
    },
    channelAccounts: {
      telegram: [
        {
          accountId: "acct_tg_main",
          configured: true,
          connected: true,
          displayName: "Telegram Main",
          enabled: true,
          linked: true,
        },
      ],
      discord: [
        {
          accountId: "acct_disc_ops",
          configured: true,
          connected: false,
          displayName: "Discord Ops",
          enabled: true,
          linked: true,
        },
        {
          accountId: "acct_disc_bot",
          configured: false,
          connected: true,
          displayName: "Discord Bot",
          enabled: true,
          linked: true,
        },
      ],
    },
    channelDefaultAccountId: {
      telegram: "acct_tg_main",
      discord: "acct_disc_bot",
    },
    channelLabels: {
      telegram: "Telegram",
      discord: "Discord",
    },
    channelDetailLabels: {
      telegram: "Telegram Bot",
      discord: "Discord Workspace",
    },
    channelSystemImages: {
      telegram: "paperplane",
      discord: "gamepad",
    },
    channelMeta: [
      {
        id: "telegram",
        label: "Telegram",
        detailLabel: "Telegram Bot",
        systemImage: "paperplane",
        pluginId: "telegram-provider",
        pluginOrigin: "bundled",
        pluginConfigPath: "plugins.entries.telegram.config",
      },
      {
        id: "discord",
        label: "Discord",
        detailLabel: "Discord Workspace",
        systemImage: "gamepad",
        pluginId: "discord-provider",
        pluginOrigin: "local",
        pluginConfigPath: "plugins.entries.discord.config",
      },
    ],
  };
}

function wecomChannelsPayload(accounts?: Array<Record<string, unknown>>) {
  return {
    ts: 2_345,
    channelOrder: ["wecom"],
    channels: {
      wecom: { status: "ready", connected: true },
    },
    channelAccounts: {
      wecom: accounts ?? [
        {
          accountId: "default",
          configured: true,
          connected: true,
          displayName: "Default",
          enabled: true,
          linked: true,
        },
        {
          accountId: "tenant-b",
          configured: true,
          connected: true,
          displayName: "Tenant B",
          enabled: true,
          linked: true,
        },
      ],
    },
    channelDefaultAccountId: {
      wecom: "default",
    },
    channelLabels: {
      wecom: "WeCom",
    },
    channelDetailLabels: {
      wecom: "WeCom Operations",
    },
    channelSystemImages: {
      wecom: "wecom",
    },
    channelMeta: [
      {
        id: "wecom",
        label: "WeCom",
        detailLabel: "WeCom Operations",
        systemImage: "wecom",
        pluginId: "wecom",
        pluginOrigin: "bundled",
        pluginConfigPath: "plugins.entries.wecom.config",
      },
    ],
  };
}

function wecomConfigSnapshot() {
  return {
    hash: "config-h1",
    config: {
      channels: {
        wecom: {
          bot: { dm: { policy: "allowlist", allowFrom: [] } },
          agent: { dm: { policy: "open", allowFrom: ["user-a"] } },
          dynamicAgents: {
            enabled: false,
            dmCreateAgent: false,
            groupEnabled: false,
            adminUsers: [],
          },
          routing: { failClosedOnDefaultRoute: false },
        },
      },
    },
  };
}

async function mount(locale: "en" | "zh" = "en") {
  await act(async () => {
    root = createRoot(container);
    root.render(renderChannelsPanel(locale));
  });
  await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));
}

function buttonByText(text: string | RegExp) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    typeof text === "string"
      ? button.textContent?.includes(text)
      : text.test(button.textContent ?? ""),
  );
}

describe("ChannelsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchChannels.mockResolvedValue(channelsPayload());
    apiMocks.fetchDeckConfig.mockResolvedValue(wecomConfigSnapshot());
    apiMocks.fetchChannelThroughput.mockResolvedValue({
      buckets: [{ time: 1_234, in: 3, out: 4 }],
      messagesIn: 12,
      messagesOut: 9,
    });
    apiMocks.fetchRoutingBindings.mockResolvedValue({
      bindings: [],
      defaultAgentId: "main",
      dmScope: "account",
      configHash: "routing-h1",
    });
    apiMocks.logoutChannel.mockResolvedValue({ ok: true, channelId: "discord" });
    apiMocks.patchDeckConfig.mockResolvedValue({ ok: true, hash: "config-h2" });
    apiMocks.patchChannelConfig.mockResolvedValue({ ok: true, changed: true });
    apiMocks.testChannel.mockResolvedValue({
      ok: true,
      channelId: "discord",
      check: "probe",
      latencyMs: 42,
      checkedAt: 1_235,
    });
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
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads the v2 list view, supports filtering, and opens detail", async () => {
    await mount();

    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenCalledWith("telegram", "1h"),
    );

    expect(container.querySelector(".list-view")).toBeTruthy();
    expect(container.querySelector(".kpi-strip")).toBeTruthy();
    expect(container.querySelector(".toolbar__search")).toBeTruthy();
    expect(container.querySelector(".row__head")).toBeTruthy();
    expect(container.textContent).toContain("Channels");
    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("Discord");
    expect(container.textContent).toContain("2 alerts");
    expect(container.textContent).toContain("Throughput");
    expect(buttonByText("New channel")?.hasAttribute("disabled")).toBe(true);

    const search = container.querySelector<HTMLInputElement>(".toolbar__search input");
    expect(search).toBeTruthy();
    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "discord" } });
    });
    expect(container.textContent).toContain("Discord");
    expect(container.textContent).not.toContain("Telegram Bot");

    await act(async () => {
      buttonByText("Discord")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".detail-view")).toBeTruthy();
    expect(container.textContent).toContain("Discord Workspace");
    expect(container.textContent).toContain("Overview");
    expect(container.textContent).toContain("Routing");
  });

  it("renders localized Chinese copy in the v2 shell", async () => {
    await mount("zh");

    expect(container.textContent).toContain("渠道管理");
    expect(container.textContent).toContain("刷新渠道");
    expect(container.textContent).toContain("新建渠道");
    expect(container.textContent).toContain("吞吐量");
  });

  it("opens detail from cross-panel navigation params", async () => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=channels&channelId=discord");

    await mount();

    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenCalledWith("discord", "1h"),
    );
    expect(container.querySelector(".detail-view")).toBeTruthy();
    expect(container.textContent).toContain("Discord Workspace");
    expect(container.textContent).toContain("acct_disc_bot");
  });

  it("runs probe, hides stale results on another channel, and toggles config through the facade", async () => {
    await mount();

    await act(async () => {
      buttonByText("Discord")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Test channel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.testChannel).toHaveBeenCalledWith("discord"));
    expect(container.textContent).toContain("Channel probe result");
    expect(container.textContent).toContain("probe success");
    expect(container.textContent).toContain("42ms");
    await act(async () => {
      buttonByText("Done")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      buttonByText("Settings")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Disable channel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("discord", { enabled: false }),
    );
    expect(window.confirm).toHaveBeenCalledWith("Set channel discord enabled=false?");
    expect(container.textContent).toContain("Channel config patch result");
  });

  it("opens the logout confirmation dialog without executing destructive action on cancel", async () => {
    await mount();

    await act(async () => {
      buttonByText("Discord")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Logout channel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Confirm channel logout");
    expect(container.textContent).toContain("Logout mutates provider state for discord");

    await act(async () => {
      buttonByText("Cancel")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.logoutChannel).not.toHaveBeenCalled();
  });

  it("saves channel and account settings through channel patch", async () => {
    await mount();

    await act(async () => {
      buttonByText("Telegram")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Settings")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dmPolicySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="channel dm policy"]',
    );
    const attemptsInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "retry attempts",
    );
    expect(dmPolicySelect).toBeTruthy();
    expect(attemptsInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(dmPolicySelect as HTMLSelectElement, { target: { value: "open" } });
      fireEvent.change(attemptsInput as HTMLInputElement, { target: { value: "5" } });
    });
    await act(async () => {
      buttonByText("Save channel settings")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("telegram", {
        dmPolicy: "open",
        retry: { attempts: 5, minDelayMs: 1_000, maxDelayMs: 30_000, jitter: 0.2 },
      }),
    );

    const accountPolicySelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>("select"),
    ).find((select) => select.getAttribute("aria-label") === "account dm policy acct_tg_main");
    expect(accountPolicySelect).toBeTruthy();
    await act(async () => {
      fireEvent.change(accountPolicySelect as HTMLSelectElement, { target: { value: "disabled" } });
    });
    await act(async () => {
      buttonByText("Save account policy")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("telegram", {
        accounts: {
          acct_tg_main: {
            dm: { policy: "disabled" },
          },
        },
      }),
    );
  });

  it("opens WeCom access controls from cross-panel access params", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    window.history.replaceState(
      {},
      "",
      "/?surface=deck-ui&panel=channels&channelId=wecom&channelSection=access&channelAccountId=tenant-b",
    );

    await mount();

    await waitFor(() => expect(apiMocks.fetchDeckConfig).toHaveBeenCalled());
    expect(container.querySelector(".detail-view")).toBeTruthy();
    expect(container.textContent).toContain("WeCom access controls");
    expect(container.textContent).toContain("Opened from a channel access handoff.");
    const accountSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="WeCom access account"]',
    );
    expect(accountSelect?.value).toBe("tenant-b");
  });

  it("loads routing tab through the BFF and navigates with channel context", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    apiMocks.fetchRoutingBindings.mockResolvedValue({
      bindings: [
        {
          id: "wecom-default",
          agentId: "main",
          tier: "account",
          match: { channel: "wecom", accountId: "default" },
        },
      ],
      defaultAgentId: "main",
      dmScope: "account",
      configHash: "routing-h1",
    });

    await mount();

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>(".row"))
        .find((button) => button.textContent?.includes("WeCom"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Routing")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledWith({
        channel: "wecom",
        accountId: "default",
      }),
    );
    expect(container.textContent).toContain("main");

    await act(async () => {
      buttonByText("Open routing")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToRouting).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "wecom",
      accountId: "default",
    });
  });

  it("renders an honest empty state for a real empty channels payload", async () => {
    apiMocks.fetchChannels.mockResolvedValue({
      channelAccounts: {},
      channelDefaultAccountId: {},
      channelLabels: {},
      channelOrder: [],
      channels: {},
      ts: 9_999,
    });

    await mount();

    expect(container.textContent).toContain("No channels loaded.");
    expect(container.textContent).toContain("The real Gateway returned an empty channels shape.");
  });
});
