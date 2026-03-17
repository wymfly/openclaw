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
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
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
  const {
    sidebarCollapsed,
    mobileNavOpen,
    activePanel,
    toggleSidebar,
    setSidebarCollapsed,
    setMobileNavOpen,
    setActivePanel,
  } = useUIStore();

  const isTablet = useMediaQuery(BREAKPOINTS.tablet);
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  // Auto-collapse sidebar on tablet breakpoint
  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true);
    }
  }, [isTablet, setSidebarCollapsed]);

  // Close mobile overlay when switching away from mobile
  useEffect(() => {
    if (!isMobile && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [isMobile, mobileNavOpen, setMobileNavOpen]);

  // On mobile, NavRail is hidden unless mobileNavOpen is true (overlay mode)
  if (isMobile && !mobileNavOpen) {
    return null;
  }

  // Determine if we show collapsed (icon-only) view
  const collapsed = isMobile ? false : sidebarCollapsed;

  const handleNavClick = (panel: Panel) => {
    setActivePanel(panel);
    // Close overlay on mobile after selecting a panel
    if (isMobile) {
      setMobileNavOpen(false);
    }
  };

  const navContent = (
    <nav
      className={`flex flex-col h-full border-r transition-all duration-200 ${
        isMobile ? "w-64" : collapsed ? "w-14" : "w-52"
      }`}
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-nav)",
      }}
    >
      {/* Header: collapse toggle (desktop/tablet) or close button (mobile) */}
      <button
        onClick={() => {
          if (isMobile) {
            setMobileNavOpen(false);
          } else {
            toggleSidebar();
          }
        }}
        className="flex items-center justify-center h-12 hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-secondary)" }}
      >
        {isMobile ? (
          <X size={18} />
        ) : collapsed ? (
          <PanelLeft size={18} />
        ) : (
          <PanelLeftClose size={18} />
        )}
      </button>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="mb-3">
            {!collapsed && (
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
                  onClick={() => handleNavClick(item.panel)}
                  className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
                    collapsed ? "justify-center" : ""
                  }`}
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-primary)",
                    backgroundColor: isActive
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "transparent",
                  }}
                  title={collapsed ? t(item.labelKey) : undefined}
                >
                  <Icon size={16} />
                  {!collapsed && <span>{t(item.labelKey)}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom: Settings */}
      <div className="border-t py-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => handleNavClick("settings")}
          className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
          style={{
            color: activePanel === "settings" ? "var(--accent)" : "var(--text-primary)",
            backgroundColor:
              activePanel === "settings"
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
          }}
          title={collapsed ? t("settings") : undefined}
        >
          <Settings size={16} />
          {!collapsed && <span>{t("settings")}</span>}
        </button>
      </div>
    </nav>
  );

  // Mobile: render as overlay with backdrop
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex"
        onClick={(e) => {
          // Close when clicking backdrop (not the nav itself)
          if (e.target === e.currentTarget) {
            setMobileNavOpen(false);
          }
        }}
      >
        {navContent}
        {/* Backdrop */}
        <div
          className="flex-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onClick={() => setMobileNavOpen(false)}
        />
      </div>
    );
  }

  return navContent;
}
