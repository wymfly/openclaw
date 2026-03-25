"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InheritBadge } from "@/components/shared/InheritBadge";
import { useDeckAgentsStore } from "@/stores/deck-agents";
import ToolProfileSelector from "./ToolProfileSelector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a dot-separated path from a nested object. */
function getNestedValue(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Set a dot-separated path in an updates map as a nested structure. */
function setNestedKey(updates: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  if (parts.length === 1) {
    updates[path] = value;
    return;
  }
  let current = updates;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object" || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// Thinking mode options
// ---------------------------------------------------------------------------

const THINKING_OPTIONS = ["off", "minimal", "low", "medium", "high", "xhigh", "adaptive"] as const;
type ThinkingMode = (typeof THINKING_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Event stream options
// ---------------------------------------------------------------------------

const EVENT_STREAM_KEYS = ["lifecycle", "assistant", "tool", "thinking"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentConfigTabProps {
  agentId: string;
}

export function AgentConfigTab({ agentId }: AgentConfigTabProps) {
  const t = useTranslations("agentDetail.config");
  const tc = useTranslations("common");

  const { agentRawConfig, fetchAgentRawConfig, saveAgentConfig, configSaveError } =
    useDeckAgentsStore();

  // Local edits tracking — flat dot-path keys to new values (null = reset)
  const [localEdits, setLocalEdits] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAgentRawConfig(agentId);
    setLocalEdits({});
  }, [agentId, fetchAgentRawConfig]);

  const defaults = agentRawConfig?.defaults ?? {};
  const entry = agentRawConfig?.entry ?? null;

  // Whether a field is overridden (either from persisted entry or local edits)
  const isOverride = useCallback(
    (path: string): boolean => {
      if (path in localEdits) {
        return localEdits[path] !== null;
      }
      return getNestedValue(entry, path) !== undefined;
    },
    [entry, localEdits],
  );

  // Effective value: local edit > entry > defaults
  const effectiveValue = useCallback(
    (path: string): unknown => {
      if (path in localEdits && localEdits[path] !== null) {
        return localEdits[path];
      }
      const entryVal = getNestedValue(entry, path);
      if (entryVal !== undefined) return entryVal;
      return getNestedValue(defaults, path);
    },
    [entry, defaults, localEdits],
  );

  const handleChange = useCallback((path: string, value: unknown) => {
    setLocalEdits((prev) => ({ ...prev, [path]: value }));
  }, []);

  const handleReset = useCallback((path: string) => {
    setLocalEdits((prev) => ({ ...prev, [path]: null }));
  }, []);

  const handleResetAll = useCallback(() => {
    if (!entry) return;
    const resets: Record<string, unknown> = {};
    const editableFields = [
      "model",
      "thinkingDefault",
      "temperature",
      "tools.profile",
      "blockStreaming",
      "typingIndicator",
    ];
    for (const field of editableFields) {
      if (getNestedValue(entry, field) !== undefined) {
        resets[field] = null;
      }
    }
    setLocalEdits(resets);
  }, [entry]);

  // Count overrides and inherited
  const { overrideCount, inheritedCount } = useMemo(() => {
    const trackFields = [
      "model",
      "thinkingDefault",
      "temperature",
      "tools.profile",
      "blockStreaming",
      "typingIndicator",
    ];
    let oc = 0;
    let ic = 0;
    for (const f of trackFields) {
      if (isOverride(f)) oc++;
      else ic++;
    }
    return { overrideCount: oc, inheritedCount: ic };
  }, [isOverride]);

  // Dirty detection
  const isDirty = Object.keys(localEdits).length > 0;

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);

    // Build the flat updates to apply to the agent entry
    const updates: Record<string, unknown> = {};
    for (const [path, value] of Object.entries(localEdits)) {
      setNestedKey(updates, path, value);
    }

    const ok = await saveAgentConfig(agentId, updates);
    if (ok) {
      setLocalEdits({});
    }
    setSaving(false);
  }, [isDirty, localEdits, agentId, saveAgentConfig]);

  if (!agentRawConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-xs text-muted-foreground">{tc("loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 2x2 Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Model & Inference */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t("modelInference")}</h3>

          {/* Model */}
          <FieldRow
            label={t("model")}
            isOverride={isOverride("model")}
            onReset={() => handleReset("model")}
          >
            <input
              type="text"
              value={String(effectiveValue("model") ?? "")}
              onChange={(e) => handleChange("model", e.target.value || null)}
              className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              placeholder={String(defaults.model ?? "default")}
            />
          </FieldRow>

          {/* Thinking Default */}
          <FieldRow
            label={t("thinkingDefault")}
            isOverride={isOverride("thinkingDefault")}
            onReset={() => handleReset("thinkingDefault")}
          >
            <select
              value={String(effectiveValue("thinkingDefault") ?? "adaptive")}
              onChange={(e) => handleChange("thinkingDefault", e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {THINKING_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`thinking_${opt}` as "thinking_off")}
                </option>
              ))}
            </select>
          </FieldRow>

          {/* Temperature */}
          <FieldRow
            label={t("temperature")}
            isOverride={isOverride("temperature")}
            onReset={() => handleReset("temperature")}
          >
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={
                effectiveValue("temperature") != null ? Number(effectiveValue("temperature")) : ""
              }
              onChange={(e) =>
                handleChange("temperature", e.target.value === "" ? null : Number(e.target.value))
              }
              className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              placeholder={String(defaults.temperature ?? "0.7")}
            />
          </FieldRow>
        </div>

        {/* Card 2: Tools Profile */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t("toolsProfile")}</h3>
          <ToolProfileSelector
            value={String(effectiveValue("tools.profile") ?? "coding")}
            onChange={(profile) => handleChange("tools.profile", profile)}
            agentId={agentId}
          />
          {isOverride("tools.profile") && (
            <InheritBadge mode="override" onReset={() => handleReset("tools.profile")} />
          )}
          {!isOverride("tools.profile") && <InheritBadge mode="inherit" />}
        </div>

        {/* Card 3: Subagents */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t("subagents")}</h3>

          {/* Allow Agents mode */}
          <FieldRow
            label={t("allowAgents")}
            isOverride={isOverride("allowAgents")}
            onReset={() => handleReset("allowAgents")}
          >
            <select
              value={
                Array.isArray(effectiveValue("allowAgents"))
                  ? (effectiveValue("allowAgents") as string[]).includes("*")
                    ? "any"
                    : (effectiveValue("allowAgents") as string[]).length > 0
                      ? "list"
                      : "off"
                  : "off"
              }
              onChange={(e) => {
                const mode = e.target.value;
                if (mode === "any") handleChange("allowAgents", ["*"]);
                else if (mode === "off") handleChange("allowAgents", []);
                else handleChange("allowAgents", effectiveValue("allowAgents") ?? []);
              }}
              className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="off">{t("allowAgentsOff")}</option>
              <option value="list">{t("allowAgentsList")}</option>
              <option value="any">{t("allowAgentsAny")}</option>
            </select>
          </FieldRow>

          {/* Model Override */}
          <FieldRow
            label={t("subagentModelOverride")}
            isOverride={isOverride("subagents.model")}
            onReset={() => handleReset("subagents.model")}
          >
            <input
              type="text"
              value={String(effectiveValue("subagents.model") ?? "")}
              onChange={(e) => handleChange("subagents.model", e.target.value || null)}
              className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              placeholder={t("subagentModelPlaceholder")}
            />
          </FieldRow>
        </div>

        {/* Card 4: Delivery */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t("delivery")}</h3>

          {/* Block Streaming */}
          <FieldRow
            label={t("blockStreaming")}
            isOverride={isOverride("blockStreaming")}
            onReset={() => handleReset("blockStreaming")}
          >
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(effectiveValue("blockStreaming"))}
                onChange={(e) => handleChange("blockStreaming", e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-xs text-muted-foreground">
                {effectiveValue("blockStreaming") ? t("enabled") : t("disabled")}
              </span>
            </label>
          </FieldRow>

          {/* Event Streams */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("eventStreams")}</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_STREAM_KEYS.map((key) => {
                const streams = (effectiveValue("eventStreams") ?? []) as string[];
                const checked = streams.includes(key);
                return (
                  <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...streams, key]
                          : streams.filter((s) => s !== key);
                        handleChange("eventStreams", next);
                      }}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-xs text-foreground">
                      {t(`eventStream_${key}` as "eventStream_lifecycle")}
                    </span>
                  </label>
                );
              })}
            </div>
            {isOverride("eventStreams") ? (
              <InheritBadge mode="override" onReset={() => handleReset("eventStreams")} />
            ) : (
              <InheritBadge mode="inherit" />
            )}
          </div>

          {/* Typing Indicator */}
          <FieldRow
            label={t("typingIndicator")}
            isOverride={isOverride("typingIndicator")}
            onReset={() => handleReset("typingIndicator")}
          >
            <select
              value={String(effectiveValue("typingIndicator") ?? "auto")}
              onChange={(e) => handleChange("typingIndicator", e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="auto">{t("typingAuto")}</option>
              <option value="always">{t("typingAlways")}</option>
              <option value="never">{t("typingNever")}</option>
            </select>
          </FieldRow>
        </div>
      </div>

      {/* Save Bar */}
      <div className="flex flex-col gap-1 rounded-lg border border-[var(--border-subtle)] bg-card px-4 py-3">
        {configSaveError && (
          <p className="text-xs" style={{ color: "var(--destructive)" }}>
            {configSaveError}
          </p>
        )}
        <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t("overrideCount", { count: overrideCount })}
          {" / "}
          {t("inheritedCount", { count: inheritedCount })}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            disabled={overrideCount === 0}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-destructive hover:bg-[var(--destructive-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("resetAll")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || saving}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? tc("loading") : tc("save")}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow — label | control | InheritBadge
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  isOverride: boolean;
  onReset: () => void;
  children: React.ReactNode;
}

function FieldRow({ label, isOverride: isOvr, onReset, children }: FieldRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">{label}</span>
      {children}
      {isOvr ? <InheritBadge mode="override" onReset={onReset} /> : <InheritBadge mode="inherit" />}
    </div>
  );
}
