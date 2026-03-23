"use client";

import { useTranslations } from "next-intl";
import { useSkillsStore, type SkillEntry, type StatusFilter } from "@/stores/skills";

const STATUS_FILTERS: StatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

function sourceBadgeColor(source: SkillEntry["source"]): string {
  switch (source) {
    case "bundled":
      return "var(--accent)";
    case "managed":
      return "var(--purple)";
    case "plugin":
      return "var(--warning)";
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
          <button
            key={f}
            type="button"
            className="px-2 py-1 text-[11px] rounded-md transition-colors"
            style={{
              backgroundColor: statusFilter === f ? "var(--accent)" : "var(--bg-tertiary)",
              color: statusFilter === f ? "var(--accent-fg)" : "var(--text-secondary)",
            }}
            onClick={() => setStatusFilter(f)}
          >
            {f === "all" ? t("all") : f === "needs-setup" ? t("needsSetup") : t(f)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs px-3 py-4 text-center" style={{ color: "var(--text-secondary)" }}>
          {t("noSkills")}
        </p>
      )}

      {filtered.map((skill) => (
        <button
          key={skill.key}
          type="button"
          className="w-full text-left px-3 py-2 rounded-md transition-colors text-xs"
          style={{
            backgroundColor: selectedSkillKey === skill.key ? "var(--bg-tertiary)" : "transparent",
            color: "var(--text-primary)",
          }}
          onClick={() => selectSkill(skill.key)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{skill.name}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: sourceBadgeColor(skill.source), color: "var(--accent-fg)" }}
            >
              {t(skill.source)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{
                backgroundColor:
                  skill.status === "ready"
                    ? "var(--success)"
                    : skill.status === "needs-setup"
                      ? "var(--warning)"
                      : "var(--neutral-muted-text)",
              }}
            />
            <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
