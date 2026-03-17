"use client";

import {
  MessageSquare,
  Bot,
  Radio,
  Cpu,
  BarChart3,
  ScrollText,
  Brain,
  FileText,
  Activity,
  Clock,
  Webhook,
  ShieldCheck,
  Wrench,
  Wallet,
  Bell,
  Share2,
  Settings,
  FileCode,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useUIStore, type Panel } from "@/stores/ui";

interface NavItem {
  panel: Panel;
  labelKey: string;
  icon: LucideIcon;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    titleKey: "core",
    items: [
      { panel: "chat", labelKey: "chat", icon: MessageSquare },
      { panel: "agents", labelKey: "agents", icon: Bot },
      { panel: "gateway", labelKey: "gateway", icon: Radio },
      { panel: "models", labelKey: "models", icon: Cpu },
    ],
  },
  {
    titleKey: "observe",
    items: [
      { panel: "usage", labelKey: "usage", icon: BarChart3 },
      { panel: "sessions", labelKey: "sessions", icon: ScrollText },
      { panel: "memory", labelKey: "memory", icon: Brain },
      { panel: "logs", labelKey: "logs", icon: FileText },
      { panel: "activity", labelKey: "activity", icon: Activity },
    ],
  },
  {
    titleKey: "automate",
    items: [
      { panel: "cron", labelKey: "cron", icon: Clock },
      { panel: "webhooks", labelKey: "webhooks", icon: Webhook },
      { panel: "approvals", labelKey: "approvals", icon: ShieldCheck },
      { panel: "skills", labelKey: "skills", icon: Wrench },
    ],
  },
  {
    titleKey: "control",
    items: [
      { panel: "budget", labelKey: "budget", icon: Wallet },
      { panel: "alerts", labelKey: "alerts", icon: Bell },
      { panel: "channels", labelKey: "channels", icon: Share2 },
      { panel: "config", labelKey: "config", icon: Settings },
      { panel: "docs", labelKey: "docs", icon: FileCode },
    ],
  },
];

export function NavRail() {
  const t = useTranslations("nav");
  const { sidebarCollapsed, activePanel, toggleSidebar, setActivePanel } = useUIStore();

  return (
    <nav
      className={`flex flex-col h-full border-r transition-all duration-200 ${
        sidebarCollapsed ? "w-14" : "w-52"
      }`}
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-nav)",
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-secondary)" }}
      >
        {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="mb-3">
            {!sidebarCollapsed && (
              <div
                className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                {t(group.titleKey)}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = activePanel === item.panel;
              const Icon = item.icon;
              return (
                <button
                  key={item.panel}
                  onClick={() => setActivePanel(item.panel)}
                  className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
                    sidebarCollapsed ? "justify-center" : ""
                  }`}
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-primary)",
                    backgroundColor: isActive ? "var(--accent)" : "transparent",
                    ...(isActive
                      ? {
                          backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                        }
                      : {}),
                  }}
                  title={sidebarCollapsed ? t(item.labelKey) : undefined}
                >
                  <Icon size={16} />
                  {!sidebarCollapsed && <span>{t(item.labelKey)}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom: Settings */}
      <div className="border-t py-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setActivePanel("settings")}
          className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
            sidebarCollapsed ? "justify-center" : ""
          }`}
          style={{
            color: activePanel === "settings" ? "var(--accent)" : "var(--text-primary)",
            backgroundColor:
              activePanel === "settings"
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
          }}
          title={sidebarCollapsed ? t("settings") : undefined}
        >
          <Settings size={16} />
          {!sidebarCollapsed && <span>{t("settings")}</span>}
        </button>
      </div>
    </nav>
  );
}
