"use client";

import { ExternalLink, Hexagon } from "lucide-react";
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

  const links = [
    { label: t("docs"), href: "https://docs.openclaw.ai" },
    { label: t("github"), href: "https://github.com/openclaw/openclaw" },
  ];

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        {t("about")}
      </h3>

      <Card className="ring-1 ring-[var(--border)]">
        <CardContent className="p-4 space-y-4">
          {/* Brand + version grid */}
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-muted)] shrink-0">
              <Hexagon size={20} className="text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                OpenClaw Deck
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {versions.map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] h-5 px-1.5 bg-[var(--bg-tertiary)]"
                    >
                      {value || "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-3 pt-2 border-t border-[var(--border-subtle)]">
            {links.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                <ExternalLink size={11} />
                {label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
