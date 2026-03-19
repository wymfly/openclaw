"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettingsStore } from "@/stores/settings";
import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { ConnectionSection } from "./ConnectionSection";
import { NotificationSection } from "./NotificationSection";

export function SettingsPanel() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center border-b border-border bg-card px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 bg-background">
        <div className="p-4">
          {error && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-xs text-muted-foreground">{tc("loading")}</p>
          ) : (
            <div className="flex max-w-lg flex-col gap-6">
              <AppearanceSection />
              <ConnectionSection />
              <NotificationSection />
              <AboutSection />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
