import type { ReactNode } from "react";

export type RestoredPanelGroup = "core" | "observe" | "automate" | "control" | "bottom";

export type RestoredPanelId =
  | "chat"
  | "agents"
  | "gateway"
  | "models"
  | "usage"
  | "sessions"
  | "memory"
  | "logs"
  | "activity"
  | "threads"
  | "api-explorer"
  | "cron"
  | "webhooks"
  | "approvals"
  | "skills"
  | "budget"
  | "alerts"
  | "channels"
  | "plugins"
  | "routing"
  | "subagents"
  | "identity"
  | "config"
  | "nodes"
  | "docs"
  | "settings";

export type RestoredPanelEntry = {
  id: RestoredPanelId;
  group: RestoredPanelGroup;
  label: string;
  monogram: string;
  importTarget: string;
  note?: string;
  shortcutIndex?: number;
  position?: "bottom";
};

export const RESTORED_PANELS: RestoredPanelEntry[] = [
  {
    id: "chat",
    group: "core",
    label: "Chat",
    monogram: "CH",
    shortcutIndex: 1,
    importTarget: "@/components/panels/chat/ChatPanel",
    note: "Legacy eager panel",
  },
  {
    id: "agents",
    group: "core",
    label: "Agents",
    monogram: "AG",
    shortcutIndex: 2,
    importTarget: "@/components/panels/agents/AgentsPanel",
  },
  {
    id: "gateway",
    group: "core",
    label: "Gateway",
    monogram: "GW",
    shortcutIndex: 3,
    importTarget: "@/components/panels/monitor/MonitorPanel",
    note: "Panel id differs from folder name",
  },
  {
    id: "models",
    group: "core",
    label: "Models",
    monogram: "MO",
    shortcutIndex: 4,
    importTarget: "@/components/panels/models/ModelsPanel",
  },
  {
    id: "usage",
    group: "observe",
    label: "Usage",
    monogram: "US",
    shortcutIndex: 5,
    importTarget: "@/components/panels/usage/UsagePanel",
  },
  {
    id: "sessions",
    group: "observe",
    label: "Sessions",
    monogram: "SE",
    shortcutIndex: 6,
    importTarget: "@/components/panels/sessions/SessionsPanel",
  },
  {
    id: "memory",
    group: "observe",
    label: "Memory",
    monogram: "ME",
    shortcutIndex: 7,
    importTarget: "@/components/panels/memory/MemoryPanel",
  },
  {
    id: "logs",
    group: "observe",
    label: "Logs",
    monogram: "LO",
    shortcutIndex: 8,
    importTarget: "@/components/panels/logs/LogsPanel",
  },
  {
    id: "activity",
    group: "observe",
    label: "Activity",
    monogram: "AC",
    shortcutIndex: 9,
    importTarget: "@/components/panels/activity/ActivityPanel",
  },
  {
    id: "threads",
    group: "observe",
    label: "Threads",
    monogram: "TH",
    importTarget: "@/components/panels/threads/ThreadsPanel",
  },
  {
    id: "api-explorer",
    group: "observe",
    label: "API Explorer",
    monogram: "AX",
    importTarget: "@/components/panels/api-explorer/ApiExplorerPanel",
  },
  {
    id: "cron",
    group: "automate",
    label: "Cron",
    monogram: "CR",
    importTarget: "@/components/panels/scheduler/SchedulerPanel",
    note: "Registry points to scheduler panel",
  },
  {
    id: "webhooks",
    group: "automate",
    label: "Webhooks",
    monogram: "WH",
    importTarget: "@/components/panels/webhooks/WebhooksPanel",
  },
  {
    id: "approvals",
    group: "automate",
    label: "Approvals",
    monogram: "AP",
    importTarget: "@/components/panels/approvals/ApprovalsPanel",
  },
  {
    id: "skills",
    group: "automate",
    label: "Skills",
    monogram: "SK",
    importTarget: "@/components/panels/skills/SkillsPanel",
  },
  {
    id: "budget",
    group: "control",
    label: "Budget",
    monogram: "BU",
    importTarget: "@/components/panels/budget/BudgetPanel",
  },
  {
    id: "alerts",
    group: "control",
    label: "Alerts",
    monogram: "AL",
    importTarget: "@/components/panels/alerts/AlertsPanel",
  },
  {
    id: "channels",
    group: "control",
    label: "Channels",
    monogram: "CN",
    importTarget: "@/components/panels/channels/ChannelsPanel",
  },
  {
    id: "plugins",
    group: "control",
    label: "Plugins",
    monogram: "PL",
    importTarget: "@/components/panels/plugins/PluginsPanel",
  },
  {
    id: "routing",
    group: "control",
    label: "Routing",
    monogram: "RT",
    importTarget: "@/components/panels/routing/RoutingPanel",
  },
  {
    id: "subagents",
    group: "control",
    label: "Subagents",
    monogram: "SA",
    importTarget: "@/components/panels/subagents/SubagentsPanel",
  },
  {
    id: "identity",
    group: "control",
    label: "Identity",
    monogram: "ID",
    importTarget: "@/components/panels/identity/IdentityPanel",
  },
  {
    id: "config",
    group: "control",
    label: "Config",
    monogram: "CF",
    importTarget: "@/components/panels/config-editor/ConfigPanel",
  },
  {
    id: "nodes",
    group: "control",
    label: "Nodes",
    monogram: "NO",
    importTarget: "@/components/panels/nodes/NodeManagementPanel",
  },
  {
    id: "docs",
    group: "control",
    label: "Docs",
    monogram: "DO",
    importTarget: "@/components/panels/docs/DocHubPanel",
  },
  {
    id: "settings",
    group: "bottom",
    label: "Settings",
    monogram: "ST",
    importTarget: "@/components/panels/settings/SettingsPanel",
    position: "bottom",
  },
];

