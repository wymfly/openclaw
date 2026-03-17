"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
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
    setInstalling(true);
    await installSkill(skill.name);
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
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {skill.name}
        </h3>
        <div className="flex items-center gap-2">
          {/* Enable/disable toggle */}
          <button
            type="button"
            className="px-2 py-1 text-[11px] rounded-md transition-colors"
            style={{
              backgroundColor: skill.enabled ? "var(--accent)" : "var(--bg-tertiary)",
              color: skill.enabled ? "#fff" : "var(--text-secondary)",
            }}
            onClick={handleToggle}
          >
            {skill.enabled ? t("disable") : t("enable")}
          </button>

          {/* Install button for managed/plugin */}
          {skill.source !== "bundled" && (
            <button
              type="button"
              className="px-2 py-1 text-[11px] rounded-md transition-colors"
              style={{ backgroundColor: "#8b5cf6", color: "#fff" }}
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? "..." : t("install")}
            </button>
          )}
        </div>
      </div>

      {/* Status + source */}
      <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>
          {t("source")}: {t(skill.source)}
        </span>
        <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
      </div>

      {/* Missing requirements */}
      {skill.missingRequirements && skill.missingRequirements.length > 0 && (
        <div
          className="text-xs px-3 py-2 rounded-md"
          style={{ backgroundColor: "#fef3c7", color: "#92400e" }}
        >
          <span className="font-medium">{t("missingRequirements")}:</span>{" "}
          {skill.missingRequirements.join(", ")}
        </div>
      )}

      {/* API Key */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {t("apiKey")}
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        />
      </label>

      {/* Env vars */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("envVars")}
          </span>
          <button
            type="button"
            className="text-[11px] px-1.5 py-0.5 rounded"
            style={{ color: "var(--accent)" }}
            onClick={addEnvPair}
          >
            + Add
          </button>
        </div>
        {envPairs.map((pair, idx) => (
          <div key={idx} className="flex gap-1 items-center">
            <input
              type="text"
              value={pair.key}
              onChange={(e) => updateEnvPair(idx, "key", e.target.value)}
              placeholder="KEY"
              className="flex-1 px-2 py-1 text-xs rounded-md border font-mono"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
            <input
              type="text"
              value={pair.value}
              onChange={(e) => updateEnvPair(idx, "value", e.target.value)}
              placeholder="value"
              className="flex-1 px-2 py-1 text-xs rounded-md border font-mono"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              className="text-xs px-1"
              style={{ color: "#ef4444" }}
              onClick={() => removeEnvPair(idx)}
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        type="button"
        className="self-start px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
        style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? tc("loading") : tc("save")}
      </button>
    </div>
  );
}
