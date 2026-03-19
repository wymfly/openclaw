"use client";

import { Globe, Menu, Moon, Sun, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useGatewayStore } from "@/stores/gateway";
import { useUIStore } from "@/stores/ui";

/* ------------------------------------------------------------------ */
/*  Status configuration                                               */
/* ------------------------------------------------------------------ */

const statusConfig: Record<string, { dot: string; bg: string; pulse: boolean }> = {
  connected: {
    dot: "bg-[var(--status-connected)]",
    bg: "bg-[var(--success-muted)] text-[var(--success-muted-text)] border-[var(--success-muted)]",
    pulse: true,
  },
  disconnected: {
    dot: "bg-[var(--status-disconnected)]",
    bg: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-[var(--danger-muted)]",
    pulse: false,
  },
  reconnecting: {
    dot: "bg-[var(--status-reconnecting)]",
    bg: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-[var(--warning-muted)]",
    pulse: true,
  },
  connecting: {
    dot: "bg-[var(--status-reconnecting)]",
    bg: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-[var(--warning-muted)]",
    pulse: true,
  },
  error: {
    dot: "bg-[var(--status-disconnected)]",
    bg: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-[var(--danger-muted)]",
    pulse: false,
  },
};

const themeIcons = { dark: Sun, light: Moon, system: Monitor } as const;
const themeNext = { dark: "light", light: "system", system: "dark" } as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HeaderBar() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const router = useRouter();
  const { status } = useGatewayStore();
  const { activePanel, theme, locale, setTheme, setLocale, setMobileNavOpen } = useUIStore();

  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  const statusLabel =
    status === "connected"
      ? tHeader("connected")
      : status === "reconnecting" || status === "connecting"
        ? tHeader("reconnecting")
        : tHeader("disconnected");

  const cfg = statusConfig[status] ?? statusConfig.disconnected;
  const ThemeIcon = themeIcons[theme];

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
      {/* ── Left: hamburger (mobile) + panel name ── */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          {tNav(activePanel)}
        </h1>
      </div>

      {/* ── Right: status + controls ── */}
      <div className="flex items-center gap-1.5">
        {/* Gateway status pill */}
        <div
          className={cn(
            "flex items-center gap-1.5 h-6 rounded-full text-[11px] font-medium border px-2.5",
            cfg.bg,
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              cfg.dot,
              cfg.pulse && "animate-pulse",
            )}
          />
          {!isMobile && <span>{statusLabel}</span>}
        </div>

        {/* Divider */}
        <span className="w-px h-4 bg-[var(--border)] mx-1" aria-hidden />

        {/* Locale toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className="flex items-center gap-1 h-7 px-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                onClick={() => {
                  const next = locale === "zh" ? "en" : "zh";
                  document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
                  setLocale(next);
                  router.refresh();
                }}
              />
            }
          >
            <Globe size={14} />
            <span className="font-mono text-[11px]">{locale === "zh" ? "EN" : "ZH"}</span>
          </TooltipTrigger>
          <TooltipContent>{locale === "zh" ? "Switch to English" : "切换到中文"}</TooltipContent>
        </Tooltip>

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                onClick={() => setTheme(themeNext[theme])}
              />
            }
          >
            <ThemeIcon size={15} />
          </TooltipTrigger>
          <TooltipContent>
            {theme === "dark" ? "Light mode" : theme === "light" ? "System" : "Dark mode"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
