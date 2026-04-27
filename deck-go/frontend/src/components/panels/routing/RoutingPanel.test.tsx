// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { RoutingPanel } from "./RoutingPanel";

const apiMocks = vi.hoisted(() => ({
  addRoutingBinding: vi.fn(),
  fetchActivityEvents: vi.fn(),
  fetchRoutingBindings: vi.fn(),
  patchDeckConfig: vi.fn(),
  removeRoutingBinding: vi.fn(),
  simulateRouting: vi.fn(),
  validateRoutingBinding: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToChannel: vi.fn(),
  navigateToChannelAccess: vi.fn(),
  navigateToSession: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToChannel: deckUIMocks.navigateToChannel,
  navigateToChannelAccess: deckUIMocks.navigateToChannelAccess,
  navigateToSession: deckUIMocks.navigateToSession,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;

function renderPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(RoutingPanel)));
  });
}

function routingBindings() {
  return {
    defaultAgentId: "main",
    dmScope: "per-channel-peer",
    configHash: "hash-1",
    bindings: [
      {
        id: "bind-main",
        agentId: "main",
        tier: "default",
        match: {
          channel: "telegram",
          accountId: "acct-main",
          peer: { kind: "direct" as const, id: "peer-main" },
        },
      },
      {
        id: "bind-builder",
        agentId: "builder",
        tier: "role",
        match: {
          channel: "discord",
          guildId: "guild-1",
          teamId: "team-1",
          roles: ["admin", "ops"],
        },
      },
      {
        id: "bind-shadow",
        agentId: "shadow",
        tier: "channel",
        match: {
          channel: "discord",
        },
      },
    ],
  };
}

