"use client";

import { Paintbrush, Radio, Bell, Info, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { ConnectionSection } from "./ConnectionSection";
import { NotificationSection } from "./NotificationSection";

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                     */
/* ------------------------------------------------------------------ */

interface SettingsTab {
  id: string;
  labelKey: string;
  icon: LucideIcon;
}

const TABS: SettingsTab[] = [
  { id: "appearance", labelKey: "appearance", icon: Paintbrush },
  { id: "connection", labelKey: "connection", icon: Radio },
  { id: "notifications", labelKey: "notifications", icon: Bell },
  { id: "about", labelKey: "about", icon: Info },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SettingsPanel() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);
  const [activeTab, setActiveTab] = useState("appearance");

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* ── Left tab rail ── */}
      <nav className="flex flex-col w-44 shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            {t("title")}
          </h2>
        </div>
        <div className="flex-1 px-2 py-1 space-y-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2.5 w-full h-8 px-3 rounded-lg text-[13px] font-medium cursor-pointer transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                )}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    aria-hidden
                  />
                )}
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Content area ── */}
      <ScrollArea className="flex-1">
        <div className="p-5 max-w-lg">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium bg-[var(--danger-muted)] text-[var(--danger-muted-text)] ring-1 ring-[var(--danger)]/20">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              {tc("loading")}
            </div>
          ) : (
            <div className="transition-panel">
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "connection" && <ConnectionSection />}
              {activeTab === "notifications" && <NotificationSection />}
              {activeTab === "about" && <AboutSection />}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
