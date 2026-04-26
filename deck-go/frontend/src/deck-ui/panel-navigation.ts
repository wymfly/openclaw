import type { PanelId } from "./panel-registry";
import type { DeckUIState } from "./types";

export type RoutingNavigationTarget =
  | string
  | {
      agentId?: string;
      channelId?: string;
      accountId?: string;
    };

export type AgentNavigationTarget =
  | string
  | {
      agentId?: string;
      tab?: string;
    };

export type ChannelNavigationTarget =
  | string
  | {
      accountId?: string;
      channelId?: string;
      section?: "access";
    };

export type PluginNavigationTarget =
  | string
  | {
      pluginId?: string;
    };

export type SessionNavigationTarget =
  | string
  | {
      sessionKey?: string;
    };

function normalizeAgentTarget(target?: AgentNavigationTarget, tab?: string) {
  if (typeof target === "string") {
    return { agentId: target, tab };
  }
  return target;
}

function writeAgentTargetToUrl(target?: AgentNavigationTarget, tab?: string) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedTarget = normalizeAgentTarget(target, tab);
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "agents");
  if (normalizedTarget?.agentId?.trim()) {
    url.searchParams.set("agentId", normalizedTarget.agentId.trim());
  } else {
    url.searchParams.delete("agentId");
  }
  if (normalizedTarget?.tab?.trim()) {
    url.searchParams.set("agentTab", normalizedTarget.tab.trim());
  } else {
    url.searchParams.delete("agentTab");
  }
  window.history.replaceState({}, "", url);
}

function normalizeChannelTarget(target?: ChannelNavigationTarget) {
  if (typeof target === "string") {
    return { channelId: target };
  }
  return target;
}

function writeChannelTargetToUrl(target?: ChannelNavigationTarget) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedTarget = normalizeChannelTarget(target);
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "channels");
  if (normalizedTarget?.channelId?.trim()) {
    url.searchParams.set("channelId", normalizedTarget.channelId.trim());
  } else {
    url.searchParams.delete("channelId");
  }
  if (normalizedTarget?.section) {
    url.searchParams.set("channelSection", normalizedTarget.section);
  } else {
    url.searchParams.delete("channelSection");
  }
  if (normalizedTarget?.accountId?.trim()) {
    url.searchParams.set("channelAccountId", normalizedTarget.accountId.trim());
  } else {
    url.searchParams.delete("channelAccountId");
  }
  window.history.replaceState({}, "", url);
}

function normalizePluginTarget(target?: PluginNavigationTarget) {
  if (typeof target === "string") {
    return { pluginId: target };
  }
  return target;
}

function writePluginTargetToUrl(target?: PluginNavigationTarget) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedTarget = normalizePluginTarget(target);
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "plugins");
  if (normalizedTarget?.pluginId?.trim()) {
    url.searchParams.set("pluginId", normalizedTarget.pluginId.trim());
  } else {
    url.searchParams.delete("pluginId");
  }
  window.history.replaceState({}, "", url);
}

function normalizeRoutingTarget(target?: RoutingNavigationTarget) {
  if (typeof target === "string") {
    return { agentId: target };
  }
  return target;
}

function writeRoutingTargetToUrl(target?: RoutingNavigationTarget) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedTarget = normalizeRoutingTarget(target);
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "routing");
  if (normalizedTarget?.agentId?.trim()) {
    url.searchParams.set("routingAgentId", normalizedTarget.agentId.trim());
  } else {
    url.searchParams.delete("routingAgentId");
  }
  if (normalizedTarget?.channelId?.trim()) {
    url.searchParams.set("routingChannel", normalizedTarget.channelId.trim());
  } else {
    url.searchParams.delete("routingChannel");
  }
  if (normalizedTarget?.accountId?.trim()) {
    url.searchParams.set("routingAccountId", normalizedTarget.accountId.trim());
  } else {
    url.searchParams.delete("routingAccountId");
  }
  window.history.replaceState({}, "", url);
}

function normalizeSessionTarget(target?: SessionNavigationTarget) {
  if (typeof target === "string") {
    return { sessionKey: target };
  }
  return target;
}

function writeSessionTargetToUrl(target?: SessionNavigationTarget) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedTarget = normalizeSessionTarget(target);
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "sessions");
  if (normalizedTarget?.sessionKey?.trim()) {
    url.searchParams.set("sessionKey", normalizedTarget.sessionKey.trim());
  } else {
    url.searchParams.delete("sessionKey");
  }
  window.history.replaceState({}, "", url);
}

export function navigateToPanel(ui: Pick<DeckUIState, "setActivePanel">, panel: PanelId) {
  ui.setActivePanel(panel);
}

export function navigateToAgent(
  ui: Pick<DeckUIState, "setActivePanel">,
  target?: AgentNavigationTarget,
  tab?: string,
) {
  writeAgentTargetToUrl(target, tab);
  ui.setActivePanel("agents");
}

export function navigateToRouting(
  ui: Pick<DeckUIState, "setActivePanel">,
  target?: RoutingNavigationTarget,
) {
  writeRoutingTargetToUrl(target);
  ui.setActivePanel("routing");
}

export function navigateToChannel(
  ui: Pick<DeckUIState, "setActivePanel">,
  target?: ChannelNavigationTarget,
) {
  writeChannelTargetToUrl(target);
  ui.setActivePanel("channels");
}

export function navigateToChannelAccess(
  ui: Pick<DeckUIState, "setActivePanel">,
  target: ChannelNavigationTarget,
  accountId?: string,
) {
  const normalizedTarget = normalizeChannelTarget(target);
  writeChannelTargetToUrl({
    ...normalizedTarget,
    accountId: accountId ?? normalizedTarget?.accountId,
    section: "access",
  });
  ui.setActivePanel("channels");
}

export function navigateToPlugin(
  ui: Pick<DeckUIState, "setActivePanel">,
  target?: PluginNavigationTarget,
) {
  writePluginTargetToUrl(target);
  ui.setActivePanel("plugins");
}

export function navigateToSession(
  ui: Pick<DeckUIState, "setActivePanel">,
  target?: SessionNavigationTarget,
) {
  writeSessionTargetToUrl(target);
  ui.setActivePanel("sessions");
}

export function navigateToSubagents(ui: Pick<DeckUIState, "setActivePanel">) {
  ui.setActivePanel("subagents");
}
