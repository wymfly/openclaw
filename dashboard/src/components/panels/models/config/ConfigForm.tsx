"use client";

import { Eye, EyeOff, Loader2, Save, Check, Plus, Trash2, ListPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProviderConfig, ProviderModelEntry } from "@/stores/models";
import { useModelsStore } from "@/stores/models";
import { ModelCheckboxList } from "./ModelCheckboxList";

const REDACTED_SENTINEL = "__OPENCLAW_REDACTED__";

const MODEL_APIS = [
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "anthropic-messages",
  "google-generative-ai",
  "github-copilot",
  "bedrock-converse-stream",
  "ollama",
] as const;

const AUTH_MODES = ["api-key", "aws-sdk", "oauth", "token"] as const;

interface ConfigFormProps {
  provider: string;
  initialConfig?: ProviderConfig;
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

/** Format large numbers with K suffix for display. */
function formatTokenCount(n: number | undefined): string {
  if (n == null) {
    return "-";
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(0)}K`;
  }
  return String(n);
}

/**
 * Provider configuration form — API key, base URL, auth type, API protocol,
 * and a read-only model list table.
 */
export function ConfigForm({ provider, initialConfig, authType, onSave }: ConfigFormProps) {
  const t = useTranslations("models");
  const tc = useTranslations("common");

  const isRedacted = initialConfig?.apiKey === REDACTED_SENTINEL;

  const [apiKey, setApiKey] = useState(isRedacted ? "" : (initialConfig?.apiKey ?? ""));
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "");
  const [authMode, setAuthMode] = useState(initialConfig?.auth ?? "");
  const [apiProtocol, setApiProtocol] = useState(initialConfig?.api ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable models list
  const [localModels, setLocalModels] = useState<ProviderModelEntry[]>(initialConfig?.models ?? []);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelApi, setNewModelApi] = useState("");
  const [newModelCtx, setNewModelCtx] = useState("");
  const [newModelMax, setNewModelMax] = useState("");

  // Catalog models for "add from catalog" feature
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [catalogSelected, setCatalogSelected] = useState<Set<string>>(new Set());
  const { catalogProviders, fetchCatalogProviders } = useModelsStore();

  const catalogModelsForProvider = useMemo(() => {
    const entry = catalogProviders.find((p) => p.id === provider);
    if (!entry) return [];
    // Filter out already-added models
    const existingIds = new Set(localModels.map((m) => m.id));
    return entry.models.filter((m) => !existingIds.has(m.id));
  }, [catalogProviders, provider, localModels]);

  const handleOpenCatalogPicker = useCallback(() => {
    if (catalogProviders.length === 0) {
      void fetchCatalogProviders();
    }
    setCatalogSelected(new Set(catalogModelsForProvider.map((m) => m.id)));
    setShowCatalogPicker(true);
  }, [catalogProviders.length, fetchCatalogProviders, catalogModelsForProvider]);

  const handleAddFromCatalog = useCallback(() => {
    const toAdd = catalogModelsForProvider
      .filter((m) => catalogSelected.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        reasoning: m.reasoning,
        input: ["text"] as string[],
      }));
    setLocalModels((prev) => [...prev, ...toAdd]);
    setShowCatalogPicker(false);
    setCatalogSelected(new Set());
  }, [catalogModelsForProvider, catalogSelected]);

  // Derive effective auth type (form state > initialConfig > authOverview)
  const effectiveAuth = authMode || initialConfig?.auth || authType || null;
  const isOAuth = effectiveAuth === "oauth";
  const isAwsSdk = effectiveAuth === "aws-sdk";

  // Provider has explicit config entry (models are user-managed)?
  // If no initialConfig or no models array → implicit/OAuth provider,
  // models come from catalog fallback and should not be editable here.
  const hasExplicitConfig = Boolean(initialConfig?.models && initialConfig.models.length > 0);

  // Reset form when provider changes
  useEffect(() => {
    const redacted = initialConfig?.apiKey === REDACTED_SENTINEL;
    setApiKey(redacted ? "" : (initialConfig?.apiKey ?? ""));
    setApiKeyDirty(false);
    setBaseUrl(initialConfig?.baseUrl ?? "");
    setAuthMode(initialConfig?.auth ?? "");
    setApiProtocol(initialConfig?.api ?? "");
    setLocalModels(initialConfig?.models ?? []);
    setShowKey(false);
    setSaved(false);
    setShowAddModel(false);
    setShowCatalogPicker(false);
    setCatalogSelected(new Set());
  }, [
    provider,
    initialConfig?.apiKey,
    initialConfig?.baseUrl,
    initialConfig?.auth,
    initialConfig?.api,
    initialConfig?.models,
  ]);

  const handleAddModel = useCallback(() => {
    if (!newModelId.trim()) {
      return;
    }
    const entry: ProviderModelEntry = {
      id: newModelId.trim(),
      name: newModelName.trim() || newModelId.trim(),
      ...(newModelApi ? { api: newModelApi } : {}),
      reasoning: false,
      input: ["text"],
      contextWindow: newModelCtx ? Number(newModelCtx) : 128000,
      maxTokens: newModelMax ? Number(newModelMax) : 4096,
    };
    setLocalModels((prev) => [...prev, entry]);
    setNewModelId("");
    setNewModelName("");
    setNewModelApi("");
    setNewModelCtx("");
    setNewModelMax("");
    setShowAddModel(false);
  }, [newModelId, newModelName, newModelApi, newModelCtx, newModelMax]);

  const handleRemoveModel = useCallback((id: string) => {
    setLocalModels((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const config: ProviderConfig = {
        provider,
        baseUrl: baseUrl || undefined,
        auth: authMode || undefined,
        api: apiProtocol || undefined,
        models: localModels.length > 0 ? localModels : undefined,
      };

      // Only send apiKey if user changed it (not the redacted placeholder)
      if (apiKeyDirty) {
        config.apiKey = apiKey || undefined;
      } else if (!isRedacted && apiKey) {
        config.apiKey = apiKey;
      }

      const ok = await onSave(config);
      if (ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [
    provider,
    apiKey,
    apiKeyDirty,
    isRedacted,
    baseUrl,
    authMode,
    apiProtocol,
    localModels,
    onSave,
  ]);

  return (
    <Card className="transition-panel">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm">{t("config.advanced")}</CardTitle>
        {effectiveAuth && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {t("config.authType")}:
            </span>
            <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-mono">
              {effectiveAuth}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* API Key — hidden for aws-sdk, hint for oauth */}
        {isOAuth ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("config.apiKey")}</Label>
            <p className="text-xs text-[var(--muted-foreground)] italic">{t("config.oauthHint")}</p>
          </div>
        ) : isAwsSdk ? null : (
          <div className="space-y-1.5">
            <Label htmlFor={`apiKey-${provider}`} className="text-xs text-muted-foreground">
              {t("config.apiKey")}
            </Label>
            <div className="relative max-w-md">
              <Input
                id={`apiKey-${provider}`}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setApiKeyDirty(true);
                }}
                placeholder={
                  isRedacted ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "sk-..."
                }
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
        )}

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

        {/* Auth Mode */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("config.auth")}</Label>
          <Select value={authMode} onValueChange={(v) => setAuthMode(v ?? "")}>
            <SelectTrigger className="max-w-md text-xs" size="sm">
              <SelectValue placeholder={t("config.authSelect")} />
            </SelectTrigger>
            <SelectContent>
              {AUTH_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Protocol */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("config.apiProtocol")}</Label>
          <Select value={apiProtocol} onValueChange={(v) => setApiProtocol(v ?? "")}>
            <SelectTrigger className="max-w-md text-xs" size="sm">
              <SelectValue placeholder={t("config.apiProtocolSelect")} />
            </SelectTrigger>
            <SelectContent>
              {MODEL_APIS.map((api) => (
                <SelectItem key={api} value={api}>
                  {api}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Models table (editable) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("config.providerModels")}</Label>
            {localModels.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {t("config.modelCount", { count: localModels.length })}
              </Badge>
            )}
          </div>
          {localModels.length > 0 ? (
            <div className="max-w-2xl overflow-auto rounded-md border border-[var(--border)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                    <th className="px-3 py-1.5 text-left font-medium text-[var(--muted-foreground)]">
                      ID
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium text-[var(--muted-foreground)]">
                      {t("name")}
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium text-[var(--muted-foreground)]">
                      {t("contextWindow")}
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium text-[var(--muted-foreground)]">
                      {t("catalog.maxOutput")}
                    </th>
                    {hasExplicitConfig && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {localModels.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--accent)] group"
                    >
                      <td className="px-3 py-1.5 font-mono text-[var(--foreground)]">{m.id}</td>
                      <td className="px-3 py-1.5 text-[var(--muted-foreground)]">
                        {m.name || m.id}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[var(--muted-foreground)]">
                        {formatTokenCount(m.contextWindow)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[var(--muted-foreground)]">
                        {formatTokenCount(m.maxTokens)}
                      </td>
                      {hasExplicitConfig && (
                        <td className="px-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveModel(m.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--destructive-muted)] text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-all cursor-pointer"
                            title={tc("delete")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)] italic">
              {t("config.noModelsConfigured")}
            </p>
          )}

          {/* Add model inline form — only for explicitly configured providers */}
          {!hasExplicitConfig ? null : showAddModel ? (
            <div className="max-w-2xl space-y-2 rounded-md border border-dashed border-[var(--border)] p-3 bg-[var(--muted)]/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t("config.modelIdPlaceholder")}
                  </Label>
                  <Input
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder="e.g. deepseek-r1"
                    className="text-xs font-mono h-7"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t("config.modelNamePlaceholder")}
                  </Label>
                  <Input
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="e.g. DeepSeek R1"
                    className="text-xs h-7"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t("config.apiProtocol")}
                  </Label>
                  <Select value={newModelApi} onValueChange={setNewModelApi}>
                    <SelectTrigger className="text-xs h-7" size="sm">
                      <SelectValue placeholder={t("config.apiProtocolSelect")} />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_APIS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t("config.contextWindowLabel")}
                  </Label>
                  <Input
                    type="number"
                    value={newModelCtx}
                    onChange={(e) => setNewModelCtx(e.target.value)}
                    placeholder="128000"
                    className="text-xs font-mono h-7"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    {t("config.maxTokensLabel")}
                  </Label>
                  <Input
                    type="number"
                    value={newModelMax}
                    onChange={(e) => setNewModelMax(e.target.value)}
                    placeholder="4096"
                    className="text-xs font-mono h-7"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAddModel}
                  disabled={!newModelId.trim()}
                  className="h-7 text-xs gap-1"
                >
                  <Plus size={12} />
                  {t("config.addModel")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddModel(false)}
                  className="h-7 text-xs"
                >
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddModel(true)}
                className="h-7 text-xs gap-1"
              >
                <Plus size={12} />
                {t("config.addModel")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenCatalogPicker}
                className="h-7 text-xs gap-1"
              >
                <ListPlus size={12} />
                {t("config.addFromCatalog")}
              </Button>
            </div>
          )}

          {/* Catalog model picker — only for explicitly configured providers */}
          {hasExplicitConfig && showCatalogPicker && (
            <div className="space-y-2 rounded-md border border-dashed border-[var(--border)] p-3 bg-[var(--muted)]/30">
              {catalogModelsForProvider.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t("wizard.noModelsInCatalog")}
                </p>
              ) : (
                <ModelCheckboxList
                  models={catalogModelsForProvider}
                  selected={catalogSelected}
                  onToggle={(id) => {
                    setCatalogSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  onSelectAll={() =>
                    setCatalogSelected(new Set(catalogModelsForProvider.map((m) => m.id)))
                  }
                  onDeselectAll={() => setCatalogSelected(new Set())}
                />
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAddFromCatalog}
                  disabled={catalogSelected.size === 0}
                  className="h-7 text-xs gap-1"
                >
                  <Plus size={12} />
                  {t("config.addModel")} ({catalogSelected.size})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCatalogPicker(false)}
                  className="h-7 text-xs"
                >
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          )}
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
