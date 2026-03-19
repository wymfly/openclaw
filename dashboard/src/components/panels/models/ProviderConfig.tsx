"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModelsStore } from "@/stores/models";

export function ProviderConfig({ provider }: { provider: string }) {
  const t = useTranslations("models");
  const { providers, updateProviderConfig } = useModelsStore();

  const config = providers.find((p) => p.provider === provider);

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form state when provider or config changes.
  useEffect(() => {
    setApiKey(config?.apiKey ?? "");
    setBaseUrl(config?.baseUrl ?? "");
    setModelId(config?.modelId ?? "");
    setSaved(false);
  }, [provider, config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const ok = await updateProviderConfig({
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
  }, [provider, apiKey, baseUrl, modelId, updateProviderConfig]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold uppercase text-foreground">{provider}</h2>
        <span className="text-xs text-muted-foreground">{t("provider")}</span>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* API Key */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1">{t("apiKey")}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="max-w-md text-xs"
          />
        </div>

        {/* Base URL */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1">{t("baseUrl")}</Label>
          <Input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="max-w-md text-xs"
          />
        </div>

        {/* Model ID */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1">{t("name")}</Label>
          <Input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="model-id"
            className="max-w-md text-xs"
          />
        </div>

        {/* Save button */}
        <div className="pt-2">
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            <Save size={12} />
            {saved ? t("saved") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
