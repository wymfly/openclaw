"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
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
    <div
      className="flex h-full rounded-lg overflow-hidden border flex-col"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "var(--bg-primary)" }}>
        {error && (
          <div
            className="mb-4 px-3 py-2 text-xs rounded-md"
            style={{
              color: "var(--danger)",
              backgroundColor: "var(--danger-muted)",
              border: "1px solid var(--danger)",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {tc("loading")}
          </p>
        ) : (
          <div className="flex flex-col gap-6 max-w-lg">
            <AppearanceSection />
            <ConnectionSection />
            <NotificationSection />
            <AboutSection />
          </div>
        )}
      </div>
    </div>
  );
}