export function getRestoredPanelGroups() {
  const grouped: Array<{ title: string; group: RestoredPanelGroup; items: RestoredPanelEntry[] }> =
    [];
  const titles: Record<RestoredPanelGroup, string> = {
    core: "Core",
    observe: "Observe",
    automate: "Automate",
    control: "Control",
    bottom: "Bottom",
  };
  for (const group of ["core", "observe", "automate", "control"] as const) {
    grouped.push({
      title: titles[group],
      group,
      items: RESTORED_PANELS.filter((panel) => panel.group === group),
    });
  }
  return grouped;
}

export function getRestoredBottomPanels() {
  return RESTORED_PANELS.filter((panel) => panel.position === "bottom");
}

export function getRestoredShortcutPanels() {
  return RESTORED_PANELS.filter((panel) => panel.shortcutIndex != null)
    .slice()
    .sort(
      (left: RestoredPanelEntry, right: RestoredPanelEntry) =>
        (left.shortcutIndex ?? 0) - (right.shortcutIndex ?? 0),
    );
}

export function findRestoredPanel(id: string): RestoredPanelEntry | null {
  return RESTORED_PANELS.find((panel) => panel.id === id) ?? null;
}

export function getRestoredPanelIndex(id: RestoredPanelId) {
  return RESTORED_PANELS.findIndex((panel) => panel.id === id);
}

export function getAdjacentRestoredPanel(id: RestoredPanelId, direction: "next" | "prev") {
  const index = getRestoredPanelIndex(id);
  if (index < 0) {
    return null;
  }
  const nextIndex =
    direction === "next"
      ? (index + 1) % RESTORED_PANELS.length
      : (index - 1 + RESTORED_PANELS.length) % RESTORED_PANELS.length;
  return RESTORED_PANELS[nextIndex] ?? null;
}

export function panelPlaceholderDescription(panel: RestoredPanelEntry): ReactNode {
  return (
    <>
      <strong>{panel.label}</strong>
      <div className="deckgo-meta">import: {panel.importTarget}</div>
      {panel.note ? <div className="deckgo-meta">{panel.note}</div> : null}
    </>
  );
}
