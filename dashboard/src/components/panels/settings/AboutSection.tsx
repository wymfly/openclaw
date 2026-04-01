"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";

export function AboutSection() {
  const t = useTranslations("settings");
  const versionInfo = useSettingsStore((s) => s.versionInfo);
  const fetchVersionInfo = useSettingsStore((s) => s.fetchVersionInfo);

  useEffect(() => {
    void fetchVersionInfo();
  }, [fetchVersionInfo]);

  const versions = [
    { label: t("deckVersion"), value: versionInfo.deck },
    { label: t("gatewayVersion"), value: versionInfo.gateway },
    { label: t("cliVersion"), value: versionInfo.cli },
  ];

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {t("about")}
      </h3>
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        {/* Version badges */}
        <div className="flex flex-wrap gap-3">
          {versions.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                {label}:
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {value || "—"}
              </span>
            </div>
          ))}
        </div>

        {/* External links */}
        <div className="flex gap-3 pt-1">
          <a
            href="https://docs.openclaw.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium underline"
            style={{ color: "var(--primary)" }}
          >
            {t("docs")}
          </a>
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium underline"
            style={{ color: "var(--primary)" }}
          >
            {t("github")}
          </a>
        </div>
      </div>
    </section>
  );
}
