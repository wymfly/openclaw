"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSkillsStore } from "@/stores/skills";
import { SkillConfig } from "./SkillConfig";
import { SkillInfoTab } from "./SkillInfoTab";
import { SkillList } from "./SkillList";

type DetailTab = "info" | "config";

export function SkillsPanel() {
  const t = useTranslations("skills");
  const tc = useTranslations("common");

  const { skills, selectedSkillKey, loading, error, fetchSkills } = useSkillsStore();
  const [activeTab, setActiveTab] = useState<DetailTab>("info");

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  // Reset to info tab when skill selection changes
  useEffect(() => {
    setActiveTab("info");
  }, [selectedSkillKey]);

  const selectedSkill = skills.find((s) => s.key === selectedSkillKey);

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "info", label: t("tabInfo") },
    { key: "config", label: t("tabConfig") },
  ];

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>
        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {skills.length} {t("skillCount")}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
        {/* Sidebar — skill list */}
        <div
          className="w-60 flex-shrink-0 overflow-y-auto border-r p-2"
          style={{ borderColor: "var(--border)" }}
        >
          <SkillList />
        </div>

        {/* Detail area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{tc("loading")}</p>
            </div>
          )}

          {error && !loading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !selectedSkill && (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">{t("selectSkillHint")}</p>
            </div>
          )}

          {!loading && !error && selectedSkill && (
            <>
              {/* Tab bar */}
              <div
                className="flex gap-0 border-b px-4"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className="px-3 py-2 text-xs font-medium transition-colors relative"
                    style={{
                      color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)",
                    }}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                    {activeTab === tab.key && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ backgroundColor: "var(--primary)" }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === "info" && <SkillInfoTab skill={selectedSkill} />}
                {activeTab === "config" && <SkillConfig skill={selectedSkill} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
