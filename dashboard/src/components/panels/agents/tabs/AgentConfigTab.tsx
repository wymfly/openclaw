"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InheritBadge } from "@/components/shared/InheritBadge";
import { useDeckAgentsStore } from "@/stores/deck-agents";
import { useModelsStore } from "@/stores/models";
import { FallbackChainEditor } from "./FallbackChainEditor";
import { ToolsCatalog } from "./ToolsCatalog";
import ToolProfileSelector from "./ToolProfileSelector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract model string from either a plain string or {primary: string} config object. */
function resolveModelString(val: unknown): string {
  if (typeof val === "string") {return val;}
  if (val && typeof val === "object" && "primary" in val) {
    return String((val as Record<string, unknown>).primary ?? "");
  }
  return "";
}

/** Read a dot-separated path from a nested object. */
function getNestedValue(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) {return undefined;}
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {return undefined;}
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
    if (
      !(parts[i] in current) ||
      typeof current[parts[i]] !== "object" ||
      current[parts[i]] === null
    ) {
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
  // When localEdits[path] is explicitly null (reset), skip entry and fall through to defaults.
  const effectiveValue = useCallback(
    (path: string): unknown => {
      if (path in localEdits) {
        if (localEdits[path] !== null) {return localEdits[path];}
        // Reset: skip entry, show defaults
        return getNestedValue(defaults, path);
      }
      const entryVal = getNestedValue(entry, path);
      if (entryVal !== undefined) {return entryVal;}
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
    if (!entry) {return;}
    const resets: Record<string, unknown> = {};
    const editableFields = [
      "model",
      "model.fallbacks",
      "thinkingDefault",
      "temperature",
      "tools.profile",
      "tools.allow",
      "tools.deny",
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
      "model.fallbacks",
      "thinkingDefault",
      "temperature",
      "tools.profile",
      "tools.allow",
      "tools.deny",
      "blockStreaming",
      "typingIndicator",
    ];
    let oc = 0;
    let ic = 0;
    for (const f of trackFields) {
      if (isOverride(f)) {oc++;}
      else {ic++;}
    }
    return { overrideCount: oc, inheritedCount: ic };
  }, [isOverride]);

  // Dirty detection
  const isDirty = Object.keys(localEdits).length > 0;

  const handleSave = useCallback(async () => {
    if (!isDirty) {return;}
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
            <ModelCombobox
              value={resolveModelString(effectiveValue("model"))}
              placeholder={resolveModelString(defaults.model) || "default"}
              onChange={(v) => handleChange("model", v || null)}
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

        {/* Card 2b: Model Fallback */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-card p-4 flex flex-col gap-3">
          <FallbackChainEditor
            fallbacks={
              Array.isArray(effectiveValue("model.fallbacks"))
                ? (effectiveValue("model.fallbacks") as string[])
                : []
            }
            onChange={(fb) => handleChange("model.fallbacks", fb.length > 0 ? fb : null)}
          />
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
                if (mode === "any") {handleChange("allowAgents", ["*"]);}
                else if (mode === "off") {handleChange("allowAgents", []);}
                else {handleChange("allowAgents", effectiveValue("allowAgents") ?? []);}
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
            <ModelCombobox
              value={String(effectiveValue("subagents.model") ?? "")}
              placeholder={t("subagentModelPlaceholder")}
              onChange={(v) => handleChange("subagents.model", v || null)}
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

      {/* Tools Catalog (collapsible, below grid) */}
      <ToolsCatalog
        agentId={agentId}
        toolsAllow={
          Array.isArray(effectiveValue("tools.allow"))
            ? (effectiveValue("tools.allow") as string[])
            : []
        }
        toolsDeny={
          Array.isArray(effectiveValue("tools.deny"))
            ? (effectiveValue("tools.deny") as string[])
            : []
        }
        onOverrideChange={(allow, deny) => {
          handleChange("tools.allow", allow.length > 0 ? allow : null);
          handleChange("tools.deny", deny.length > 0 ? deny : null);
        }}
      />

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

// ---------------------------------------------------------------------------
// ModelCombobox — searchable dropdown with available models
// ---------------------------------------------------------------------------

interface ModelComboboxProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function ModelCombobox({ value, placeholder, onChange }: ModelComboboxProps) {
  const { usableModels: models, fetchUsableModels } = useModelsStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (models.length === 0) {
      void fetchUsableModels();
    }
  }, [models.length, fetchUsableModels]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) {return;}
    const handler = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) {return models.slice(0, 50);}
    return models
      .filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [models, search]);

  // Group by provider
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const m of filtered) {
      const arr = map.get(m.provider) ?? [];
      arr.push(m);
      map.set(m.provider, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={open ? search : value}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) {setOpen(true);}
        }}
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        onBlur={() => {
          // Close dropdown after short delay (allow click on option)
          setTimeout(() => {
            setOpen(false);
            setSearch("");
          }, 150);
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 pr-6 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        readOnly={!open}
      />
      <ChevronDown
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-[var(--border)] bg-popover shadow-md"
          role="listbox"
        >
          {[...grouped.entries()].map(([provider, items]) => (
            <div key={provider}>
              <div className="sticky top-0 px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 backdrop-blur-sm">
                {provider}
              </div>
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={m.id === value}
                  className={`w-full text-left px-2 py-1 text-xs cursor-pointer hover:bg-accent transition-colors ${m.id === value ? "bg-accent font-medium" : ""}`}
                  onClick={() => {
                    onChange(m.id);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <span className="text-foreground">{m.name}</span>
                  <span className="ml-1 text-muted-foreground text-[10px]">{m.id}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
