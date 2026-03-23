/**
 * Shared cross-panel navigation helpers.
 *
 * Each function atomically sets the active panel and pre-selects the target
 * entity so the destination panel opens with the right context.
 */

import { useAgentsStore } from "@/stores/agents";
import { useChannelsStore } from "@/stores/channels";
import { useDeckRoutingStore } from "@/stores/deck-routing";
import { useSessionsStore } from "@/stores/sessions";
import { useUIStore } from "@/stores/ui";

// ---------------------------------------------------------------------------
// Agent panel
// ---------------------------------------------------------------------------

export type AgentTab = "overview" | "routing" | "skills" | "context" | "subagent" | "sessions";

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

/**
 * Navigate to the routing panel. If `agentId` is provided the binding table
 * will refetch with that agent filter pre-applied.
 */
export function navigateToRouting(agentId?: string) {
  useUIStore.getState().setActivePanel("routing");
  if (agentId) {
    void useDeckRoutingStore.getState().fetchBindings(agentId);
  }
}

// ---------------------------------------------------------------------------
// Channels panel
// ---------------------------------------------------------------------------

/** Navigate to the channels panel, selecting a specific channel. */
export function navigateToChannel(channelId: string) {
  useChannelsStore.getState().selectChannel(channelId);
  useUIStore.getState().setActivePanel("channels");
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
