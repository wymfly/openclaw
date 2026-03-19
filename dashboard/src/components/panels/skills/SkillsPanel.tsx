"use client";

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
    <div className="flex flex-col h-full overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden bg-background">
        {/* Sidebar — skill list */}
        <div className="w-56 shrink-0 border-r border-border p-2">
          <ScrollArea className="h-full">
            <SkillList />
          </ScrollArea>
        </div>

        {/* Detail area */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !selectedSkill && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">{t("noSkills")}</p>
            </div>
          )}

          {!loading && !error && selectedSkill && <SkillConfig skill={selectedSkill} />}
        </div>
      </div>
    </div>
  );
}
