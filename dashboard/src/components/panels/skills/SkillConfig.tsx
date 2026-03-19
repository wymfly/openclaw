"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSkillsStore, type SkillEntry } from "@/stores/skills";

interface SkillConfigProps {
  skill: SkillEntry;
}

export function SkillConfig({ skill }: SkillConfigProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");
  const { updateSkill, installSkill, fetchSkills } = useSkillsStore();

  const [apiKey, setApiKey] = useState("");
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Initialize env pairs from skill config
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
    // installId comes from the skill's install metadata (key); Gateway uses it
    // to look up the installer spec — a random UUID would never match.
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
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{skill.name}</h3>
        <div className="flex items-center gap-2">
          {/* Enable/disable toggle */}
          <Button
            variant={skill.enabled ? "default" : "secondary"}
            size="xs"
            onClick={handleToggle}
          >
            {skill.enabled ? t("disable") : t("enable")}
          </Button>

          {/* Install button for managed/plugin */}
          {skill.source !== "bundled" && (
            <Button
              variant="secondary"
              size="xs"
              className="bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? "..." : t("install")}
            </Button>
          )}
        </div>
      </div>

      {/* Status + source */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          {t("source")}: {t(skill.source)}
        </span>
        <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
      </div>

      {/* Missing requirements */}
      {skill.missingRequirements && skill.missingRequirements.length > 0 && (
        <div className="text-xs px-3 py-2 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <span className="font-medium">{t("missingRequirements")}:</span>{" "}
          {skill.missingRequirements.join(", ")}
        </div>
      )}

      {/* API Key */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("apiKey")}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* Env vars */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{t("envVars")}</Label>
          <Button variant="ghost" size="xs" className="text-primary" onClick={addEnvPair}>
            + {tc("add")}
          </Button>
        </div>
        {envPairs.map((pair, idx) => (
          <div key={idx} className="flex gap-1 items-center">
            <Input
              type="text"
              value={pair.key}
              onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
              placeholder="KEY"
              className="flex-1 h-7 text-xs font-mono"
            />
            <Input
              type="text"
              value={pair.value}
              onChange={(e) => updateEnvPair(idx, "value", e.target.value)}
              placeholder="value"
              className="flex-1 h-7 text-xs font-mono"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => removeEnvPair(idx)}
            >
              x
            </Button>
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
