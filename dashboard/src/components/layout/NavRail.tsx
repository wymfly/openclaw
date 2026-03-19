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
  Hexagon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useUIStore, type Panel } from "@/stores/ui";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

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

const settingsItem: NavItem = {
  panel: "settings",
  labelKey: "settings",
  icon: Settings,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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

  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true);
    }
  }, [isTablet, setSidebarCollapsed]);

  useEffect(() => {
    if (!isMobile && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [isMobile, mobileNavOpen, setMobileNavOpen]);

  const collapsed = isMobile ? false : sidebarCollapsed;

  const handleNavClick = (panel: Panel) => {
    setActivePanel(panel);
    if (isMobile) {
      setMobileNavOpen(false);
    }
  };

  /* ── Nav item renderer ── */

  const renderNavItem = (item: NavItem) => {
    const isActive = activePanel === item.panel;
    const Icon = item.icon;
    const label = t(item.labelKey);

    // Accent indicator bar — appears on the left edge of active items
    const indicator = isActive && (
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
        aria-hidden
      />
    );

    /* Collapsed: icon-only with tooltip */
    if (collapsed) {
      return (
        <Tooltip key={item.panel}>
          <TooltipTrigger
            render={
              <button
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center justify-center w-10 h-9 rounded-lg mx-auto cursor-pointer transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                )}
                onClick={() => handleNavClick(item.panel)}
              />
            }
          >
            {indicator}
            <Icon size={18} />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    /* Expanded: icon + label */
    return (
      <button
        key={item.panel}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-2.5 w-full h-8 px-3 rounded-lg text-[13px] font-medium cursor-pointer transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
          isActive
            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
        )}
        onClick={() => handleNavClick(item.panel)}
      >
        {indicator}
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  /* ── Nav body (shared between mobile sheet and desktop sidebar) ── */

  const navContent = (
    <div className="flex flex-col h-full">
      {/* ── Brand ── */}
      <div
        className={cn(
          "flex items-center shrink-0 h-14 border-b border-[var(--border-subtle)]",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-muted)]">
          <Hexagon size={18} className="text-[var(--accent)]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              OpenClaw
            </span>
            <span className="text-[10px] font-mono text-[var(--text-secondary)] leading-none">
              deck v0.1
            </span>
          </div>
        )}
      </div>

      {/* ── Groups ── */}
      <ScrollArea className="flex-1">
        <div className="py-3">
          {navGroups.map((group, i) => (
            <div key={group.titleKey} className={i > 0 ? "mt-5" : undefined}>
              {!collapsed && (
                <div className="px-4 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    {t(group.titleKey)}
                  </span>
                </div>
              )}
              {collapsed && i > 0 && <Separator className="mx-3 mb-2 bg-[var(--border-subtle)]" />}
              <div className={cn("space-y-0.5", collapsed ? "px-1" : "px-2")}>
                {group.items.map(renderNavItem)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Bottom: Settings + Collapse toggle ── */}
      <div className="shrink-0 border-t border-[var(--border-subtle)]">
        <div className={cn("py-1.5", collapsed ? "px-1" : "px-2")}>
          {renderNavItem(settingsItem)}
        </div>
        {!isMobile && (
          <div className={cn("pb-2.5", collapsed ? "flex justify-center px-1" : "px-2")}>
            <button
              className={cn(
                "flex items-center justify-center h-7 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                collapsed ? "w-10 mx-auto" : "w-full gap-2",
              )}
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
              {!collapsed && <span className="text-xs">Collapse</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Mobile: Sheet overlay ── */
  if (isMobile) {
    return (
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="data-[side=left]:w-64 data-[side=left]:sm:max-w-64 gap-0 p-0 bg-[var(--bg-nav)]"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <nav className="h-full">{navContent}</nav>
        </SheetContent>
      </Sheet>
    );
  }

  /* ── Desktop / Tablet: inline sidebar ── */
  return (
    <nav
      className={cn(
        "flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg-nav)] transition-[width] duration-200 ease-out shrink-0",
        collapsed ? "w-[56px]" : "w-56",
      )}
    >
      {navContent}
    </nav>
  );
}
