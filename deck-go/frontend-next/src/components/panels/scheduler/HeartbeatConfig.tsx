"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useAgentsStore } from "@/stores/agents";
import { useCronStore, type HeartbeatConfig as HBConfig } from "@/stores/cron";
import { NextExecutionCountdown } from "./NextExecutionCountdown";

// ---------------------------------------------------------------------------
// HeartbeatConfig component
// ---------------------------------------------------------------------------

export function HeartbeatConfig() {
  const t = useTranslations("scheduler");
  const tc = useTranslations("common");

  const {
    heartbeatConfig,
    heartbeatOverrides,
    heartbeatLoading,
    fetchHeartbeatConfig,
    updateHeartbeatConfig,
    addHeartbeatOverride,
    removeHeartbeatOverride,
    status,
  } = useCronStore();

  const { agents, fetchAgents } = useAgentsStore();

  // Load config + agents on mount
  useEffect(() => {
    void fetchHeartbeatConfig();
    void fetchAgents();
  }, [fetchHeartbeatConfig, fetchAgents]);

  // Local form state — synced from store when config loads
  const [enabled, setEnabled] = useState(false);
  const [every, setEvery] = useState("");
  const [activeStart, setActiveStart] = useState("");
  const [activeEnd, setActiveEnd] = useState("");
  const [timezone, setTimezone] = useState("");
  const [target, setTarget] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  // Override form
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideAgentId, setOverrideAgentId] = useState("");
  const [overrideEvery, setOverrideEvery] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Sync local state when config loads / changes
  useEffect(() => {
    if (!heartbeatConfig) {
      return;
    }
    setEnabled(heartbeatConfig.enabled);
    setEvery(heartbeatConfig.every ?? "");
    setActiveStart(heartbeatConfig.activeHours?.start ?? "");
    setActiveEnd(heartbeatConfig.activeHours?.end ?? "");
    setTimezone(heartbeatConfig.activeHours?.timezone ?? "");
    setTarget(heartbeatConfig.target ?? "");
    setPrompt(heartbeatConfig.prompt ?? "");
    setModel(heartbeatConfig.model ?? "");
  }, [heartbeatConfig]);

  const handleSave = async () => {
    setSaving(true);
    const patch: Partial<HBConfig> = {
      enabled,
      every: enabled ? every : undefined,
      activeHours:
        activeStart || activeEnd
          ? {
              start: activeStart || undefined,
              end: activeEnd || undefined,
              timezone: timezone || undefined,
            }
          : undefined,
      target: target || undefined,
      prompt: prompt || undefined,
      model: model || undefined,
    };
    await updateHeartbeatConfig(patch);
    setSaving(false);
  };

  const handleAddOverride = async () => {
    if (!overrideAgentId || !overrideEvery) {
      return;
    }
    setOverrideSaving(true);
    await addHeartbeatOverride(overrideAgentId, overrideEvery);
    setOverrideSaving(false);
    setShowOverrideForm(false);
    setOverrideAgentId("");
    setOverrideEvery("");
  };

  const handleRemoveOverride = async (agentId: string) => {
    if (!confirm(t("confirmRemoveOverride"))) {
      return;
    }
    await removeHeartbeatOverride(agentId);
  };

  if (heartbeatLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-[var(--muted-foreground)]">
        <p className="text-sm">{tc("loading")}</p>
      </div>
    );
  }

  // Derive a next-run timestamp for the countdown display.
  // Use cron status nextRunAtMs as a rough proxy for heartbeat next run.
  const nextRunAtMs = status?.nextRunAtMs;

  return (
    <div className="flex flex-col gap-6 p-4 max-w-xl">
      {/* Countdown */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("nextExecution")}
        </span>
        <NextExecutionCountdown
          nextRunAtMs={nextRunAtMs}
          disabled={!enabled}
          activeHours={
            activeStart && activeEnd ? { start: activeStart, end: activeEnd } : undefined
          }
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Global config card                                                */}
      {/* ----------------------------------------------------------------- */}
      <section className="flex flex-col gap-4 rounded-lg p-4 ring-1 ring-[var(--border)] bg-[var(--background)]">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("globalConfig")}</h3>

        {/* Enabled toggle */}
        <div className="flex items-center gap-2.5">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Label className="text-xs text-[var(--foreground)]">
            {enabled ? tc("on") : tc("off")}
          </Label>
        </div>

        {/* Every interval */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[var(--muted-foreground)]">{t("everyInterval")}</Label>
          <Input
            type="text"
            value={every}
            onChange={(e) => setEvery(e.target.value)}
            placeholder={t("everyPlaceholder")}
            disabled={!enabled}
            className="h-8 text-xs"
          />
        </div>

        {/* Active hours */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[var(--muted-foreground)]">{t("activeHours")}</Label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={activeStart}
              onChange={(e) => setActiveStart(e.target.value)}
              disabled={!enabled}
              className="h-8 rounded-lg border border-[var(--border)] bg-transparent px-2 text-xs text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 disabled:opacity-50"
            />
            <span className="text-xs text-[var(--muted-foreground)]">—</span>
            <input
              type="time"
              value={activeEnd}
              onChange={(e) => setActiveEnd(e.target.value)}
              disabled={!enabled}
              className="h-8 rounded-lg border border-[var(--border)] bg-transparent px-2 text-xs text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 disabled:opacity-50"
            />
          </div>
          <Input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder={t("timezonePlaceholder")}
            disabled={!enabled}
            className="h-8 text-xs"
          />
        </div>

        {/* Target agent */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[var(--muted-foreground)]">{t("targetAgent")}</Label>
          <Select value={target} onValueChange={(v) => setTarget(v ?? "")} disabled={!enabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t("selectAgent")} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name || a.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prompt */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[var(--muted-foreground)]">{t("promptTemplate")}</Label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("promptPlaceholder")}
            disabled={!enabled}
            rows={3}
            className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs transition-colors duration-150 outline-none placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 resize-none disabled:opacity-50"
          />
        </div>

        {/* Model (optional) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[var(--muted-foreground)]">{t("modelOptional")}</Label>
          <Input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={t("modelPlaceholder")}
            disabled={!enabled}
            className="h-8 text-xs"
          />
        </div>

        {/* Save */}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? tc("loading") : tc("save")}
          </Button>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Per-agent overrides                                               */}
      {/* ----------------------------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-lg p-4 ring-1 ring-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {t("perAgentOverrides")}
          </h3>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setShowOverrideForm(!showOverrideForm)}
          >
            {tc("add")}
          </Button>
        </div>

        {/* Add override form */}
        {showOverrideForm && (
          <div className="flex items-end gap-2 rounded-md bg-[var(--card)] p-3">
            <div className="flex flex-col gap-1 flex-1">
              <Label className="text-xs text-[var(--muted-foreground)]">{t("targetAgent")}</Label>
              <Select value={overrideAgentId} onValueChange={(v) => setOverrideAgentId(v ?? "")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("selectAgent")} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name || a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <Label className="text-xs text-[var(--muted-foreground)]">{t("everyInterval")}</Label>
              <Input
                type="text"
                value={overrideEvery}
                onChange={(e) => setOverrideEvery(e.target.value)}
                placeholder="30m"
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddOverride}
              disabled={overrideSaving || !overrideAgentId || !overrideEvery}
            >
              {overrideSaving ? tc("loading") : tc("save")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowOverrideForm(false)}>
              {tc("cancel")}
            </Button>
          </div>
        )}

        {/* Override table */}
        {heartbeatOverrides.length === 0 && !showOverrideForm && (
          <p className="text-xs text-[var(--text-tertiary)]">{t("noOverrides")}</p>
        )}
        {heartbeatOverrides.length > 0 && (
          <div className="flex flex-col gap-1">
            {heartbeatOverrides.map((o) => (
              <div
                key={o.agentId}
                className="flex items-center justify-between rounded-md px-3 py-2 bg-[var(--card)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {o.agentName || o.agentId}
                  </span>
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    {o.every}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveOverride(o.agentId)}
                >
                  <Trash2 size={14} className="text-[var(--destructive)]" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
