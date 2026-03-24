"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Must match MODEL_APIS in src/config/types.models.ts
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

interface ModelEntry {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
}

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (params: {
    name: string;
    api: string;
    auth: string;
    baseUrl: string;
    apiKey?: string;
    models: ModelEntry[];
  }) => Promise<boolean>;
}

const emptyModel = (): ModelEntry => ({
  id: "",
  name: "",
  contextWindow: 128000,
  maxTokens: 4096,
});

export function AddProviderDialog({ open, onOpenChange, onAdd }: AddProviderDialogProps) {
  const t = useTranslations("models.config");
  const tc = useTranslations("common");

  const [providerName, setProviderName] = useState("");
  const [api, setApi] = useState<string>("openai-completions");
  const [authType, setAuthType] = useState<string>("api-key");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelEntry[]>([emptyModel()]);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setProviderName("");
    setApi("openai-completions");
    setAuthType("api-key");
    setBaseUrl("");
    setApiKey("");
    setModels([emptyModel()]);
    setSaving(false);
  }, []);

  const addModelRow = () => setModels((prev) => [...prev, emptyModel()]);
  const removeModelRow = (idx: number) => setModels((prev) => prev.filter((_, i) => i !== idx));
  const updateModel = (idx: number, field: keyof ModelEntry, value: string | number) =>
    setModels((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));

  const canSave =
    providerName.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    models.length > 0 &&
    models.every((m) => m.id.trim().length > 0) &&
    !saving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const ok = await onAdd({
        name: providerName.trim(),
        api,
        auth: authType,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        models: models.map((m) => ({
          ...m,
          id: m.id.trim(),
          name: m.name.trim() || m.id.trim(),
        })),
      });
      if (ok) {
        reset();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addProviderTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("providerName")}</Label>
            <Input
              value={providerName}
              onChange={(e) =>
                setProviderName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder={t("providerNamePlaceholder")}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-[var(--muted-foreground)]">{t("providerNameHint")}</p>
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

          {/* Auth Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("authType")}</Label>
            <Select
              value={authType}
              onValueChange={(v) => {
                if (v) {
                  setAuthType(v);
                }
              }}
            >
              <SelectTrigger className="text-xs cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="api-key" className="text-xs">
                  {t("authApiKey")}
                </SelectItem>
                <SelectItem value="oauth" className="text-xs">
                  {t("authOAuth")}
                </SelectItem>
                <SelectItem value="aws-sdk" className="text-xs">
                  {t("authAwsSdk")}
                </SelectItem>
                <SelectItem value="token" className="text-xs">
                  {t("authToken")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {/* API Key — shown for api-key and token auth types */}
          {(authType === "api-key" || authType === "token") && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                {authType === "token" ? t("authToken") : t("apiKey")}
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
                autoComplete="off"
              />
              <div className="flex items-center gap-1">
                {apiKey.startsWith("${") && apiKey.endsWith("}") && (
                  <span className="text-[var(--primary)]" title={t("envVarRef")}>
                    &#x1F517;
                  </span>
                )}
                <p className="text-[10px] text-[var(--muted-foreground)]">{t("secretHint")}</p>
              </div>
            </div>
          )}

          {/* OAuth hint */}
          {authType === "oauth" && (
            <p className="text-xs text-[var(--muted-foreground)] rounded-lg bg-[var(--muted)] p-3">
              {t("oauthHint")}
            </p>
          )}

          {/* Models */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("addModel")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addModelRow}
                className="h-6 gap-1 text-[10px] cursor-pointer"
              >
                <Plus size={10} /> {t("addModel")}
              </Button>
            </div>

            {models.map((model, idx) => (
              <div
                key={idx}
                className="flex gap-2 items-start rounded-lg border border-[var(--border)] p-2"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      value={model.id}
                      onChange={(e) => updateModel(idx, "id", e.target.value)}
                      placeholder={t("modelIdPlaceholder")}
                      className="font-mono text-xs flex-1"
                    />
                    <Input
                      value={model.name}
                      onChange={(e) => updateModel(idx, "name", e.target.value)}
                      placeholder={t("modelNamePlaceholder")}
                      className="text-xs flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] text-[var(--muted-foreground)]">
                        {t("contextWindowLabel")}
                      </Label>
                      <Input
                        type="number"
                        value={model.contextWindow}
                        onChange={(e) => updateModel(idx, "contextWindow", Number(e.target.value))}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] text-[var(--muted-foreground)]">
                        {t("maxTokensLabel")}
                      </Label>
                      <Input
                        type="number"
                        value={model.maxTokens}
                        onChange={(e) => updateModel(idx, "maxTokens", Number(e.target.value))}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
                {models.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeModelRow(idx)}
                    className="h-6 w-6 p-0 shrink-0 text-[var(--destructive)] cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}

            {models.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)] text-center py-2">
                {t("noModelsAdded")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {tc("cancel")}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="gap-1.5 cursor-pointer"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? t("providerAdding") : t("addProvider")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
