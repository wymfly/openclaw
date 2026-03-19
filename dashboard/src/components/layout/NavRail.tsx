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
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
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

const settingsItem: NavItem = {
  panel: "settings",
  labelKey: "settings",
  icon: Settings,
};

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

  const collapsed = isMobile ? false : sidebarCollapsed;

  const handleNavClick = (panel: Panel) => {
    setActivePanel(panel);
    if (isMobile) {
      setMobileNavOpen(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activePanel === item.panel;
    const Icon = item.icon;
    const label = t(item.labelKey);
    const activeClass = isActive
      ? "bg-primary/12 text-primary hover:bg-primary/15 hover:text-primary"
      : "";

    if (collapsed) {
      return (
        <Tooltip key={item.panel}>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={cn("w-full justify-center", activeClass)}
                onClick={() => handleNavClick(item.panel)}
              />
            }
          >
            <Icon size={16} />
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Button
        key={item.panel}
        variant="ghost"
        size="sm"
        className={cn("w-full justify-start gap-2.5", activeClass)}
        onClick={() => handleNavClick(item.panel)}
      >
        <Icon size={16} />
        <span className="truncate">{label}</span>
      </Button>
    );
  };

  const navBody = (
    <>
      <div className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group, i) => (
          <div key={group.titleKey}>
            {i > 0 && <Separator className="my-2" />}
            {!collapsed && (
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(group.titleKey)}
              </div>
            )}
            <div className="px-1.5 space-y-0.5">{group.items.map(renderNavItem)}</div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="py-2 px-1.5">{renderNavItem(settingsItem)}</div>
    </>
  );

  // Mobile: Sheet overlay
  if (isMobile) {
    return (
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="data-[side=left]:w-64 data-[side=left]:sm:max-w-64 gap-0 p-0 bg-[var(--bg-nav)]"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <nav className="flex flex-col h-full">{navBody}</nav>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop / Tablet: inline sidebar
  return (
    <nav
      className={cn(
        "flex flex-col h-full border-r border-border bg-[var(--bg-nav)] transition-all duration-200",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="mx-auto my-1 text-muted-foreground"
        onClick={toggleSidebar}
      >
        {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
      </Button>
      {navBody}
    </nav>
  );
}
