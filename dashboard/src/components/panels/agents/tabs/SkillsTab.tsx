"use client";

import { Check, Download, Loader2, RefreshCw, Settings, X, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDeckAgentsStore, type AgentSkills } from "@/stores/deck-agents";
import { SkillConfigEditor } from "./SkillConfigEditor";
import { SkillInstallDialog } from "./SkillInstallDialog";

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
  const [skills, setSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [expandedSkillKey, setExpandedSkillKey] = useState<string | null>(null);
  const [updateAllLoading, setUpdateAllLoading] = useState(false);

  // skills.status provides config data (apiKey, env) that deck.agents.skills.get doesn't have
  const [skillConfigs, setSkillConfigs] = useState<
    Map<string, { apiKey?: string; env?: Record<string, string> }>
  >(new Map());

  useEffect(() => {
    void fetchSkills(agentId);
    // Parallel fetch: skills.status for config data
    void (async () => {
      try {
        const res = await fetch("/api/skills");
        if (!res.ok) return;
        const data = (await res.json()) as {
          skills?: Array<{
            key: string;
            config?: { apiKey?: string; env?: Record<string, string> };
          }>;
        };
        const map = new Map<string, { apiKey?: string; env?: Record<string, string> }>();
        for (const s of data.skills ?? []) {
          if (s.config) map.set(s.key, s.config);
        }
        setSkillConfigs(map);
      } catch {
        // best-effort
      }
    })();
  }, [agentId, fetchSkills]);

  // Sync local state when store data arrives
  useEffect(() => {
    if (currentSkills) {
      setMode(currentSkills.mode);
      setSkills(currentSkills.skills);
    }
  }, [currentSkills]);

  const isWhitelistMode = mode === "whitelist";

  // Available skills from the backend skills.get response
  const availableSkills = currentSkills?.available ?? [];

  const toggleSkill = (skillKey: string) => {
    setSkills((prev) =>
      prev.includes(skillKey) ? prev.filter((s) => s !== skillKey) : [...prev, skillKey],
    );
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    const baseHash = currentSkills?.configHash ?? "";
    const ok = await updateSkills(agentId, mode as "all" | "whitelist", skills, baseHash);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }, [agentId, mode, skills, currentSkills?.configHash, updateSkills]);

  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleUpdateAllClawHub = useCallback(async () => {
    setUpdateAllLoading(true);
    setUpdateError(null);
    try {
      const res = await fetch("/api/skills/update-clawhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setUpdateError((d as { error?: string }).error ?? t("installFailed"));
      }
      await fetchSkills(agentId);
    } catch {
      setUpdateError(t("installFailed"));
    } finally {
      setUpdateAllLoading(false);
    }
  }, [agentId, fetchSkills, t]);

  return (
    <div className="space-y-4">
      {/* Header with install + update all */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{t("skills")}</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleUpdateAllClawHub()}
            disabled={updateAllLoading}
            className="h-7 text-xs gap-1 cursor-pointer"
          >
            {updateAllLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t("updateAll")}
          </Button>
          <Button
            size="sm"
            onClick={() => setInstallOpen(true)}
            className="h-7 text-xs gap-1 cursor-pointer"
          >
            <Download size={12} />
            {t("installSkill")}
          </Button>
        </div>
      </div>

      <SkillInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        onInstalled={() => void fetchSkills(agentId)}
      />

      {updateError && (
        <p className="text-xs text-[var(--destructive)] px-1">{updateError}</p>
      )}

      {/* Mode switcher */}
      <Card className="p-4 bg-[var(--background)] border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--foreground)]">
              {isWhitelistMode ? t("skillModeWhitelist") : t("skillModeAll")}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
              {isWhitelistMode
                ? t("skillModeWhitelistDesc")
                : t("skillModeAllDesc")}
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
            <div className="py-4 text-center text-xs text-[var(--muted-foreground)]">
              {t("noSkillsAvailable")}
            </div>
          )}
          {availableSkills.map((entry) => {
            const isAssigned = skills.includes(entry.key);
            const eligibilityKey = entry.eligible ? "ready" : "missing_dep";
            const eligibility = ELIGIBILITY_STYLES[eligibilityKey] ?? ELIGIBILITY_STYLES.ready;
            const entryConfig = skillConfigs.get(entry.key);
            return (
              <div key={entry.key} className="space-y-1">
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={() => toggleSkill(entry.key)}
                    className={cn(
                      "flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-l-lg text-xs transition-colors cursor-pointer",
                      "border border-r-0 border-[var(--border)] bg-[var(--background)]",
                      "hover:border-[var(--primary)]/30",
                      isAssigned && "ring-1 ring-[var(--primary)]/30 border-[var(--primary)]/20",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        isAssigned
                          ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border-[var(--border)] bg-transparent",
                      )}
                    >
                      {isAssigned && <Check size={10} />}
                    </div>
                    <span className="font-mono text-[var(--foreground)] truncate">
                      {entry.name || entry.key}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] border gap-1 ml-auto shrink-0", eligibility.color)}
                    >
                      {eligibility.icon}
                      {entry.eligible ? t("skillReady") : t("skillMissingDep")}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-r-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] cursor-pointer transition-colors"
                    onClick={() => setExpandedSkillKey(expandedSkillKey === entry.key ? null : entry.key)}
                    title={t("configureSkill")}
                  >
                    <Settings size={12} />
                  </button>
                </div>
                {expandedSkillKey === entry.key && (
                  <SkillConfigEditor
                    skillKey={entry.key}
                    initialApiKey={entryConfig?.apiKey}
                    initialEnv={entryConfig?.env}
                    onSaved={() => {
                      setExpandedSkillKey(null);
                      void fetchSkills(agentId);
                    }}
                  />
                )}
              </div>
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
