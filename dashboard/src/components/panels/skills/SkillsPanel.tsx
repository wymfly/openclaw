"use client";

import { Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkillsStore } from "@/stores/skills";
import { SkillConfig } from "./SkillConfig";
import { SkillList } from "./SkillList";

export function SkillsPanel() {
  const t = useTranslations("skills");
  const tc = useTranslations("common");

  const { skills, selectedSkillKey, loading, error, fetchSkills } = useSkillsStore();

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const selectedSkill = skills.find((s) => s.key === selectedSkillKey);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Sidebar — skill list */}
      <aside className="flex flex-col w-56 shrink-0 border-r border-[var(--border)] h-full">
        <ScrollArea className="flex-1">
          <div className="p-2">
            <SkillList />
          </div>
        </ScrollArea>
      </aside>

      {/* Detail area */}
      <div className="flex flex-col flex-1 min-w-0">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <p className="text-sm">{tc("loading")}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && !selectedSkill && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
              <Wrench size={20} className="text-[var(--accent)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("noSkills")}</p>
            </div>
          </div>
        )}

        {!loading && !error && selectedSkill && (
          <ScrollArea className="flex-1">
            <SkillConfig skill={selectedSkill} />
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
