// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateToChannel, navigateToChannelAccess, navigateToRouting } = vi.hoisted(() => ({
  navigateToChannel: vi.fn(),
  navigateToChannelAccess: vi.fn(),
  navigateToRouting: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    (
      ({
        title: "Plugins",
        description: "Read-only inventory",
        scope: "Scope",
        empty: "No plugins",
        origin: "Origin",
        status: "Status",
        capabilities: "Capabilities",
        channels: "Channels",
        enabled: "Enabled",
        yes: "Yes",
        no: "No",
        none: "None",
        configPath: "Plugin Config Key",
        activation: "Activation",
        activationSource: "Activation Source",
        activationReason: "Activation Reason",
        scopeChannel: "channel-capable plugins only",
        diagnostics: "Diagnostics",
        relatedChannels: "Related Channels",
        noVisibleChannels: "No visible channels in Channels yet",
        openAccess: "Open Access",
        openRouting: "Open Routing",
        channelVisibilityWarning: `Not visible in Channels: ${values?.channels ?? ""}`,
        openChannel: `Open ${values?.channel ?? "channel"}`,
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("../../ui/panel-empty-state", () => ({
  PanelEmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("../../ui/panel-skeleton", () => ({
  PanelSkeleton: () => <div>loading</div>,
}));

vi.mock("../../../lib/panel-navigation", () => ({
  navigateToChannel,
  navigateToChannelAccess,
  navigateToRouting,
}));

vi.mock("../../../stores/channels", () => ({
  useChannelsStore: (selector: (state: { channelOrder: string[] }) => unknown) =>
    selector({ channelOrder: ["wecom"] }),
}));

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof globalThis.fetch;

let PluginsPanel: typeof import("./PluginsPanel").PluginsPanel;

beforeEach(async () => {
  vi.resetModules();
  ({ PluginsPanel } = await import("./PluginsPanel"));
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  navigateToChannel.mockReset();
  navigateToChannelAccess.mockReset();
  navigateToRouting.mockReset();
});

describe("PluginsPanel", () => {
  it("renders read-only plugin inventory cards", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: "channel",
        plugins: [
          {
            id: "wecom",
            name: "WeCom",
            origin: "bundled",
            status: "loaded",
            enabled: true,
            activationSource: "config",
            activationReason: "channel enabled in config",
            configPath: "plugins.entries.wecom.config",
            capabilityKinds: ["channel"],
            channelIds: ["wecom"],
            providerIds: [],
            toolNames: [],
            diagnostics: [{ level: "warn", message: "check auth" }],
          },
        ],
      }),
    });

    render(<PluginsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Plugins")).toBeTruthy();
      expect(screen.getByText("WeCom")).toBeTruthy();
      expect(screen.getByText("bundled")).toBeTruthy();
      expect(screen.getByText("loaded")).toBeTruthy();
      expect(screen.getByText("plugins.entries.wecom.config")).toBeTruthy();
      expect(screen.getByText("config")).toBeTruthy();
      expect(screen.getByText("channel enabled in config")).toBeTruthy();
      expect(screen.getByText(/channel-capable plugins only/i)).toBeTruthy();
      expect(screen.getByText("[warn] check auth")).toBeTruthy();
    });
  });

  it("allows selecting a plugin card in the inventory", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: "channel",
        plugins: [
          {
            id: "wecom",
            name: "WeCom",
            origin: "bundled",
            status: "loaded",
            enabled: true,
            configPath: "plugins.entries.wecom.config",
            capabilityKinds: ["channel"],
            channelIds: ["wecom"],
            providerIds: [],
            toolNames: [],
            diagnostics: [],
          },
        ],
      }),
    });

    const { usePluginsStore } = await import("../../../stores/plugins");
    render(<PluginsPanel />);

    const [card] = await screen.findAllByRole("button", { name: /wecom/i });
    card.click();

    expect(usePluginsStore.getState().selectedId).toBe("wecom");
  });

  it("offers channel and routing handoffs plus hidden-channel warnings", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scope: "channel",
        plugins: [
          {
            id: "wecom",
            name: "WeCom",
            origin: "bundled",
            status: "loaded",
            enabled: true,
            configPath: "plugins.entries.wecom.config",
            capabilityKinds: ["channel"],
            channelIds: ["wecom-shadow", "wecom"],
            providerIds: [],
            toolNames: [],
            diagnostics: [],
          },
        ],
      }),
    });

    render(<PluginsPanel />);

    const openChannel = await screen.findByRole("button", { name: /open wecom/i });
    openChannel.click();
    expect(navigateToChannel).toHaveBeenCalledWith("wecom");

    const openRouting = screen.getByRole("button", { name: /open routing/i });
    openRouting.click();
    expect(navigateToRouting).toHaveBeenCalledWith({ channelId: "wecom" });

    const openAccess = screen.getByRole("button", { name: /open access/i });
    openAccess.click();
    expect(navigateToChannelAccess).toHaveBeenCalledWith("wecom");

    expect(screen.getByText(/not visible in channels: wecom-shadow/i)).toBeTruthy();
  });
});
