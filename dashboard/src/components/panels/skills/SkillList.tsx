"use client";

import { Search, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSkillsStore, type SkillEntry, type StatusFilter } from "@/stores/skills";

const STATUS_FILTERS: StatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

const SOURCE_GROUPS: Array<{ source: SkillEntry["source"]; labelKey: string }> = [
  { source: "bundled", labelKey: "groupBundled" },
  { source: "managed", labelKey: "groupManaged" },
  { source: "plugin", labelKey: "groupPlugin" },
];

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
  const {
    skills,
    selectedSkillKey,
    statusFilter,
    searchQuery,
    selectSkill,
    setStatusFilter,
    setSearchQuery,
  } = useSkillsStore();

  // Track which groups are open (all open by default)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    bundled: true,
    managed: true,
    plugin: true,
  });

  const query = searchQuery.toLowerCase().trim();
  const filtered = skills
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .filter(
      (s) =>
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query),
    );

  const groups = SOURCE_GROUPS.map(({ source, labelKey }) => ({
    source,
    labelKey,
    skills: filtered.filter((s) => s.source === source),
  })).filter((g) => g.skills.length > 0);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Search input with leading icon */}
      <div className="relative mb-2">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
        />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-7 text-xs pl-7"
        />
      </div>

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

      {/* Empty state */}
      {groups.length === 0 && (
        <p className="text-xs px-3 py-4 text-center text-[var(--text-secondary)]">
          {t("noSkills")}
        </p>
      )}

      {/* Grouped skill list */}
      {groups.map((group) => {
        const isOpen = openGroups[group.source] ?? true;
        return (
          <Collapsible
            key={group.source}
            open={isOpen}
            onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.source]: open }))}
          >
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                />
              }
            >
              <ChevronRight
                size={12}
                className={cn("shrink-0 transition-transform duration-150", isOpen && "rotate-90")}
              />
              <span>{t(group.labelKey)}</span>
              <span className="ml-auto tabular-nums">{group.skills.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {group.skills.map((skill) => {
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
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
                    )}
                    onClick={() => selectSkill(skill.key)}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                        aria-hidden
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {skill.emoji && <span className="mr-1">{skill.emoji}</span>}
                        {skill.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[var(--text-secondary)]">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                          statusDotColor(skill.status),
                        )}
                      />
                      <span>
                        {skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
