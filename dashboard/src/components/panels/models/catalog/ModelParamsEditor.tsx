"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { AllowlistEntry } from "@/stores/models";

const ANTHROPIC_APIS = new Set(["anthropic-messages", "bedrock-converse-stream"]);

const DEBOUNCE_MS = 500;
const DEFAULT_BUDGET = 10000;
const MIN_BUDGET = 1000;
const MAX_BUDGET = 100000;
const BUDGET_STEP = 1000;

interface ModelParamsEditorProps {
  modelRef: string;
  entry: AllowlistEntry;
  providerApi?: string;
  onUpdate: (ref: string, entry: Partial<AllowlistEntry>) => void;
}

/**
 * Per-model parameter editor shown when a model is enabled in the allowlist.
 * Provides dedicated controls for alias, streaming, thinking, and a raw JSON
 * editor for advanced parameters.
 */
export function ModelParamsEditor({
  modelRef,
  entry,
  providerApi,
  onUpdate,
}: ModelParamsEditorProps) {
  const t = useTranslations("models");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Local state derived from entry ---
  const [alias, setAlias] = useState(entry.alias ?? "");
  const [streaming, setStreaming] = useState(entry.streaming ?? true);
  const [thinkingType, setThinkingType] = useState<"disabled" | "enabled">(() => {
    const thinking = entry.params?.thinking as Record<string, unknown> | undefined;
    return thinking?.type === "enabled" ? "enabled" : "disabled";
  });
  const [thinkingBudget, setThinkingBudget] = useState<number>(() => {
    const thinking = entry.params?.thinking as Record<string, unknown> | undefined;
    return typeof thinking?.budget_tokens === "number" ? thinking.budget_tokens : DEFAULT_BUDGET;
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(entry.params ?? {}, null, 2));
  const [jsonError, setJsonError] = useState(false);

  const showThinking = providerApi != null && ANTHROPIC_APIS.has(providerApi);

  // Sync local state when entry changes externally (e.g. another tab)
  useEffect(() => {
    setAlias(entry.alias ?? "");
    setStreaming(entry.streaming ?? true);
    const thinking = entry.params?.thinking as Record<string, unknown> | undefined;
    setThinkingType(thinking?.type === "enabled" ? "enabled" : "disabled");
    setThinkingBudget(
      typeof thinking?.budget_tokens === "number" ? thinking.budget_tokens : DEFAULT_BUDGET,
    );
    setJsonText(JSON.stringify(entry.params ?? {}, null, 2));
    setJsonError(false);
  }, [entry]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Debounced save
  const debouncedUpdate = useCallback(
    (partial: Partial<AllowlistEntry>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onUpdate(modelRef, partial);
      }, DEBOUNCE_MS);
    },
    [modelRef, onUpdate],
  );

  // Build params object from dedicated controls, preserving unknown fields
  const buildParams = useCallback(
    (
      overrideThinkingType?: "disabled" | "enabled",
      overrideBudget?: number,
    ): Record<string, unknown> => {
      const base = { ...entry.params };
      const tt = overrideThinkingType ?? thinkingType;
      const budget = overrideBudget ?? thinkingBudget;

      if (showThinking && tt === "enabled") {
        base.thinking = { type: "enabled", budget_tokens: budget };
      } else {
        delete base.thinking;
      }
      return base;
    },
    [entry.params, thinkingType, thinkingBudget, showThinking],
  );

  const handleAliasChange = (value: string) => {
    setAlias(value);
    debouncedUpdate({ alias: value || undefined });
  };

  const handleStreamingChange = (value: boolean) => {
    setStreaming(value);
    debouncedUpdate({ streaming: value });
  };

  const handleThinkingTypeChange = (value: string | null) => {
    if (!value) {
      return;
    }
    const tt = value as "disabled" | "enabled";
    setThinkingType(tt);
    const params = buildParams(tt);
    setJsonText(JSON.stringify(params, null, 2));
    setJsonError(false);
    debouncedUpdate({ params });
  };

  const handleBudgetChange = (value: number) => {
    setThinkingBudget(value);
    const params = buildParams(undefined, value);
    setJsonText(JSON.stringify(params, null, 2));
    setJsonError(false);
    debouncedUpdate({ params });
  };

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      setJsonError(false);

      // Sync dedicated controls from JSON
      const thinking = parsed.thinking as Record<string, unknown> | undefined;
      if (thinking?.type === "enabled") {
        setThinkingType("enabled");
        if (typeof thinking.budget_tokens === "number") {
          setThinkingBudget(thinking.budget_tokens);
        }
      } else {
        setThinkingType("disabled");
      }

      debouncedUpdate({ params: parsed });
    } catch {
      setJsonError(true);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--muted)]/30 p-4">
      <h4 className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
        {t("catalog.params")}
      </h4>

      {/* Alias */}
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--muted-foreground)]">{t("catalog.alias")}</Label>
        <Input
          value={alias}
          onChange={(e) => handleAliasChange(e.target.value)}
          placeholder={t("catalog.aliasPlaceholder")}
          className="bg-[var(--background)] border-[var(--border)]"
        />
      </div>

      {/* Streaming */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--muted-foreground)]">{t("catalog.streaming")}</Label>
        <Switch checked={streaming} onCheckedChange={handleStreamingChange} />
      </div>

      {/* Thinking controls — only for Anthropic-compatible APIs */}
      {showThinking && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">
              {t("catalog.thinkingType")}
            </Label>
            <Select value={thinkingType} onValueChange={handleThinkingTypeChange}>
              <SelectTrigger className="bg-[var(--background)] border-[var(--border)] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">{t("catalog.thinkingDisabled")}</SelectItem>
                <SelectItem value="enabled">{t("catalog.thinkingEnabled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {thinkingType === "enabled" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[var(--muted-foreground)]">
                  {t("catalog.thinkingBudget")}
                </Label>
                <span className="text-xs font-mono text-[var(--muted-foreground)]">
                  {thinkingBudget.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[thinkingBudget]}
                onValueChange={(vals: number | readonly number[]) => {
                  const v = Array.isArray(vals) ? vals[0] : vals;
                  handleBudgetChange(v);
                }}
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                step={BUDGET_STEP}
              />
            </div>
          )}
        </>
      )}

      {/* Advanced params (collapsible JSON editor) */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t("catalog.advancedParams")}
        </button>
        {advancedOpen && (
          <div className="mt-2 space-y-1">
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50"
            />
            {jsonError && (
              <p className="text-[10px] text-[var(--destructive)]">{t("catalog.invalidJson")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
