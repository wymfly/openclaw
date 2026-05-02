// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  navigateToAgent,
  navigateToChannel,
  navigateToChannelAccess,
  navigateToPlugin,
  navigateToRouting,
  navigateToSession,
} from "./panel-navigation";

describe("panel navigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?surface=deck-ui&panel=channels");
  });

  it("preserves the old agent-string routing handoff shape", () => {
    window.history.replaceState(
      {},
      "",
      "/?surface=deck-ui&panel=channels&routingChannel=wecom&routingAccountId=default",
    );
    const ui = { setActivePanel: vi.fn() };

    navigateToRouting(ui, " builder ");

    const url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenCalledWith("routing");
    expect(url.searchParams.get("panel")).toBe("routing");
    expect(url.searchParams.get("routingAgentId")).toBe("builder");
    expect(url.searchParams.has("routingChannel")).toBe(false);
    expect(url.searchParams.has("routingAccountId")).toBe(false);
  });

  it("writes object routing handoff context for channel and account drills", () => {
    const ui = { setActivePanel: vi.fn() };

    navigateToRouting(ui, {
      accountId: " default ",
      agentId: " builder ",
      channelId: " wecom ",
    });

    const url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenCalledWith("routing");
    expect(url.searchParams.get("panel")).toBe("routing");
    expect(url.searchParams.get("routingAgentId")).toBe("builder");
    expect(url.searchParams.get("routingChannel")).toBe("wecom");
    expect(url.searchParams.get("routingAccountId")).toBe("default");
  });

  it("accepts old string target shapes for common cross-panel handoffs", () => {
    const ui = { setActivePanel: vi.fn() };

    navigateToAgent(ui, " reviewer ", "sessions");
    let url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenLastCalledWith("agents");
    expect(url.searchParams.get("panel")).toBe("agents");
    expect(url.searchParams.get("agentId")).toBe("reviewer");
    expect(url.searchParams.get("agentTab")).toBe("sessions");

    navigateToChannel(ui, " wecom ");
    url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenLastCalledWith("channels");
    expect(url.searchParams.get("panel")).toBe("channels");
    expect(url.searchParams.get("channelId")).toBe("wecom");
    expect(url.searchParams.has("channelSection")).toBe(false);

    navigateToChannelAccess(ui, " wecom ", " tenant-a ");
    url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenLastCalledWith("channels");
    expect(url.searchParams.get("panel")).toBe("channels");
    expect(url.searchParams.get("channelId")).toBe("wecom");
    expect(url.searchParams.get("channelSection")).toBe("access");
    expect(url.searchParams.get("channelAccountId")).toBe("tenant-a");

    navigateToPlugin(ui, " slack ");
    url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenLastCalledWith("plugins");
    expect(url.searchParams.get("panel")).toBe("plugins");
    expect(url.searchParams.get("pluginId")).toBe("slack");

    navigateToSession(ui, " sess-main ");
    url = new URL(window.location.href);
    expect(ui.setActivePanel).toHaveBeenLastCalledWith("sessions");
    expect(url.searchParams.get("panel")).toBe("sessions");
    expect(url.searchParams.get("sessionKey")).toBe("sess-main");
  });
});
