"use client";

import { Download, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSkillsStore, type SkillEntry } from "@/stores/skills";

interface SkillConfigProps {
  skill: SkillEntry;
}

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

function sourceBadgeColor(source: SkillEntry["source"]): string {
  switch (source) {
    case "bundled":
      return "bg-[var(--accent-muted)] text-[var(--accent)]";
    case "managed":
      return "bg-[var(--purple-muted)] text-[var(--purple-muted-text)]";
    case "plugin":
      return "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]";
  }
}

export function SkillConfig({ skill }: SkillConfigProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");
  const { updateSkill, installSkill, fetchSkills } = useSkillsStore();

  const [apiKey, setApiKey] = useState("");
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const env = (skill.config?.env ?? {}) as Record<string, string>;
    setEnvPairs(Object.entries(env).map(([key, value]) => ({ key, value })));
    setApiKey((skill.config?.apiKey as string) ?? "");
  }, [skill.key, skill.config]);

  const handleToggle = async () => {
    await updateSkill(skill.key, { enabled: !skill.enabled });
  };

  const handleSave = async () => {
    setSaving(true);
    const env: Record<string, string> = {};
    for (const pair of envPairs) {
      if (pair.key.trim()) {
        env[pair.key.trim()] = pair.value;
      }
    }
    await updateSkill(skill.key, {
      ...(apiKey !== undefined ? { apiKey } : {}),
      env,
    });
    setSaving(false);
  };

  const handleInstall = async () => {
    const installId = (skill.config?.installId as string) ?? skill.key;
    setInstalling(true);
    await installSkill(skill.name, installId);
    await fetchSkills();
    setInstalling(false);
  };

  const addEnvPair = () => setEnvPairs([...envPairs, { key: "", value: "" }]);

  const removeEnvPair = (idx: number) => setEnvPairs(envPairs.filter((_, i) => i !== idx));

  const updateEnvPair = (idx: number, field: "key" | "value", val: string) => {
    setEnvPairs(envPairs.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{skill.name}</h3>
        <div className="flex items-center gap-2">
          {/* Enable/disable toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={skill.enabled} onCheckedChange={handleToggle} />
            <span className="text-xs text-[var(--text-secondary)]">
              {skill.enabled ? t("enabled") : t("disabled")}
            </span>
          </div>

          {/* Install button for managed/plugin */}
          {skill.source !== "bundled" && (
            <Button
              variant="outline"
              size="xs"
              className="bg-[var(--purple-muted)] text-[var(--purple-muted-text)] border-[var(--purple)]/30 hover:bg-[var(--purple-muted)] gap-1"
              onClick={handleInstall}
              disabled={installing}
            >
              <Download size={12} />
              {installing ? "..." : t("install")}
            </Button>
          )}
        </div>
      </div>

      {/* Status + source */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <Badge
          variant="secondary"
          className={cn("text-[10px] h-4", sourceBadgeColor(skill.source))}
        >
          {t(skill.source)}
        </Badge>
        <div className="flex items-center gap-1.5">
          <span
            className={cn("w-1.5 h-1.5 rounded-full inline-block", statusDotColor(skill.status))}
          />
          <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
        </div>
      </div>

      {/* Missing requirements */}
      {skill.missingRequirements && skill.missingRequirements.length > 0 && (
        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--skill-warning-bg)] text-[var(--skill-warning-text)] ring-1 ring-[var(--warning)]/20">
          <span className="font-medium">{t("missingRequirements")}:</span>{" "}
          {skill.missingRequirements.join(", ")}
        </div>
      )}

      {/* API Key */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("apiKey")}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* Env vars */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--text-secondary)]">{t("envVars")}</Label>
          <Button
            variant="ghost"
            size="xs"
            className="text-[var(--accent)] hover:bg-[var(--accent-muted)] gap-1"
            onClick={addEnvPair}
          >
            <Plus size={12} />
            {tc("add")}
          </Button>
        </div>
        {envPairs.map((pair, idx) => (
          <div key={idx} className="flex gap-1.5 items-center">
            <Input
              type="text"
              value={pair.key}
              onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
              placeholder="KEY"
              className="flex-1 h-8 text-xs font-mono"
            />
            <Input
              type="text"
              value={pair.value}
              onChange={(e) => updateEnvPair(idx, "value", e.target.value)}
              placeholder="value"
              className="flex-1 h-8 text-xs font-mono"
            />
            <button
              type="button"
              className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors duration-150 cursor-pointer p-1"
              onClick={() => removeEnvPair(idx)}
              aria-label="Remove"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Save */}
      <Button size="sm" className="self-start" onClick={handleSave} disabled={saving}>
        {saving ? tc("loading") : tc("save")}
      </Button>
    </div>
  );
}