describe("RoutingPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchRoutingBindings.mockResolvedValue(routingBindings());
    apiMocks.patchDeckConfig.mockResolvedValue({ ok: true, hash: "hash-scope" });
    apiMocks.fetchActivityEvents.mockResolvedValue({
      events: [
        {
          id: "route-activity",
          timestamp: 123,
          type: "routing.matched",
          agentId: "builder",
          agentName: "Builder Agent",
          description: "Routed discord message to builder",
        },
        {
          id: "system-noise",
          timestamp: 124,
          type: "system",
          description: "System-only event",
        },
      ],
    });
    apiMocks.validateRoutingBinding.mockResolvedValue({
      ok: true,
      tier: "peer",
      conflicts: [],
    });
    apiMocks.addRoutingBinding.mockResolvedValue({
      ok: true,
      binding: {
        id: "bind-new",
        agentId: "support",
        tier: "peer",
        match: {
          channel: "discord",
          accountId: "acct-2",
          peer: { kind: "direct", id: "peer-2" },
        },
      },
      configHash: "hash-2",
      warnings: [],
    });
    apiMocks.removeRoutingBinding.mockResolvedValue({
      ok: true,
      removed: routingBindings().bindings[0],
      configHash: "hash-2",
      impact: "messages fall through",
    });
    apiMocks.simulateRouting.mockResolvedValue({
      agentId: "builder",
      matchedBy: "role",
      sessionKey: "agent:builder:web",
      tiers: [
        { tier: "role", matched: true, checked: true },
        { tier: "default", matched: false, checked: true },
        { tier: "workspace", matched: false, checked: false },
      ],
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
    vi.clearAllMocks();
  });

  it("loads routing bindings and selects the first binding by default", async () => {
    renderPanel();

    expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledWith({
      agentId: "",
      channel: "",
      accountId: "",
    });
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledWith(20);
    await waitFor(() => expect(container.textContent).toContain("Routing ready"));
    expect(container.textContent).toContain("Routing ready");
    expect(container.textContent).toContain("default main");
    expect(container.textContent).toContain("dm scope per-channel-peer");
    expect(container.textContent).toContain("hash-1");
    expect(container.textContent).toContain("bind-main");
    expect(container.textContent).toContain("Peer direct:peer-main");
    expect(container.textContent).toContain("routing conflicts 1");
    expect(container.textContent).toContain("subset with bind-shadow");
    expect(container.textContent).toContain("Activity Feed");
    expect(container.textContent).toContain("Routed discord message to builder");
    expect(container.textContent).not.toContain("System-only event");
    expect(container.querySelector(".deck-ui-routing")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-routing-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-routing-body")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-routing-status-row").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(container.querySelector(".deck-ui-routing-stats")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-routing-surface").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll(".deck-ui-routing-form-grid").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(container.querySelectorAll(".deck-ui-routing-input").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelectorAll(".deck-ui-routing-actions").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".deck-ui-routing-button").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelector(".deck-ui-routing-list")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-routing-row").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".deck-ui-routing-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-routing-detail-stats")).toBeTruthy();

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open binding agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "main");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open binding channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToChannel).toHaveBeenCalledWith(deckUIMocks.ui, "telegram");
  });

  it("patches the DM scope strategy through the config API", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledTimes(1));

    const scopeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="DM scope strategy"]',
    );
    expect(scopeSelect).toBeTruthy();
    expect(scopeSelect?.value).toBe("per-channel-peer");

    await act(async () => {
      fireEvent.change(scopeSelect as HTMLSelectElement, {
        target: { value: "per-account-channel-peer" },
      });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Patch DM scope")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.patchDeckConfig).toHaveBeenCalledWith(
        { session: { dmScope: "per-account-channel-peer" } },
        "hash-1",
      ),
    );
    expect(container.textContent).toContain("DM scope updated to per-account-channel-peer");
  });

  it("initializes filters and simulator from routing navigation context", async () => {
    window.history.replaceState(
      {},
      "",
      "/?surface=deck-ui&panel=routing&routingAgentId=builder&routingChannel=wecom&routingAccountId=default",
    );

    renderPanel();

    await waitFor(() =>
      expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledWith({
        agentId: "builder",
        channel: "wecom",
        accountId: "default",
      }),
    );

    const [agentFilter, channelFilter, accountFilter] = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[placeholder="agent id"], input[placeholder="channel"], input[placeholder="account id"]',
      ),
    );
    expect(agentFilter?.value).toBe("builder");
    expect(channelFilter?.value).toBe("wecom");
    expect(accountFilter?.value).toBe("default");

    const [simulateChannel, simulateAccount] = Array.from(
      container.querySelectorAll<HTMLInputElement>(".deckgo-panel-main input"),
    );
    expect(simulateChannel?.value).toBe("wecom");
    expect(simulateAccount?.value).toBe("default");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Simulate")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.simulateRouting).toHaveBeenCalled());

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open simulation access")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToChannelAccess).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "wecom",
      "default",
    );

    await act(async () => {
      fireEvent.change(simulateChannel, { target: { value: "discord" } });
      fireEvent.change(simulateAccount, { target: { value: "acct-1" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Reset simulation")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(simulateChannel?.value).toBe("wecom");
    expect(simulateAccount?.value).toBe("default");
  });

  it("refreshes with filters and runs route simulation with normalized payload", async () => {
    renderPanel();

    const [agentFilter, channelFilter, accountFilter] = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[placeholder="agent id"], input[placeholder="channel"], input[placeholder="account id"]',
      ),
    );
    expect(agentFilter).toBeTruthy();
    expect(channelFilter).toBeTruthy();
    expect(accountFilter).toBeTruthy();

    await act(async () => {
      fireEvent.change(agentFilter, { target: { value: "builder" } });
      fireEvent.change(channelFilter, { target: { value: "discord" } });
      fireEvent.change(accountFilter, { target: { value: "acct-1" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Refresh routing")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.fetchRoutingBindings).toHaveBeenLastCalledWith({
        agentId: "builder",
        channel: "discord",
        accountId: "acct-1",
      }),
    );

    const [
      simulateChannel,
      simulateAccount,
      simulatePeerId,
      simulateGuild,
      simulateTeam,
      simulateRoles,
    ] = Array.from(container.querySelectorAll<HTMLInputElement>(".deckgo-panel-main input"));
    const simulatePeerKind = container.querySelector<HTMLSelectElement>(
      'select[aria-label="simulation peer kind"]',
    );
    expect(simulateChannel).toBeTruthy();
    expect(simulateAccount).toBeTruthy();
    expect(simulatePeerKind).toBeTruthy();
    expect(simulatePeerId).toBeTruthy();
    expect(simulateGuild).toBeTruthy();
    expect(simulateTeam).toBeTruthy();
    expect(simulateRoles).toBeTruthy();

    await act(async () => {
      fireEvent.change(simulateChannel, { target: { value: " discord " } });
      fireEvent.change(simulateAccount, { target: { value: " acct-1 " } });
      fireEvent.change(simulatePeerKind as HTMLSelectElement, { target: { value: "direct" } });
      fireEvent.change(simulatePeerId, { target: { value: " peer-1 " } });
      fireEvent.change(simulateGuild, { target: { value: " guild-1 " } });
      fireEvent.change(simulateTeam, { target: { value: " team-1 " } });
      fireEvent.change(simulateRoles, {
        target: { value: " admin, ops, " },
      });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Simulate")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.simulateRouting).toHaveBeenCalledWith({
        channel: "discord",
        accountId: "acct-1",
        peer: { kind: "direct", id: "peer-1" },
        guildId: "guild-1",
        teamId: "team-1",
        memberRoleIds: ["admin", "ops"],
      }),
    );
    expect(container.textContent).toContain("Simulation result");
    expect(container.textContent).toContain("builder");
    expect(container.textContent).toContain("matched by role");
    expect(container.textContent).toContain("default");
    expect(container.textContent).toContain("checked");
    expect(container.textContent).toContain("role");
    expect(container.textContent).toContain("matched");
    expect(container.textContent).toContain("workspace");
    expect(container.textContent).toContain("skipped");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open simulation agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "builder");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open simulation session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(deckUIMocks.ui, "agent:builder:web");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open simulation channel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToChannel).toHaveBeenCalledWith(deckUIMocks.ui, "discord");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Reset simulation")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Simulation result");
    expect(simulateChannel?.value).toBe("telegram");
    expect(simulateAccount?.value).toBe("");
    expect(simulatePeerId?.value).toBe("");
  });

  it("validates, adds, and removes routing bindings with the current config hash", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledTimes(1));

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    const inputByPlaceholder = (placeholder: string) =>
      inputs.find((input) => input.placeholder === placeholder);
    const peerKindSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="binding peer kind"]',
    );
    expect(inputByPlaceholder("binding agent id")).toBeTruthy();
    expect(peerKindSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(inputByPlaceholder("binding agent id") as HTMLInputElement, {
        target: { value: " support " },
      });
      fireEvent.change(inputByPlaceholder("binding channel") as HTMLInputElement, {
        target: { value: " discord " },
      });
      fireEvent.change(inputByPlaceholder("binding account id") as HTMLInputElement, {
        target: { value: " acct-2 " },
      });
      fireEvent.change(peerKindSelect as HTMLSelectElement, { target: { value: "direct" } });
      fireEvent.change(inputByPlaceholder("binding peer id") as HTMLInputElement, {
        target: { value: " peer-2 " },
      });
      fireEvent.change(inputByPlaceholder("binding roles, comma separated") as HTMLInputElement, {
        target: { value: " admin, ops, " },
      });
      fireEvent.change(inputByPlaceholder("binding comment") as HTMLInputElement, {
        target: { value: " routed support " },
      });
      fireEvent.change(inputByPlaceholder("binding position") as HTMLInputElement, {
        target: { value: "1" },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Validate binding")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.validateRoutingBinding).toHaveBeenCalledWith({
        agentId: "support",
        match: {
          channel: "discord",
          accountId: "acct-2",
          peer: { kind: "direct", id: "peer-2" },
          roles: ["admin", "ops"],
        },
      }),
    );
    expect(container.textContent).toContain("validation ok");
    expect(container.textContent).toContain("tier peer");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add binding")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.addRoutingBinding).toHaveBeenCalledWith({
        agentId: "support",
        match: {
          channel: "discord",
          accountId: "acct-2",
          peer: { kind: "direct", id: "peer-2" },
          roles: ["admin", "ops"],
        },
        baseHash: "hash-1",
        comment: "routed support",
        position: 1,
      }),
    );
    expect(container.textContent).toContain("Routing mutation");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Remove binding")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.removeRoutingBinding).toHaveBeenCalledWith({
        id: "bind-main",
        baseHash: "hash-1",
      }),
    );
  });

  it("reorders a selected binding through remove and add with the fresh config hash", async () => {
    const movedBinding = routingBindings().bindings[1];
    apiMocks.removeRoutingBinding.mockResolvedValueOnce({
      ok: true,
      removed: movedBinding,
      configHash: "hash-after-remove",
      impact: "temporary fallthrough",
    });
    apiMocks.addRoutingBinding.mockResolvedValueOnce({
      ok: true,
      binding: movedBinding,
      configHash: "hash-after-add",
      warnings: [],
    });

    renderPanel();

    await waitFor(() => expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>(".deckgo-shell-list button"))
        .find((button) => button.textContent?.includes("bind-builder"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Move down")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.removeRoutingBinding).toHaveBeenCalledWith({
        id: "bind-builder",
        baseHash: "hash-1",
      }),
    );
    expect(apiMocks.addRoutingBinding).toHaveBeenCalledWith({
      agentId: "builder",
      match: movedBinding.match,
      baseHash: "hash-after-remove",
      comment: undefined,
      position: 2,
    });
    expect(container.textContent).toContain("Routing mutation");
  });

  it("loads the selected binding match into the route simulator draft", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>(".deckgo-shell-list button"))
        .find((button) => button.textContent?.includes("bind-builder"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Use as simulation")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const [
      simulateChannel,
      simulateAccount,
      simulatePeerId,
      simulateGuild,
      simulateTeam,
      simulateRoles,
    ] = Array.from(container.querySelectorAll<HTMLInputElement>(".deckgo-panel-main input"));
    const simulatePeerKind = container.querySelector<HTMLSelectElement>(
      'select[aria-label="simulation peer kind"]',
    );

    expect(simulateChannel?.value).toBe("discord");
    expect(simulateAccount?.value).toBe("");
    expect(simulatePeerKind?.value).toBe("");
    expect(simulatePeerId?.value).toBe("");
    expect(simulateGuild?.value).toBe("guild-1");
    expect(simulateTeam?.value).toBe("team-1");
    expect(simulateRoles?.value).toBe("admin, ops");
  });

  it("renders the routing shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() => expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("路由就绪");
    expect(container.textContent).toContain("过滤绑定");
    expect(container.textContent).toContain("添加或验证绑定");
    expect(container.textContent).toContain("路由详情");
    expect(container.textContent).toContain("模拟路由选择");
    expect(container.textContent).toContain("活动事件");
  });
});
