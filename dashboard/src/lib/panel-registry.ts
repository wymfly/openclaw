import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Clock,
  Cpu,
  FileCode,
  FileText,
  Fingerprint,
  GitBranch,
  MessageSquare,
  MessagesSquare,
  Network,
  Radio,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Wallet,
  Webhook,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { ChatPanel } from "@/components/panels/chat/ChatPanel";
import { useDevicesStore } from "@/stores/devices";

type PanelComponent = ComponentType | LazyExoticComponent<ComponentType>;

export interface PanelEntry {
  readonly id: string;
  readonly group: "core" | "observe" | "automate" | "control";
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly component: PanelComponent;
  readonly shortcutIndex?: number;
  readonly eager?: boolean;
  readonly position?: "bottom";
  readonly badge?: () => number;
}

export const PANELS = [
  {
    id: "chat",
    group: "core",
    icon: MessageSquare,
    labelKey: "chat",
    component: ChatPanel,
    shortcutIndex: 1,
    eager: true,
  },
  {
    id: "agents",
    group: "core",
    icon: Bot,
    labelKey: "agents",
    component: lazy(() =>
      import("@/components/panels/agents/AgentsPanel").then((m) => ({ default: m.AgentsPanel })),
    ),
    shortcutIndex: 2,
  },
  {
    id: "gateway",
    group: "core",
    icon: Radio,
    labelKey: "gateway",
    component: lazy(() =>
      import("@/components/panels/monitor/MonitorPanel").then((m) => ({ default: m.MonitorPanel })),
    ),
    shortcutIndex: 3,
  },
  {
    id: "models",
    group: "core",
    icon: Cpu,
    labelKey: "models",
    component: lazy(() =>
      import("@/components/panels/models/ModelsPanel").then((m) => ({ default: m.ModelsPanel })),
    ),
    shortcutIndex: 4,
  },
  {
    id: "usage",
    group: "observe",
    icon: BarChart3,
    labelKey: "usage",
    component: lazy(() =>
      import("@/components/panels/usage/UsagePanel").then((m) => ({ default: m.UsagePanel })),
    ),
    shortcutIndex: 5,
  },
  {
    id: "sessions",
    group: "observe",
    icon: ScrollText,
    labelKey: "sessions",
    component: lazy(() =>
      import("@/components/panels/sessions/SessionsPanel").then((m) => ({
        default: m.SessionsPanel,
      })),
    ),
    shortcutIndex: 6,
  },
  {
    id: "memory",
    group: "observe",
    icon: Brain,
    labelKey: "memory",
    component: lazy(() =>
      import("@/components/panels/memory/MemoryPanel").then((m) => ({ default: m.MemoryPanel })),
    ),
    shortcutIndex: 7,
  },
  {
    id: "logs",
    group: "observe",
    icon: FileText,
    labelKey: "logs",
    component: lazy(() =>
      import("@/components/panels/logs/LogsPanel").then((m) => ({ default: m.LogsPanel })),
    ),
    shortcutIndex: 8,
  },
  {
    id: "activity",
    group: "observe",
    icon: Activity,
    labelKey: "activity",
    component: lazy(() =>
      import("@/components/panels/activity/ActivityPanel").then((m) => ({
        default: m.ActivityPanel,
      })),
    ),
    shortcutIndex: 9,
  },
  {
    id: "threads",
    group: "observe",
    icon: MessagesSquare,
    labelKey: "threads",
    component: lazy(() =>
      import("@/components/panels/threads/ThreadsPanel").then((m) => ({ default: m.ThreadsPanel })),
    ),
  },
  {
    id: "cron",
    group: "automate",
    icon: Clock,
    labelKey: "cron",
    component: lazy(() =>
      import("@/components/panels/scheduler/SchedulerPanel").then((m) => ({
        default: m.SchedulerPanel,
      })),
    ),
  },
  {
    id: "webhooks",
    group: "automate",
    icon: Webhook,
    labelKey: "webhooks",
    component: lazy(() =>
      import("@/components/panels/webhooks/WebhooksPanel").then((m) => ({
        default: m.WebhooksPanel,
      })),
    ),
  },
  {
    id: "approvals",
    group: "automate",
    icon: ShieldCheck,
    labelKey: "approvals",
    component: lazy(() =>
      import("@/components/panels/approvals/ApprovalsPanel").then((m) => ({
        default: m.ApprovalsPanel,
      })),
    ),
  },
  {
    id: "skills",
    group: "automate",
    icon: Wrench,
    labelKey: "skills",
    component: lazy(() =>
      import("@/components/panels/skills/SkillsPanel").then((m) => ({ default: m.SkillsPanel })),
    ),
  },
  {
    id: "budget",
    group: "control",
    icon: Wallet,
    labelKey: "budget",
    component: lazy(() =>
      import("@/components/panels/budget/BudgetPanel").then((m) => ({ default: m.BudgetPanel })),
    ),
  },
  {
    id: "alerts",
    group: "control",
    icon: Bell,
    labelKey: "alerts",
    component: lazy(() =>
      import("@/components/panels/alerts/AlertsPanel").then((m) => ({ default: m.AlertsPanel })),
    ),
  },
  {
    id: "channels",
    group: "control",
    icon: Share2,
    labelKey: "channels",
    component: lazy(() =>
      import("@/components/panels/channels/ChannelsPanel").then((m) => ({
        default: m.ChannelsPanel,
      })),
    ),
  },
  {
    id: "routing",
    group: "control",
    icon: GitBranch,
    labelKey: "routing",
    component: lazy(() =>
      import("@/components/panels/routing/RoutingPanel").then((m) => ({ default: m.RoutingPanel })),
    ),
  },
  {
    id: "subagents",
    group: "control",
    icon: Network,
    labelKey: "subagents",
    component: lazy(() =>
      import("@/components/panels/subagents/SubagentsPanel").then((m) => ({
        default: m.SubagentsPanel,
      })),
    ),
  },
  {
    id: "identity",
    group: "control",
    icon: Fingerprint,
    labelKey: "identity",
    component: lazy(() =>
      import("@/components/panels/identity/IdentityPanel").then((m) => ({
        default: m.IdentityPanel,
      })),
    ),
  },
  {
    id: "config",
    group: "control",
    icon: Settings,
    labelKey: "config",
    component: lazy(() =>
      import("@/components/panels/config-editor/ConfigPanel").then((m) => ({
        default: m.ConfigPanel,
      })),
    ),
  },
  {
    id: "docs",
    group: "control",
    icon: FileCode,
    labelKey: "docs",
    component: lazy(() =>
      import("@/components/panels/docs/DocHubPanel").then((m) => ({ default: m.DocHubPanel })),
    ),
  },
  {
    id: "settings",
    group: "control",
    icon: Settings,
    labelKey: "settings",
    component: lazy(() =>
      import("@/components/panels/settings/SettingsPanel").then((m) => ({
        default: m.SettingsPanel,
      })),
    ),
    position: "bottom",
    badge: () => useDevicesStore.getState().pending.length,
  },
] as const satisfies readonly PanelEntry[];

export type Panel = (typeof PANELS)[number]["id"];

// Widen the const tuple to PanelEntry[] so helper filters can access optional fields.
const panels: readonly PanelEntry[] = PANELS;

export function getPanelGroups() {
  const groups = ["core", "observe", "automate", "control"] as const;
  return groups.map((g) => ({
    titleKey: g,
    items: panels.filter((p) => p.group === g && !p.position),
  }));
}

export function getBottomPanels() {
  return panels.filter((p) => p.position === "bottom");
}

export function getShortcutPanels() {
  return panels
    .filter((p) => p.shortcutIndex != null)
    .toSorted((a, b) => a.shortcutIndex! - b.shortcutIndex!);
}

export function findPanel(id: string) {
  return panels.find((p) => p.id === id);
}
