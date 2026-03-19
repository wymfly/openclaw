"use client";

import { Moon, Sun, Monitor, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { useUIStore, type Theme } from "@/stores/ui";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const THEMES: { value: Theme; labelKey: string; icon: LucideIcon }[] = [
  { value: "system", labelKey: "themeSystem", icon: Monitor },
  { value: "dark", labelKey: "themeDark", icon: Moon },
  { value: "light", labelKey: "themeLight", icon: Sun },
];

const LANGUAGES: { value: Locale; label: string; flag: string }[] = [
  { value: "zh", label: "中文", flag: "ZH" },
  { value: "en", label: "English", flag: "EN" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AppearanceSection() {
  const t = useTranslations("settings");
  const theme = useUIStore((s) => s.theme);
  const locale = useUIStore((s) => s.locale);
  const setTheme = useUIStore((s) => s.setTheme);
  const setLocale = useUIStore((s) => s.setLocale);

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] mb-3">
          {t("theme")}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(({ value, labelKey, icon: Icon }) => {
            const isActive = theme === value;
            return (
              <Card
                key={value}
                className={cn(
                  "cursor-pointer transition-all duration-150 card-hover",
                  isActive
                    ? "ring-1 ring-[var(--accent)] shadow-[0_0_8px_var(--accent)]/20"
                    : "ring-1 ring-[var(--border)]",
                )}
                onClick={() => setTheme(value)}
              >
                <CardContent className="flex flex-col items-center gap-2 py-3 px-2">
                  <div
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]",
                    )}
                  >
                    {t(labelKey)}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Language */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] mb-3">
          {t("language")}
        </h3>
        <div className="flex gap-2">
          {LANGUAGES.map(({ value, label, flag }) => {
            const isActive = locale === value;
            return (
              <button
                key={value}
                onClick={() => setLocale(value)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                )}
              >
                <span className="font-mono text-[11px] font-semibold opacity-70">{flag}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
