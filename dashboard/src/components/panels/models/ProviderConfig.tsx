"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
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

  const inputStyle = {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold uppercase" style={{ color: "var(--text-primary)" }}>
          {provider}
        </h2>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {t("provider")}
        </span>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* API Key */}
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("apiKey")}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full max-w-md text-xs rounded px-2 py-1.5"
            style={inputStyle}
          />
        </div>

        {/* Base URL */}
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("baseUrl")}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full max-w-md text-xs rounded px-2 py-1.5"
            style={inputStyle}
          />
        </div>

        {/* Model ID */}
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("name")}
          </label>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="model-id"
            className="w-full max-w-md text-xs rounded px-2 py-1.5"
            style={inputStyle}
          />
        </div>

        {/* Save button */}
        <div className="pt-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            <Save size={12} />
            {saved ? t("saved") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
