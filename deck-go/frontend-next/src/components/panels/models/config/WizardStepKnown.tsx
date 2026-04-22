"use client";

import { ArrowLeft, ChevronDown, ChevronRight, Link2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogProvider } from "@/stores/models";
import { AdvancedProviderFields } from "./AdvancedProviderFields";
import { ModelCheckboxList } from "./ModelCheckboxList";
import { MODEL_APIS } from "./WizardStepCustom";

interface WizardStepKnownProps {
  provider: CatalogProvider;
  onAdd: (params: {
    name: string;
    api: string;
    auth: string;
    baseUrl: string;
    apiKey?: string;
    models: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>;
    headers?: Record<string, string>;
    authHeader?: boolean;
    injectNumCtxForOpenAICompat?: boolean;
  }) => Promise<boolean>;
  onBack: () => void;
  onComplete: (providerName: string, models: Array<{ id: string; name: string }>) => void;
}

export function WizardStepKnown({ provider, onAdd, onBack, onComplete }: WizardStepKnownProps) {
  const t = useTranslations("models.wizard");
  const tm = useTranslations("models");

  const [baseUrl, setBaseUrl] = useState(provider.defaultBaseUrl);
  const [api, setApi] = useState(provider.api);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Advanced provider fields state
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [authHeader, setAuthHeader] = useState(false);
  const [injectNumCtxForOpenAICompat, setInjectNumCtxForOpenAICompat] = useState(false);

  // Default all models selected
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    () => new Set(provider.models.map((m) => m.id)),
  );

  const isEnvVar = apiKey.startsWith("${") && apiKey.endsWith("}");

  const canSave = baseUrl.trim().length > 0 && selectedModels.size > 0 && !saving;

  const handleToggle = (modelId: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedModels(new Set(provider.models.map((m) => m.id)));
  };

  const handleDeselectAll = () => {
    setSelectedModels(new Set());
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const models = provider.models
        .filter((m) => selectedModels.has(m.id))
        .map((m) => ({
          id: m.id,
          name: m.name,
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
        }));

      const ok = await onAdd({
        name: provider.id,
        api,
        auth: provider.authType,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        models,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        authHeader: authHeader || undefined,
        injectNumCtxForOpenAICompat: injectNumCtxForOpenAICompat || undefined,
      });
      if (ok) {
        onComplete(
          provider.id,
          models.map((m) => ({ id: m.id, name: m.name })),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <h3 className="text-sm font-medium">
        {t("configureProvider", { provider: provider.displayName })}
      </h3>

      {/* Base URL */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("baseUrl")}</Label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="font-mono text-xs"
        />
      </div>

      {/* API Format */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("apiFormat")}</Label>
        <Select
          value={api}
          onValueChange={(v) => {
            if (v) {
              setApi(v);
            }
          }}
        >
          <SelectTrigger className="text-xs font-mono cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_APIS.map((a) => (
              <SelectItem key={a} value={a} className="text-xs font-mono">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t("apiKey")}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("apiKeyPlaceholder")}
          className="font-mono text-xs"
          autoComplete="off"
        />
        <div className="flex items-center gap-1">
          {isEnvVar && <Link2 size={12} className="text-primary shrink-0" />}
          <p className="text-[10px] text-muted-foreground">{t("envVarHint")}</p>
        </div>
      </div>

      {/* Model Checkbox List */}
      {provider.models.length > 0 ? (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("models", { count: provider.models.length })}</Label>
          <ModelCheckboxList
            models={provider.models}
            selected={selectedModels}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border">
          {t("noModelsInCatalog")}
        </p>
      )}

      {/* Advanced Configuration (collapsible) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{tm("advanced.title")}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 pl-3 border-l border-border">
            <AdvancedProviderFields
              headers={headers}
              authHeader={authHeader}
              injectNumCtxForOpenAICompat={injectNumCtxForOpenAICompat}
              onHeadersChange={setHeaders}
              onAuthHeaderChange={setAuthHeader}
              onInjectNumCtxChange={setInjectNumCtxForOpenAICompat}
              disabled={saving}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Footer: Back + Add Provider */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 cursor-pointer"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="gap-1.5 cursor-pointer"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? t("saving") : t("addProvider")}
        </Button>
      </div>
    </div>
  );
}
