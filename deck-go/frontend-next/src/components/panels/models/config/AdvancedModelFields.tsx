"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ModelCost } from "@/stores/models";
import { KeyValueEditor } from "./KeyValueEditor";

// ---------------------------------------------------------------------------
// Compat field definitions grouped by semantic category
// ---------------------------------------------------------------------------

type CompatFieldDef =
  | { type: "boolean"; key: string; hint?: boolean }
  | { type: "select"; key: string; options: string[]; hint?: boolean }
  | { type: "checkbox"; key: string; value: string; hint?: boolean };

interface CompatGroup {
  labelKey: string;
  fields: CompatFieldDef[];
}

const COMPAT_GROUPS: CompatGroup[] = [
  {
    labelKey: "apiBehavior",
    fields: [
      { type: "boolean", key: "supportsStore" },
      { type: "boolean", key: "supportsDeveloperRole" },
      { type: "boolean", key: "supportsStrictMode" },
      {
        type: "select",
        key: "maxTokensField",
        options: ["max_completion_tokens", "max_tokens"],
        hint: true,
      },
    ],
  },
  {
    labelKey: "reasoning",
    fields: [
      { type: "boolean", key: "supportsReasoningEffort" },
      { type: "boolean", key: "requiresThinkingAsText" },
      {
        type: "select",
        key: "thinkingFormat",
        options: ["openai", "openrouter", "zai", "qwen", "qwen-chat-template"],
        hint: true,
      },
    ],
  },
  {
    labelKey: "toolHandling",
    fields: [
      { type: "boolean", key: "supportsTools" },
      { type: "boolean", key: "requiresToolResultName" },
      { type: "boolean", key: "requiresAssistantAfterToolResult" },
      { type: "checkbox", key: "toolSchemaProfile", value: "xai", hint: true },
      { type: "boolean", key: "nativeWebSearchTool" },
      { type: "checkbox", key: "toolCallArgumentsEncoding", value: "html-entities", hint: true },
      { type: "boolean", key: "requiresMistralToolIds" },
      { type: "boolean", key: "requiresOpenAiAnthropicToolPayload" },
    ],
  },
  {
    labelKey: "streaming",
    fields: [{ type: "boolean", key: "supportsUsageInStreaming" }],
  },
];

// ---------------------------------------------------------------------------
// API protocol options (same as ConfigForm)
// ---------------------------------------------------------------------------

const API_OPTIONS = [
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "anthropic-messages",
  "google-generative-ai",
  "github-copilot",
  "bedrock-converse-stream",
  "ollama",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdvancedModelFieldsProps {
  api?: string;
  cost?: ModelCost;
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
  onApiChange: (v: string | undefined) => void;
  onCostChange: (v: ModelCost | undefined) => void;
  onHeadersChange: (v: Record<string, string>) => void;
  onCompatChange: (v: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function AdvancedModelFields({
  api,
  cost,
  headers,
  compat,
  onApiChange,
  onCostChange,
  onHeadersChange,
  onCompatChange,
  disabled,
}: AdvancedModelFieldsProps) {
  const t = useTranslations("models.advanced.model");
  const tc = useTranslations("models.advanced.model.compat");

  // --- Cost helpers ---
  const handleCostField = useCallback(
    (field: keyof ModelCost, raw: string) => {
      const num = raw === "" ? undefined : Number(raw);
      if (num !== undefined && Number.isNaN(num)) {return;}
      const next = { ...cost, [field]: num !== undefined && num >= 0 ? num : undefined };
      const hasValue = Object.values(next).some((v) => v !== undefined);
      onCostChange(hasValue ? next : undefined);
    },
    [cost, onCostChange],
  );

  // --- Compat helpers ---
  const setCompat = useCallback(
    (key: string, value: unknown) => {
      const next = { ...compat };
      if (value === undefined || value === false || value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      onCompatChange(next);
    },
    [compat, onCompatChange],
  );

  return (
    <div className="space-y-5">
      {/* API Override */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t("apiOverride")}</Label>
        <p className="text-xs text-muted-foreground">{t("apiOverrideHint")}</p>
        <Select value={api ?? ""} onValueChange={(v) => onApiChange(v || undefined)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">—</SelectItem>
            {API_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cost */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("cost.title")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["input", "output", "cacheRead", "cacheWrite"] as const).map((field) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t(`cost.${field}`)}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                className="h-7 text-sm"
                value={cost?.[field] ?? ""}
                onChange={(e) => handleCostField(field, e.target.value)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Headers */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("headers")}</Label>
        <p className="text-xs text-muted-foreground">{t("headersHint")}</p>
        <KeyValueEditor value={headers ?? {}} onChange={onHeadersChange} disabled={disabled} />
      </div>

      {/* Compat Flags — grouped */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{tc("title")}</Label>
        {COMPAT_GROUPS.map((group) => (
          <div
            key={group.labelKey}
            className="rounded-md border p-3 space-y-2"
            style={{ borderColor: "var(--border-subtle, var(--border))" }}
          >
            <p className="text-xs font-medium text-muted-foreground">{tc(group.labelKey)}</p>
            {group.fields.map((field) => {
              if (field.type === "boolean") {
                return (
                  <div key={field.key} className="flex items-center justify-between gap-3">
                    <Label className="text-sm">{tc(field.key)}</Label>
                    <Switch
                      checked={compat?.[field.key] === true}
                      onCheckedChange={(v) => setCompat(field.key, v || undefined)}
                      disabled={disabled}
                    />
                  </div>
                );
              }
              if (field.type === "checkbox") {
                const checked = compat?.[field.key] === field.value;
                return (
                  <div key={field.key} className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm">{tc(field.key)}</Label>
                      {field.hint && (
                        <p className="text-xs text-muted-foreground">{tc(`${field.key}Hint`)}</p>
                      )}
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(v) => setCompat(field.key, v ? field.value : undefined)}
                      disabled={disabled}
                    />
                  </div>
                );
              }
              // select
              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm">{tc(field.key)}</Label>
                      {field.hint && (
                        <p className="text-xs text-muted-foreground">{tc(`${field.key}Hint`)}</p>
                      )}
                    </div>
                  </div>
                  <Select
                    value={(compat?.[field.key] as string) ?? ""}
                    onValueChange={(v) => setCompat(field.key, v || undefined)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
