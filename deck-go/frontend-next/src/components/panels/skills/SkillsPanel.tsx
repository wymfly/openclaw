"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { PanelError } from "@/components/ui/panel-error";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { useSkillsStore } from "@/stores/skills";
import { SkillConfig } from "./SkillConfig";
import { SkillHubTab } from "./SkillHubTab";
import { SkillInfoTab } from "./SkillInfoTab";
import { SkillList } from "./SkillList";

type DetailTab = "info" | "config";
type PanelMode = "installed" | "hub";

export function SkillsPanel() {
  const t = useTranslations("skills");

  const { skills, selectedSkillKey, loading, error, fetchSkills } = useSkillsStore();
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [panelMode, setPanelMode] = useState<PanelMode>("installed");

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
        <div className="flex items-center gap-1 ml-2">
          {(["installed", "hub"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPanelMode(mode)}
              className="text-xs px-3 py-1 rounded border cursor-pointer"
              style={{
                borderColor: panelMode === mode ? "var(--primary)" : "var(--border)",
                backgroundColor: panelMode === mode ? "var(--primary-muted)" : "var(--background)",
                color: panelMode === mode ? "var(--primary)" : "var(--foreground)",
              }}
            >
              {mode === "installed" ? t("modeInstalled") : t("modeHub")}
            </button>
          ))}
        </div>
        <span className="text-[11px] ml-auto" style={{ color: "var(--muted-foreground)" }}>
          {skills.length} {t("skillCount")}
        </span>
      </div>

      {/* Hub mode */}
      {panelMode === "hub" && <SkillHubTab />}

      {/* Installed mode */}
      {panelMode === "installed" && (
        <div
          className="flex flex-1 overflow-hidden"
          style={{ backgroundColor: "var(--background)" }}
        >
          {/* Sidebar — skill list */}
          <div
            className="w-60 flex-shrink-0 overflow-y-auto border-r p-2"
            style={{ borderColor: "var(--border)" }}
          >
            <SkillList />
          </div>

          {/* Detail area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading && <PanelSkeleton variant="cards" />}

            {error && !loading && <PanelError error={error} onRetry={() => void fetchSkills()} />}

            {!loading && !error && !selectedSkill && (
              <PanelEmptyState title={t("selectSkillHint")} />
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
      )}
    </div>
  );
}
