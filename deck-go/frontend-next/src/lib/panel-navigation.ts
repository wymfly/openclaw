/**
 * Shared cross-panel navigation helpers.
 *
 * Each function atomically sets the active panel and pre-selects the target
 * entity so the destination panel opens with the right context.
 */

import { useAgentsStore } from "@/stores/agents";
import { useChannelsStore } from "@/stores/channels";
import { useDeckRoutingStore } from "@/stores/deck-routing";
import { usePluginsStore } from "@/stores/plugins";
import { useSessionsStore } from "@/stores/sessions";
import { useUIStore } from "@/stores/ui";

// ---------------------------------------------------------------------------
// Agent panel
// ---------------------------------------------------------------------------

export type AgentTab =
  | "overview"
  | "config"
  | "routing"
  | "skills"
  | "context"
  | "subagent"
  | "sessions";

/**
 * Navigate to the agents panel, select a specific agent, and optionally
 * switch to a particular tab inside AgentDetail.
 *
 * The `pendingTab` value is stored in the agents store so AgentDetail can
 * pick it up on mount/update and reset to the requested tab.
 */
export function navigateToAgent(agentId: string, tab?: AgentTab) {
  useAgentsStore.getState().selectAgent(agentId);
  if (tab) {
    useAgentsStore.getState().setPendingTab(tab);
  }
  useUIStore.getState().setActivePanel("agents");
}

// ---------------------------------------------------------------------------
// Routing panel
// ---------------------------------------------------------------------------

type RoutingNavigationTarget =
  | string
  | {
      channelId?: string;
      accountId?: string;
    };

/**
 * Navigate to the routing panel.
 *
 * - `string` preserves the existing agent-centric filter behavior.
 * - `{ channelId, accountId }` preloads the standalone simulator with channel
 *   context so Channel → Routing handoffs keep operator scope.
 */
export function navigateToRouting(target?: RoutingNavigationTarget) {
  useUIStore.getState().setActivePanel("routing");
  if (typeof target === "string" && target) {
    void useDeckRoutingStore.getState().fetchBindings(target);
    return;
  }
  const simulatorTarget = typeof target === "string" ? null : (target ?? null);
  useDeckRoutingStore.getState().setPendingSimulatorInput(
    simulatorTarget?.channelId || simulatorTarget?.accountId
      ? {
          channel: simulatorTarget.channelId,
          accountId: simulatorTarget.accountId,
        }
      : null,
  );
}

// ---------------------------------------------------------------------------
// Channels panel
// ---------------------------------------------------------------------------

/** Navigate to the channels panel, selecting a specific channel. */
export function navigateToChannel(channelId: string) {
  useChannelsStore.getState().setPendingAccessTarget(null);
  useChannelsStore.getState().selectChannel(channelId);
  useUIStore.getState().setActivePanel("channels");
}

/** Navigate to a channel and open its Access surface when available. */
export function navigateToChannelAccess(channelId: string, accountId?: string) {
  useChannelsStore.getState().setPendingAccessTarget({ channelId, accountId });
  useChannelsStore.getState().selectChannel(channelId);
  useUIStore.getState().setActivePanel("channels");
}

// ---------------------------------------------------------------------------
// Plugins panel
// ---------------------------------------------------------------------------

/** Navigate to the plugins panel, preselecting a specific plugin when known. */
export function navigateToPlugin(pluginId?: string) {
  usePluginsStore.getState().selectPlugin(pluginId ?? null);
  useUIStore.getState().setActivePanel("plugins");
}

// ---------------------------------------------------------------------------
// Sessions panel
// ---------------------------------------------------------------------------

/** Navigate to the sessions panel, selecting a specific session. */
export function navigateToSession(sessionKey: string) {
  useSessionsStore.getState().selectSession(sessionKey);
  useUIStore.getState().setActivePanel("sessions");
}

// ---------------------------------------------------------------------------
// Subagents panel
// ---------------------------------------------------------------------------

/** Navigate to the subagents panel. */
export function navigateToSubagents() {
  useUIStore.getState().setActivePanel("subagents");
}
