"use client";

import { Check, X, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDeckAgentsStore, type AgentSkills } from "@/stores/deck-agents";

interface SkillsTabProps {
  agentId: string;
}

// Eligibility badge colors
const ELIGIBILITY_STYLES: Record<string, { icon: React.ReactNode; color: string }> = {
  ready: {
    icon: <Check size={10} />,
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  missing_dep: {
    icon: <AlertTriangle size={10} />,
    color: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
  incompatible: {
    icon: <X size={10} />,
    color: "bg-red-500/15 text-red-400 border-red-500/25",
  },
};

export function SkillsTab({ agentId }: SkillsTabProps) {
  const t = useTranslations("agentDetail");
  const tc = useTranslations("common");
  const { currentSkills, fetchSkills, updateSkills } = useDeckAgentsStore();

  const [mode, setMode] = useState<AgentSkills["mode"]>("all");
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchSkills(agentId);
  }, [agentId, fetchSkills]);

  // Sync local state when store data arrives
  useEffect(() => {
    if (currentSkills) {
      setMode(currentSkills.mode);
      setWhitelist(currentSkills.whitelist);
    }
  }, [currentSkills]);

  const isWhitelistMode = mode === "whitelist";

  // Available skills from detail stats — skills in the whitelist are toggled on
  const availableSkills = whitelist.length > 0 ? whitelist : [];

  const toggleSkill = (skill: string) => {
    setWhitelist((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    const ok = await updateSkills(agentId, { mode, whitelist }, "");
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }, [agentId, mode, whitelist, updateSkills]);

  return (
    <div className="space-y-4">
      {/* Mode switcher */}
      <Card className="p-4 bg-[var(--bg-primary)] border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {isWhitelistMode ? t("skillModeWhitelist") : t("skillModeAll")}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              {isWhitelistMode
                ? "Only selected skills are available to this agent"
                : "All skills are available to this agent"}
            </p>
          </div>
          <Switch
            checked={isWhitelistMode}
            onCheckedChange={(checked) => {
              setMode(checked ? "whitelist" : "all");
              setSaved(false);
            }}
          />
        </div>
      </Card>

      {/* Skill list (whitelist mode) */}
      {isWhitelistMode && (
        <div className="space-y-1.5">
          {availableSkills.length === 0 && (
            <div className="py-4 text-center text-xs text-[var(--text-secondary)]">
              {t("noSkillsAvailable")}
            </div>
          )}
          {availableSkills.map((skill) => {
            const eligibility = ELIGIBILITY_STYLES.ready;
            return (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                  "border border-[var(--border)] bg-[var(--bg-primary)]",
                  "hover:border-[var(--accent)]/30",
                  whitelist.includes(skill) &&
                    "ring-1 ring-[var(--accent)]/30 border-[var(--accent)]/20",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      whitelist.includes(skill)
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "border-[var(--border)] bg-transparent",
                    )}
                  >
                    {whitelist.includes(skill) && <Check size={10} />}
                  </div>
                  <span className="font-mono text-[var(--text-primary)]">{skill}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] border gap-1", eligibility.color)}
                >
                  {eligibility.icon}
                  {t("skillReady")}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          variant={saved ? "outline" : "default"}
          className="gap-1.5 cursor-pointer"
        >
          {saved ? tc("save") + " ✓" : t("saveSkills")}
        </Button>
      </div>
    </div>
  );
}
