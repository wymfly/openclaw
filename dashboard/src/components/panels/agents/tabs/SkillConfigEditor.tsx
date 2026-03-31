"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SkillConfigEditorProps {
  skillKey: string;
  initialApiKey?: string;
  initialEnv?: Record<string, string>;
  onSaved: () => void;
}

export function SkillConfigEditor({
  skillKey,
  initialApiKey,
  initialEnv,
  onSaved,
}: SkillConfigEditorProps) {
  const t = useTranslations("agentDetail");
  const tc = useTranslations("common");
  const [apiKey, setApiKey] = useState(initialApiKey ?? "");
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>(
    initialEnv ? Object.entries(initialEnv).map(([key, value]) => ({ key, value })) : [],
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const addEnvPair = useCallback(() => {
    setEnvPairs((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  const removeEnvPair = useCallback((index: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateEnvPair = useCallback((index: number, field: "key" | "value", val: string) => {
    setEnvPairs((prev) =>
      prev.map((pair, i) => (i === index ? { ...pair, [field]: val } : pair)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const env: Record<string, string> = {};
      for (const pair of envPairs) {
        if (pair.key.trim()) {env[pair.key.trim()] = pair.value;}
      }

      const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          ...(Object.keys(env).length > 0 ? { env } : {}),
        }),
      });

      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json().catch(() => ({ error: "Save failed" }));
        setSaveError((d as { error?: string }).error ?? "Save failed");
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }, [skillKey, apiKey, envPairs, onSaved]);

  return (
    <div className="space-y-3 p-3 rounded border border-[var(--border-subtle)] bg-[var(--background)]">
      {/* API Key */}
      <div>
        <label className="text-[10px] text-[var(--muted-foreground)] block mb-1">
          {t("skillApiKey")}
        </label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("skillApiKeyPlaceholder")}
          className="text-xs h-7"
        />
      </div>

      {/* Env vars */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-[var(--muted-foreground)]">
            {t("skillEnvVars")}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] gap-0.5 cursor-pointer"
            onClick={addEnvPair}
          >
            <Plus size={10} />
            {t("addEnvVar")}
          </Button>
        </div>
        <div className="space-y-1">
          {envPairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={pair.key}
                onChange={(e) => updateEnvPair(i, "key", e.target.value)}
                placeholder={t("skillEnvKey")}
                className="text-xs h-7 flex-1"
              />
              <Input
                value={pair.value}
                onChange={(e) => updateEnvPair(i, "value", e.target.value)}
                placeholder={t("skillEnvValue")}
                className="text-xs h-7 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[var(--destructive)] cursor-pointer"
                onClick={() => removeEnvPair(i)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-[var(--destructive)]">{saveError}</p>
      )}
      <Button
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving}
        className="cursor-pointer"
      >
        {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
        {tc("save")}
      </Button>
    </div>
  );
}
