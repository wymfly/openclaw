"use client";

import { Globe, Menu, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useGatewayStore } from "@/stores/gateway";
import { useUIStore } from "@/stores/ui";

const statusBadgeStyles: Record<string, string> = {
  connected: "bg-[var(--success-muted)] text-[var(--success-muted-text)]",
  disconnected: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
  reconnecting: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
  connecting: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
};

const statusDotStyles: Record<string, string> = {
  connected: "bg-[var(--status-connected)]",
  disconnected: "bg-[var(--status-disconnected)]",
  reconnecting: "bg-[var(--status-reconnecting)]",
  connecting: "bg-[var(--status-reconnecting)]",
  error: "bg-[var(--status-disconnected)]",
};

export function HeaderBar() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const { status } = useGatewayStore();
  const { activePanel, theme, locale, setTheme, setLocale, setMobileNavOpen } = useUIStore();

  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  const statusLabel =
    status === "connected"
      ? tHeader("connected")
      : status === "reconnecting" || status === "connecting"
        ? tHeader("reconnecting")
        : tHeader("disconnected");

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("system");
    } else {
      setTheme("dark");
    }
  };

  const toggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-card shrink-0">
      {/* Left: hamburger (mobile) + panel name */}
      <div className="flex items-center gap-2">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={18} />
          </Button>
        )}
        <h1 className="text-sm font-semibold text-foreground">{tNav(activePanel)}</h1>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Gateway status badge */}
        <Badge
          className={cn(
            "gap-1.5 font-normal",
            statusBadgeStyles[status] ?? statusBadgeStyles.disconnected,
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              statusDotStyles[status] ?? statusDotStyles.disconnected,
            )}
          />
          {!isMobile && statusLabel}
        </Badge>

        {/* Locale toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs text-muted-foreground"
          onClick={toggleLocale}
        >
          <Globe size={14} />
          {locale === "zh" ? "EN" : "ZH"}
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>
    </header>
  );
}
