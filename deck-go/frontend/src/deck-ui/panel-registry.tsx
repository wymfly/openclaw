import type { ReactNode } from "react";
import {
  ActivityIcon,
  BarChartIcon,
  BellIcon,
  BotIcon,
  BrainIcon,
  ClockIcon,
  CpuIcon,
  FileCodeIcon,
  FileTextIcon,
  FingerprintIcon,
  GitBranchIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  MonitorDotIcon,
  NetworkIcon,
  ScrollTextIcon,
  ServerIcon,
  SettingsIcon,
  ShareIcon,
  ShieldCheckIcon,
  WalletIcon,
  WebhookIcon,
  WrenchIcon,
  ZapIcon,
  type IconComponent,
} from "./icons";

export type PanelGroup = "core" | "observe" | "automate" | "control" | "bottom";

export type PanelId =
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

export type PanelEntry = {
  id: PanelId;
  group: PanelGroup;
  label: string;
  labelKey: string;
  icon: IconComponent;
  importTarget: string;
  shortcutIndex?: number;
  position?: "bottom";
};

export const PANELS: PanelEntry[] = [
  {
    id: "chat",
    group: "core",
    label: "Chat",
    labelKey: "chat",
    icon: MessageSquareIcon,
    shortcutIndex: 1,
    importTarget: "@/components/panels/chat/ChatPanel",
  },
  {
    id: "agents",
    group: "core",
    label: "Agents",
    labelKey: "agents",
    icon: BotIcon,
    shortcutIndex: 2,
    importTarget: "@/components/panels/agents/AgentsPanel",
  },
  {
    id: "gateway",
    group: "core",
    label: "Gateway",
    labelKey: "gateway",
    icon: MonitorDotIcon,
    shortcutIndex: 3,
    importTarget: "@/components/panels/gateway/GatewayPanel",
  },
  {
    id: "models",
    group: "core",
    label: "Models",
    labelKey: "models",
    icon: CpuIcon,
    shortcutIndex: 4,
    importTarget: "@/components/panels/models/ModelsPanel",
  },
  {
    id: "usage",
    group: "observe",
    label: "Usage",
    labelKey: "usage",
    icon: BarChartIcon,
    shortcutIndex: 5,
    importTarget: "@/components/panels/usage/UsagePanel",
  },
  {
    id: "sessions",
    group: "observe",
    label: "Sessions",
    labelKey: "sessions",
    icon: ScrollTextIcon,
    shortcutIndex: 6,
    importTarget: "@/components/panels/sessions/SessionsPanel",
  },
  {
    id: "memory",
    group: "observe",
    label: "Memory",
    labelKey: "memory",
    icon: BrainIcon,
    shortcutIndex: 7,
    importTarget: "@/components/panels/memory/MemoryPanel",
  },
  {
    id: "logs",
    group: "observe",
    label: "Logs",
    labelKey: "logs",
    icon: FileTextIcon,
    shortcutIndex: 8,
    importTarget: "@/components/panels/logs/LogsPanel",
  },
  {
    id: "activity",
    group: "observe",
    label: "Activity",
    labelKey: "activity",
    icon: ActivityIcon,
    shortcutIndex: 9,
    importTarget: "@/components/panels/activity/ActivityPanel",
  },
  {
    id: "threads",
    group: "observe",
    label: "Threads",
    labelKey: "threads",
    icon: MessagesSquareIcon,
    importTarget: "@/components/panels/threads/ThreadsPanel",
  },
  {
    id: "api-explorer",
    group: "observe",
    label: "API Explorer",
    labelKey: "apiExplorer",
    icon: ZapIcon,
    importTarget: "@/components/panels/api-explorer/ApiExplorerPanel",
  },
  {
    id: "cron",
    group: "automate",
    label: "Cron",
    labelKey: "cron",
    icon: ClockIcon,
    importTarget: "@/components/panels/cron/CronPanel",
  },
  {
    id: "webhooks",
    group: "automate",
    label: "Webhooks",
    labelKey: "webhooks",
    icon: WebhookIcon,
    importTarget: "@/components/panels/webhooks/WebhooksPanel",
  },
  {
    id: "approvals",
    group: "automate",
    label: "Approvals",
    labelKey: "approvals",
    icon: ShieldCheckIcon,
    importTarget: "@/components/panels/approvals/ApprovalsPanel",
  },
  {
    id: "skills",
    group: "automate",
    label: "Skills",
    labelKey: "skills",
    icon: WrenchIcon,
    importTarget: "@/components/panels/skills/SkillsPanel",
  },
  {
    id: "budget",
    group: "control",
    label: "Budget",
    labelKey: "budget",
    icon: WalletIcon,
    importTarget: "@/components/panels/budget/BudgetPanel",
  },
  {
    id: "alerts",
    group: "control",
    label: "Alerts",
    labelKey: "alerts",
    icon: BellIcon,
    importTarget: "@/components/panels/alerts/AlertsPanel",
  },
  {
    id: "channels",
    group: "control",
    label: "Channels",
    labelKey: "channels",
    icon: ShareIcon,
    importTarget: "@/components/panels/channels/ChannelsPanel",
  },
  {
    id: "plugins",
    group: "control",
    label: "Plugins",
    labelKey: "plugins",
    icon: FileCodeIcon,
    importTarget: "@/components/panels/plugins/PluginsPanel",
  },
  {
    id: "routing",
    group: "control",
    label: "Routing",
    labelKey: "routing",
    icon: GitBranchIcon,
    importTarget: "@/components/panels/routing/RoutingPanel",
  },
  {
    id: "subagents",
    group: "control",
    label: "Subagents",
    labelKey: "subagents",
    icon: NetworkIcon,
    importTarget: "@/components/panels/subagents/SubagentsPanel",
  },
  {
    id: "identity",
    group: "control",
    label: "Identity",
    labelKey: "identity",
    icon: FingerprintIcon,
    importTarget: "@/components/panels/identity/IdentityPanel",
  },
  {
    id: "config",
    group: "control",
    label: "Config",
    labelKey: "config",
    icon: SettingsIcon,
    importTarget: "@/components/panels/config/ConfigPanel",
  },
  {
    id: "nodes",
    group: "control",
    label: "Nodes",
    labelKey: "nodes",
    icon: ServerIcon,
    importTarget: "@/components/panels/nodes/NodesPanel",
  },
  {
    id: "docs",
    group: "control",
    label: "Docs",
    labelKey: "docs",
    icon: FileCodeIcon,
    importTarget: "@/components/panels/docs/DocsPanel",
  },
  {
    id: "settings",
    group: "bottom",
    label: "Settings",
    labelKey: "settings",
    icon: SettingsIcon,
    importTarget: "@/components/panels/settings/SettingsPanel",
    position: "bottom",
  },
];

