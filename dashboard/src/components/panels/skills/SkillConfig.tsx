"use client";

import { Download, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/stores/notifications";
import { useSkillsStore, type SkillEntry, type SkillInstallOption } from "@/stores/skills";

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
  const { updateSkill, installSkill } = useSkillsStore();
  const addToast = useNotificationsStore((s) => s.addToast);

  const [apiKey, setApiKey] = useState("");
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [installingDeps, setInstallingDeps] = useState<Record<string, boolean>>({});

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

  const handleInstallDep = async (opt: SkillInstallOption) => {
    setInstallingDeps((prev) => ({ ...prev, [opt.id]: true }));
    try {
      const ok = await installSkill(skill.name, opt.id);
      if (ok) {
        addToast("success", t("installSuccess", { name: opt.label }));
      } else {
        addToast("error", t("installFailed", { name: opt.label }));
      }
    } finally {
      setInstallingDeps((prev) => ({ ...prev, [opt.id]: false }));
    }
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
        </div>
      </div>

      {/* Description preview */}
      <div className="text-xs space-y-2">
        <p className="text-[var(--text-primary)] leading-relaxed">
          {skill.emoji && <span className="mr-1.5">{skill.emoji}</span>}
          {skill.description || t("noDescription")}
        </p>

        {skill.homepage && (
          <a
            href={skill.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
          >
            <ExternalLink size={11} />
            {t("homepage")}
          </a>
        )}

        {skill.primaryEnv && (
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span className="font-medium">{t("requiredEnv")}:</span>
            <code className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[11px]">
              {skill.primaryEnv}
            </code>
          </div>
        )}
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

      {/* Actionable dependencies section */}
      {((skill.missingRequirements && skill.missingRequirements.length > 0) ||
        (skill.installOptions && skill.installOptions.length > 0)) && (
        <div className="space-y-2">
          <Label className="text-xs text-[var(--text-secondary)]">{t("installDeps")}</Label>

          {skill.missingRequirements && skill.missingRequirements.length > 0 && (
            <div className="text-xs px-3 py-2 rounded-lg bg-[var(--skill-warning-bg)] text-[var(--skill-warning-text)] ring-1 ring-[var(--warning)]/20">
              <span className="font-medium">{t("missingRequirements")}:</span>{" "}
              {skill.missingRequirements.join(", ")}
            </div>
          )}

          {skill.installOptions?.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]"
            >
              <div className="text-xs">
                <span className="font-medium text-[var(--text-primary)]">{opt.label}</span>
                {opt.bins.length > 0 && (
                  <span className="ml-2 text-[var(--text-secondary)]">
                    {t("requiredBins")}: {opt.bins.join(", ")}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="xs"
                className="gap-1 shrink-0"
                onClick={() => void handleInstallDep(opt)}
                disabled={!!installingDeps[opt.id]}
              >
                {installingDeps[opt.id] ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t("installing")}
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    {t("install")}
                  </>
                )}
              </Button>
            </div>
          ))}
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
