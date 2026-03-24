"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useSkillsStore, type SkillEntry, type StatusFilter } from "@/stores/skills";

const STATUS_FILTERS: StatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

const SOURCE_ORDER: SkillEntry["source"][] = ["bundled", "managed", "plugin"];

function statusDotColor(status: string): string {
  switch (status) {
    case "ready":
      return "var(--success)";
    case "needs-setup":
      return "var(--warning)";
    default:
      return "var(--neutral-muted-text)";
  }
}

function sourceBadgeColor(source: SkillEntry["source"]): string {
  switch (source) {
    case "bundled":
      return "var(--primary)";
    case "managed":
      return "var(--purple)";
    case "plugin":
      return "var(--warning)";
  }
}

export function SkillList() {
  const t = useTranslations("skills");
  const {
    skills,
    selectedSkillKey,
    statusFilter,
    searchQuery,
    selectSkill,
    setStatusFilter,
    setSearchQuery,
  } = useSkillsStore();

  const filtered = useMemo(() => {
    let result = skills;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [skills, statusFilter, searchQuery]);

  // Group by source
  const grouped = useMemo(() => {
    const groups: { source: SkillEntry["source"]; skills: SkillEntry[] }[] = [];
    for (const source of SOURCE_ORDER) {
      const items = filtered.filter((s) => s.source === source);
      if (items.length > 0) {
        groups.push({ source, skills: items });
      }
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-1">
      {/* Search */}
      <div className="relative mb-1">
        <Search
          size={13}
          className="absolute left-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--muted-foreground)" }}
        />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-7 h-7 text-[11px]"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap mb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="px-2 py-0.5 text-[10px] rounded-md transition-colors"
            style={{
              backgroundColor: statusFilter === f ? "var(--primary)" : "var(--muted)",
              color: statusFilter === f ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
            onClick={() => setStatusFilter(f)}
          >
            {f === "all" ? t("all") : f === "needs-setup" ? t("needsSetup") : t(f)}
          </button>
        ))}
      </div>

      {/* Grouped skill list */}
      {filtered.length === 0 && (
        <p className="text-xs px-3 py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
          {searchQuery.trim() ? t("noSearchResults") : t("noSkills")}
        </p>
      )}

      {grouped.map((group) => (
        <div key={group.source} className="mb-1">
          {/* Group header */}
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: sourceBadgeColor(group.source) }}
            />
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t(group.source)} ({group.skills.length})
            </span>
          </div>

          {/* Skills in group */}
          {group.skills.map((skill) => (
            <button
              key={skill.key}
              type="button"
              className="w-full text-left px-3 py-1.5 rounded-md transition-colors text-xs"
              style={{
                backgroundColor: selectedSkillKey === skill.key ? "var(--muted)" : "transparent",
                color: "var(--foreground)",
              }}
              onClick={() => selectSkill(skill.key)}
            >
              <div className="flex items-center gap-1.5">
                {skill.emoji && <span className="text-xs shrink-0">{skill.emoji}</span>}
                <span className="font-medium truncate">{skill.name}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 ml-auto"
                  style={{ backgroundColor: statusDotColor(skill.status) }}
                />
              </div>
              {skill.description && (
                <p
                  className="text-[10px] mt-0.5 line-clamp-1 leading-snug"
                  style={{
                    color: "var(--muted-foreground)",
                    paddingLeft: skill.emoji ? "1.25rem" : 0,
                  }}
                >
                  {skill.description}
                </p>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
