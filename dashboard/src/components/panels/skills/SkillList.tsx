"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSkillsStore, type SkillEntry, type StatusFilter } from "@/stores/skills";

const STATUS_FILTERS: StatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

function sourceBadgeColor(source: SkillEntry["source"]): string {
  switch (source) {
    case "bundled":
      return "bg-[var(--accent-muted)] text-[var(--accent)]";
    case "managed":
      return "bg-[var(--purple-muted)] text-[var(--purple-muted-text)]";
    case "plugin":
      return "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]";
  }
}

function statusDotColor(status: string): string {
  switch (status) {
    case "ready":
      return "bg-[var(--status-connected)]";
    case "needs-setup":
      return "bg-[var(--status-reconnecting)]";
    default:
      return "bg-[var(--text-secondary)]";
  }
}

export function SkillList() {
  const t = useTranslations("skills");
  const { skills, selectedSkillKey, statusFilter, selectSkill, setStatusFilter } = useSkillsStore();

  const filtered =
    statusFilter === "all" ? skills : skills.filter((s) => s.status === statusFilter);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap mb-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
              statusFilter === f
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
            onClick={() => setStatusFilter(f)}
          >
            {f === "all" ? t("all") : f === "needs-setup" ? t("needsSetup") : t(f)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs px-3 py-4 text-center text-[var(--text-secondary)]">
          {t("noSkills")}
        </p>
      )}

      {filtered.map((skill) => {
        const isActive = selectedSkillKey === skill.key;
        return (
          <button
            key={skill.key}
            type="button"
            className={cn(
              "relative w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-xs cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
              isActive
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
            )}
            onClick={() => selectSkill(skill.key)}
          >
            {/* Active indicator */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                aria-hidden
              />
            )}

            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{skill.name}</span>
              <Badge
                variant="secondary"
                className={cn("text-[10px] h-4", sourceBadgeColor(skill.source))}
              >
                {t(skill.source)}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[var(--text-secondary)]">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                  statusDotColor(skill.status),
                )}
              />
              <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
