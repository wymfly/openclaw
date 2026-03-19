"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSkillsStore, type SkillEntry, type StatusFilter } from "@/stores/skills";

const STATUS_FILTERS: StatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

function sourceBadgeVariant(source: SkillEntry["source"]): "default" | "secondary" | "outline" {
  switch (source) {
    case "bundled":
      return "default";
    case "managed":
      return "secondary";
    case "plugin":
      return "outline";
  }
}

function statusDotColor(status: string): string {
  switch (status) {
    case "ready":
      return "bg-green-500";
    case "needs-setup":
      return "bg-yellow-500";
    default:
      return "bg-muted-foreground";
  }
}

export function SkillList() {
  const t = useTranslations("skills");
  const { skills, selectedSkillKey, statusFilter, selectSkill, setStatusFilter } = useSkillsStore();

  const filtered =
    statusFilter === "all" ? skills : skills.filter((s) => s.status === statusFilter);

  return (
    <div className="flex flex-col gap-1">
      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap mb-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? "default" : "secondary"}
            size="xs"
            onClick={() => setStatusFilter(f)}
          >
            {f === "all" ? t("all") : f === "needs-setup" ? t("needsSetup") : t(f)}
          </Button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs px-3 py-4 text-center text-muted-foreground">{t("noSkills")}</p>
      )}

      {filtered.map((skill) => (
        <button
          key={skill.key}
          type="button"
          className={cn(
            "w-full text-left px-3 py-2 rounded-md transition-colors text-xs cursor-pointer",
            selectedSkillKey === skill.key
              ? "bg-muted text-foreground"
              : "text-foreground hover:bg-muted/50",
          )}
          onClick={() => selectSkill(skill.key)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{skill.name}</span>
            <Badge
              variant={sourceBadgeVariant(skill.source)}
              className={cn(
                "text-[10px] h-4",
                skill.source === "managed" &&
                  "bg-purple-500/15 text-purple-600 dark:text-purple-400",
                skill.source === "plugin" &&
                  "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
              )}
            >
              {t(skill.source)}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span
              className={cn("w-1.5 h-1.5 rounded-full inline-block", statusDotColor(skill.status))}
            />
            <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
