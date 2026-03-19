"use client";

import { Save, Cpu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      {/* Header with provider identity */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20">
          <Cpu size={16} className="text-[var(--accent)]" />
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-semibold uppercase text-[var(--text-primary)] tracking-tight">
            {provider}
          </h2>
          <span className="text-[10px] text-[var(--text-secondary)]">{t("provider")}</span>
        </div>
      </div>

      {/* Config form */}
      <div className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">{t("apiKey")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="max-w-md text-xs font-mono"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">{t("baseUrl")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="max-w-md text-xs font-mono"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">{t("name")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="model-id"
              className="max-w-md text-xs font-mono"
            />
          </CardContent>
        </Card>

        {/* Save */}
        <div className="pt-1">
          <Button
            size="sm"
            variant={saved ? "outline" : "default"}
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5"
          >
            <Save size={12} />
            {saved ? t("saved") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
