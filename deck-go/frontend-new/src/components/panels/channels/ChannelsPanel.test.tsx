// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  return createElement(DeckIntlProvider, { locale }, createElement(ChannelsPanel));
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
  const nextAccounts = accounts ?? [
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
  ];
  return {
    ts: 2_345,
    channelOrder: ["wecom"],
    channels: {
      wecom: { status: "ready", connected: true },
    },
    channelAccounts: {
      wecom: nextAccounts,
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

  it("loads channel status and selects the first ordered channel by default", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenCalledWith("telegram", "1h"),
    );

    expect(container.querySelector(".deck-ui-channels")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-card")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-body")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-status-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-actions")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-button")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-list")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-detail-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-chart")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-chart-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-form-grid")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-input")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-account-card")).toBeTruthy();
    expect(container.textContent).toContain("Inventory ready");
    expect(container.textContent).toContain("ts: 1234");
    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("Telegram Bot");
    expect(container.textContent).toContain("telegram-provider");
    expect(container.textContent).toContain("plugins.entries.telegram.config");
    expect(container.textContent).toContain("Discord");
    expect(container.textContent).toContain("acct_tg_main");
    expect(container.textContent).toContain("default account: acct_tg_main");
    expect(container.textContent).toContain("healthy");
    expect(container.textContent).toContain("alerts: 0");
    expect(container.textContent).toContain("messages in");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("throughput buckets");
    expect(container.textContent).toContain("1");
    expect(container.querySelector('[data-testid="channel-throughput-chart"]')).toBeTruthy();

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open channel plugin")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToPlugin).toHaveBeenCalledWith(deckUIMocks.ui, "telegram-provider");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "6h")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenLastCalledWith("telegram", "6h"),
    );

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Telegram");
  });

  it("renders localized Chinese channel inventory and detail copy", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel("zh"));
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("清单就绪"));

    expect(container.textContent).toContain("渠道清单");
    expect(container.textContent).toContain("所选渠道");
    expect(container.textContent).toContain("刷新渠道");
    expect(container.textContent).toContain("吞吐量");
    expect(container.textContent).toContain("打开渠道插件");
  });

  it("selects the channel requested by cross-panel navigation params", async () => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=channels&channelId=discord");

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenCalledWith("discord", "1h"),
    );

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Discord");
    expect(container.textContent).toContain("channel id discord");
  });

  it("opens WeCom access controls from cross-panel access navigation params", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    window.history.replaceState(
      {},
      "",
      "/?surface=deck-ui&panel=channels&channelId=wecom&channelSection=access&channelAccountId=tenant-b",
    );

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenCalledWith("wecom", "1h"),
    );
    await waitFor(() => expect(container.textContent).toContain("WeCom access controls"));

    expect(container.querySelector(".deck-ui-channels-wecom")).toBeTruthy();
    expect(container.querySelector(".deck-ui-channels-grid")).toBeTruthy();
    expect(container.textContent).toContain("Opened from a channel access handoff.");
    const accountSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="WeCom access account"]',
    );
    expect(accountSelect?.value).toBe("tenant-b");
  });

  it("renders selected channel accounts and preserves selection after logout refresh", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

    const discordButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Discord"),
    );
    expect(discordButton).toBeTruthy();

    await act(async () => {
      discordButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("channel id discord");
    await waitFor(() =>
      expect(apiMocks.fetchChannelThroughput).toHaveBeenCalledWith("discord", "1h"),
    );
    expect(container.textContent).toContain("Discord Workspace");
    expect(container.textContent).toContain("discord-provider");
    expect(container.textContent).toContain("acct_disc_ops");
    expect(container.textContent).toContain("acct_disc_bot");
    expect(container.textContent).toContain("linked disconnected");
    expect(container.textContent).toContain("config incomplete");
    expect(container.textContent).toContain("2 alerts");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Logout channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.logoutChannel).toHaveBeenCalledWith("discord"));
    expect(window.confirm).toHaveBeenCalledWith("Logout channel discord?");
    expect(container.textContent).toContain("Logout result");
    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Discord");
  });

  it("does not logout a channel when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

    const discordButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Discord"),
    );
    expect(discordButton).toBeTruthy();

    await act(async () => {
      discordButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Logout channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Logout channel discord?");
    expect(apiMocks.logoutChannel).not.toHaveBeenCalled();
  });

  it("runs channel probe tests and toggles selected channel config through the facade", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

    const discordButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Discord"),
    );

    await act(async () => {
      discordButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Test channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.testChannel).toHaveBeenCalledWith("discord"));
    expect(container.textContent).toContain("Channel test result");
    expect(container.textContent).toContain("Probe result");
    expect(container.textContent).toContain("probe success");
    expect(container.textContent).toContain("42");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Disable channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("discord", { enabled: false }),
    );
    expect(window.confirm).toHaveBeenCalledWith("Set channel discord enabled=false?");
    expect(container.textContent).toContain("Channel config patch result");
    expect(container.textContent).toContain("changed");
  });

  it("renders timeout probe status without showing stale results on another channel", async () => {
    apiMocks.testChannel.mockResolvedValueOnce({
      ok: false,
      channelId: "telegram",
      check: "probe",
      latencyMs: 15_000,
      error: "probe timeout",
    });

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Test channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.testChannel).toHaveBeenCalledWith("telegram"));
    expect(container.textContent).toContain("Probe result");
    expect(container.textContent).toContain("probe timeout");
    expect(container.textContent).toContain("15000ms");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Discord"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("probe timeout");
  });

  it("saves generic channel DM policy and retry settings through channel patch", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

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
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save channel settings")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("telegram", {
        dmPolicy: "open",
        retry: {
          attempts: 5,
          minDelayMs: 1_000,
          maxDelayMs: 30_000,
          jitter: 0.2,
        },
      }),
    );
    expect(container.textContent).toContain("Channel config patch result");
    expect(container.textContent).toContain("changed");
  });

  it("applies arbitrary channel JSON patches through the channel config facade", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

    const jsonPatchInput = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="channel json patch"]',
    );
    expect(jsonPatchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(jsonPatchInput as HTMLTextAreaElement, {
        target: {
          value: JSON.stringify({
            webhook: { enabled: true, url: "https://example.test/hook" },
          }),
        },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Apply JSON patch")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("telegram", {
        webhook: { enabled: true, url: "https://example.test/hook" },
      }),
    );
    expect(container.textContent).toContain("Channel config patch result");
    expect(container.textContent).toContain("changed");
  });

  it("saves generic account DM policy overrides through channel patch", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchChannels).toHaveBeenCalledTimes(1));

    const accountPolicySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="account dm policy acct_tg_main"]',
    );
    expect(accountPolicySelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(accountPolicySelect as HTMLSelectElement, {
        target: { value: "allowlist" },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save account policy")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchChannelConfig).toHaveBeenCalledWith("telegram", {
        accounts: {
          acct_tg_main: {
            dm: { policy: "allowlist" },
          },
        },
      }),
    );
    expect(container.textContent).toContain("Channel config patch result");
    expect(container.textContent).toContain("changed");
  });

  it("saves WeCom bot allowFrom edits through the config patch route", async () => {
    apiMocks.fetchChannels.mockResolvedValue(
      wecomChannelsPayload([
        {
          accountId: "default",
          configured: true,
          connected: true,
          displayName: "Default",
          enabled: true,
          linked: true,
        },
      ]),
    );

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchDeckConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("WeCom access controls"));
    expect(container.textContent).toContain("Allowlist mode is enabled but allowFrom is empty.");

    const input = Array.from(container.querySelectorAll("input")).find(
      (candidate) => candidate.getAttribute("placeholder") === "Add a WeCom user id or *",
    );
    expect(input).toBeTruthy();
    await act(async () => {
      fireEvent.change(input as HTMLInputElement, { target: { value: "user:test-user" } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchDeckConfig).toHaveBeenCalledWith(
        {
          channels: {
            wecom: {
              bot: {
                dm: {
                  policy: "allowlist",
                  allowFrom: ["test-user"],
                },
              },
            },
          },
        },
        "config-h1",
      ),
    );
    expect(container.textContent).toContain("Saved config hash config-h2");
  });

  it("saves WeCom dynamic-agent and routing access sections", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Dynamic agents"));

    const adminInput = Array.from(container.querySelectorAll("input")).find(
      (candidate) => candidate.getAttribute("placeholder") === "Add an admin user id",
    );
    expect(adminInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(adminInput as HTMLInputElement, { target: { value: "Admin-One" } });
    });

    await act(async () => {
      const checkboxes = Array.from(
        container.querySelectorAll('input[type="checkbox"]'),
      ) as HTMLInputElement[];
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);
      const addButton = Array.from(container.querySelectorAll("button"))
        .toReversed()
        .find((button) => button.textContent === "Add");
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save dynamic agents")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchDeckConfig).toHaveBeenCalledWith(
        {
          channels: {
            wecom: {
              dynamicAgents: {
                enabled: true,
                dmCreateAgent: true,
                groupEnabled: true,
                adminUsers: ["admin-one"],
              },
            },
          },
        },
        "config-h1",
      ),
    );

    await act(async () => {
      const checkboxes = Array.from(
        container.querySelectorAll('input[type="checkbox"]'),
      ) as HTMLInputElement[];
      fireEvent.click(checkboxes[3]);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save routing behavior")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchDeckConfig).toHaveBeenCalledWith(
        {
          channels: {
            wecom: {
              routing: { failClosedOnDefaultRoute: true },
            },
          },
        },
        "config-h1",
      ),
    );
  });

  it("summarizes WeCom routing bindings and opens routing with account context", async () => {
    apiMocks.fetchChannels.mockResolvedValue(wecomChannelsPayload());
    apiMocks.fetchRoutingBindings.mockResolvedValue({
      defaultAgentId: "main",
      dmScope: "account",
      configHash: "routing-h1",
      bindings: [
        {
          id: "wecom-default",
          agentId: "main",
          tier: "default",
          match: { channel: "wecom" },
        },
        {
          id: "wecom-account",
          agentId: "tenant-agent",
          tier: "account",
          match: { channel: "wecom", accountId: "default" },
        },
        {
          id: "wecom-other-account",
          agentId: "other-agent",
          tier: "account",
          match: { channel: "wecom", accountId: "tenant-b" },
        },
        {
          id: "telegram-default",
          agentId: "telegram-agent",
          tier: "channel",
          match: { channel: "telegram" },
        },
      ],
    });

    await act(async () => {
      root = createRoot(container);
      root.render(renderChannelsPanel());
    });

    await waitFor(() =>
      expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledWith({
        channel: "wecom",
        accountId: "default",
      }),
    );

    expect(container.textContent).toContain("Routing bindings");
    expect(container.textContent).toContain("2 bindings currently target this WeCom account.");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open routing for WeCom")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToRouting).toHaveBeenCalledWith(deckUIMocks.ui, {
      channelId: "wecom",
      accountId: "default",
    });
  });
});
