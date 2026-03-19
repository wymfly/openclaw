"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t("about")}</h3>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          {/* Version badges */}
          <div className="flex flex-wrap gap-3">
            {versions.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{label}:</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {value || "—"}
                </Badge>
              </div>
            ))}
          </div>

          {/* External links */}
          <div className="flex gap-3 pt-1">
            <a
              href="https://docs.openclaw.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {t("docs")}
            </a>
            <a
              href="https://github.com/openclaw/openclaw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {t("github")}
            </a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
