"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
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
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
        {/* Sidebar — skill list */}
        <div
          className="w-56 flex-shrink-0 overflow-y-auto border-r p-2"
          style={{ borderColor: "var(--border)" }}
        >
          <SkillList />
        </div>

        {/* Detail area */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !selectedSkill && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">{t("noSkills")}</p>
            </div>
          )}

          {!loading && !error && selectedSkill && <SkillConfig skill={selectedSkill} />}
        </div>
      </div>
    </div>
  );
}
