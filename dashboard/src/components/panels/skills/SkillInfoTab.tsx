"use client";

import { AlertCircle, CheckCircle, ExternalLink, Info, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SkillEntry } from "@/stores/skills";

interface SkillInfoTabProps {
  skill: SkillEntry;
}

function statusDotColor(status: string): string {
  switch (status) {
    case "ready":
      return "bg-[var(--status-connected)]";
    case "needs-setup":
      return "bg-[var(--status-reconnecting)]";
    default:
      return "bg-[var(--muted-foreground)]";
  }
}

function sourceBadgeColor(source: SkillEntry["source"]): string {
  switch (source) {
    case "bundled":
      return "bg-[var(--primary-muted)] text-[var(--primary)]";
    case "managed":
      return "bg-[var(--purple-muted)] text-[var(--purple-muted-text)]";
    case "plugin":
      return "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]";
  }
}

export function SkillInfoTab({ skill }: SkillInfoTabProps) {
  const t = useTranslations("skills");

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Metadata header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {skill.emoji && <span className="text-lg">{skill.emoji}</span>}
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{skill.name}</h3>
        </div>

        <p className="text-xs text-[var(--foreground)] leading-relaxed">
          {skill.description || t("noDescription")}
        </p>

        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <Badge
            variant="secondary"
            className={cn("text-[10px] h-4", sourceBadgeColor(skill.source))}
          >
            {t(skill.source)}
          </Badge>
          <div className="flex items-center gap-1.5">
            <span
              className={cn("w-1.5 h-1.5 rounded-full inline-block", statusDotColor(skill.status))}
            />
            <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
          </div>
        </div>

        {skill.homepage && (
          <a
            href={skill.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
          >
            <ExternalLink size={11} />
            {t("homepage")}
          </a>
        )}
      </div>

      {/* Dependencies section */}
      {((skill.missingRequirements && skill.missingRequirements.length > 0) ||
        (skill.installOptions && skill.installOptions.length > 0)) && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[var(--muted-foreground)]">
            {t("dependencies")}
          </h4>

          {skill.installOptions?.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)] ring-1 ring-[var(--border-subtle)] text-xs"
            >
              <CheckCircle size={13} className="text-[var(--success)] shrink-0" />
              <span className="font-medium text-[var(--foreground)]">{opt.label}</span>
              {opt.bins.length > 0 && (
                <span className="text-[var(--muted-foreground)]">({opt.bins.join(", ")})</span>
              )}
            </div>
          ))}

          {skill.missingRequirements?.map((req) => (
            <div
              key={req}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--skill-warning-bg)] ring-1 ring-[var(--warning)]/20 text-xs"
            >
              <AlertCircle size={13} className="text-[var(--warning)] shrink-0" />
              <span className="text-[var(--skill-warning-text)]">{req}</span>
            </div>
          ))}
        </div>
      )}

      {/* Environment variables */}
      {skill.primaryEnv && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[var(--muted-foreground)]">{t("envVars")}</h4>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)] ring-1 ring-[var(--border-subtle)] text-xs">
            {skill.status === "ready" ? (
              <CheckCircle size={13} className="text-[var(--success)] shrink-0" />
            ) : (
              <AlertCircle size={13} className="text-[var(--warning)] shrink-0" />
            )}
            <code className="px-1.5 py-0.5 rounded bg-[var(--card)] font-mono text-[11px] text-[var(--foreground)]">
              {skill.primaryEnv}
            </code>
            <span className="text-[var(--muted-foreground)]">
              {skill.status === "ready" ? t("envSet") : t("envNotSet")}
            </span>
          </div>
        </div>
      )}

      {/* Uninstall CLI note */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--muted)] ring-1 ring-[var(--border-subtle)] text-xs text-[var(--muted-foreground)]">
        <Info size={13} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>{t("uninstallViaCLI")}</p>
          <code className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--card)] font-mono text-[11px] text-[var(--foreground)]">
            <Terminal size={11} className="shrink-0 text-[var(--muted-foreground)]" />
            openclaw skills uninstall {skill.name}
          </code>
        </div>
      </div>
    </div>
  );
}