export function getPanelGroups() {
  const grouped: Array<{
    title: string;
    titleKey: string;
    group: PanelGroup;
    items: PanelEntry[];
  }> = [];
  const titles: Record<PanelGroup, string> = {
    core: "Core",
    observe: "Observe",
    automate: "Automate",
    control: "Control",
    bottom: "Bottom",
  };
  for (const group of ["core", "observe", "automate", "control"] as const) {
    grouped.push({
      title: titles[group],
      titleKey: group,
      group,
      items: PANELS.filter((panel) => panel.group === group),
    });
  }
  return grouped;
}

export function getBottomPanels() {
  return PANELS.filter((panel) => panel.position === "bottom");
}

export function getShortcutPanels() {
  return PANELS.filter((panel) => panel.shortcutIndex != null)
    .slice()
    .toSorted(
      (left: PanelEntry, right: PanelEntry) =>
        (left.shortcutIndex ?? 0) - (right.shortcutIndex ?? 0),
    );
}

export function findPanel(id: string): PanelEntry | null {
  return PANELS.find((panel) => panel.id === id) ?? null;
}

export function getPanelIndex(id: PanelId) {
  return PANELS.findIndex((panel) => panel.id === id);
}

export function getAdjacentPanel(id: PanelId, direction: "next" | "prev") {
  const index = getPanelIndex(id);
  if (index < 0) {
    return null;
  }
  const nextIndex =
    direction === "next"
      ? (index + 1) % PANELS.length
      : (index - 1 + PANELS.length) % PANELS.length;
  return PANELS[nextIndex] ?? null;
}

export function panelPlaceholderDescription(panel: PanelEntry): ReactNode {
  return (
    <>
      <strong>{panel.label}</strong>
      <div className="deckgo-meta">import: {panel.importTarget}</div>
    </>
  );
}
