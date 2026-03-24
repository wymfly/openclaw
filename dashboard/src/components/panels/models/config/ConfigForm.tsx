"use client";

import { Eye, EyeOff, Loader2, Save, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderConfig } from "@/stores/models";

interface ConfigFormProps {
  provider: string;
  initialConfig?: { apiKey?: string; baseUrl?: string; modelId?: string };
  authType?: string | null;
  onSave: (config: ProviderConfig) => Promise<boolean>;
}

/** Default base URL placeholders per well-known provider. */
function defaultUrlPlaceholder(provider: string): string {
  const lower = provider.toLowerCase();
  if (lower.includes("openai")) {
    return "https://api.openai.com/v1";
  }
  if (lower.includes("anthropic")) {
    return "https://api.anthropic.com";
  }
  if (lower.includes("google") || lower.includes("gemini")) {
    return "https://generativelanguage.googleapis.com";
  }
  if (lower.includes("groq")) {
    return "https://api.groq.com/openai/v1";
  }
  if (lower.includes("mistral")) {
    return "https://api.mistral.ai/v1";
  }
  if (lower.includes("deepseek")) {
    return "https://api.deepseek.com";
  }
  return "https://api.example.com/v1";
}

/**
 * Provider configuration form — API key (with show/hide toggle),
 * base URL, and optional model ID override.
 */
export function ConfigForm({ provider, initialConfig, authType, onSave }: ConfigFormProps) {
  const t = useTranslations("models");

  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "");
  const [modelId, setModelId] = useState(initialConfig?.modelId ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset form when provider changes
  useEffect(() => {
    setApiKey(initialConfig?.apiKey ?? "");
    setBaseUrl(initialConfig?.baseUrl ?? "");
    setModelId(initialConfig?.modelId ?? "");
    setShowKey(false);
    setSaved(false);
  }, [provider, initialConfig?.apiKey, initialConfig?.baseUrl, initialConfig?.modelId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const ok = await onSave({
        provider,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        modelId: modelId || undefined,
      });
      if (ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [provider, apiKey, baseUrl, modelId, onSave]);

  return (
    <Card className="transition-panel">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm">{t("config.advanced")}</CardTitle>
        {authType && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {t("config.authType")}:
            </span>
            <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-mono">
              {authType}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* API Key */}
        <div className="space-y-1.5">
          <Label htmlFor={`apiKey-${provider}`} className="text-xs text-muted-foreground">
            {t("config.apiKey")}
          </Label>
          <div className="relative max-w-md">
            <Input
              id={`apiKey-${provider}`}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="pr-9 font-mono text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center gap-1">
            {apiKey.startsWith("${") && apiKey.endsWith("}") && (
              <span className="text-[var(--primary)]" title={t("config.envVarRef")}>
                &#x1F517;
              </span>
            )}
            <p className="text-[10px] text-[var(--muted-foreground)]">{t("config.secretHint")}</p>
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-1.5">
          <Label htmlFor={`baseUrl-${provider}`} className="text-xs text-muted-foreground">
            {t("config.baseUrl")}
          </Label>
          <Input
            id={`baseUrl-${provider}`}
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={defaultUrlPlaceholder(provider)}
            className="max-w-md font-mono text-xs"
          />
        </div>

        {/* Model ID Override */}
        <div className="space-y-1.5">
          <Label htmlFor={`modelId-${provider}`} className="text-xs text-muted-foreground">
            {t("config.modelId")}
          </Label>
          <Input
            id={`modelId-${provider}`}
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="Override model"
            className="max-w-md font-mono text-xs"
          />
        </div>

        {/* Save */}
        <div className="pt-1">
          <Button
            size="sm"
            variant={saved ? "outline" : "default"}
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <Check size={12} />
            ) : (
              <Save size={12} />
            )}
            {saved ? t("config.saved") : t("config.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
