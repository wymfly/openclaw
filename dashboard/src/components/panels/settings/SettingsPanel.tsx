"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PanelError } from "@/components/ui/panel-error";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { useSettingsStore } from "@/stores/settings";
import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { ConnectionSection } from "./ConnectionSection";
import { DevicesSection } from "./DevicesSection";
import { NotificationSection } from "./NotificationSection";

export function SettingsPanel() {
  const t = useTranslations("settings");
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border flex-col"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "var(--background)" }}>
        {error && <PanelError error={error} onRetry={() => void fetchSettings()} />}

        {loading ? (
          <PanelSkeleton variant="detail" />
        ) : (
          <div className="flex flex-col gap-6 max-w-lg">
            <AppearanceSection />
            <ConnectionSection />
            <DevicesSection />
            <NotificationSection />
            <AboutSection />
          </div>
        )}
      </div>
    </div>
  );
}
