"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCronStore, type CronJob, type CronSchedule } from "@/stores/cron";

const TEMPLATES = {
  every5min: "*/5 * * * *",
  hourly: "0 * * * *",
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
  custom: "",
} as const;

type TemplateKey = keyof typeof TEMPLATES;

interface JobFormProps {
  job?: CronJob;
  onDone: () => void;
}

export function JobForm({ job, onDone }: JobFormProps) {
  const t = useTranslations("cron");
  const tc = useTranslations("common");
  const { addJob, updateJob } = useCronStore();

  const [name, setName] = useState(job?.name ?? "");
  const [template, setTemplate] = useState<TemplateKey>(() => {
    if (!job?.schedule.expr) {
      return "daily";
    }
    const match = Object.entries(TEMPLATES).find(([, v]) => v === job.schedule.expr);
    return (match?.[0] as TemplateKey) ?? "custom";
  });
  const [cronExpr, setCronExpr] = useState(job?.schedule.expr ?? TEMPLATES.daily);
  const [sessionTarget, setSessionTarget] = useState(job?.sessionTarget ?? "main");
  const [wakeMode, setWakeMode] = useState(job?.wakeMode ?? "now");
  const [payloadKind, setPayloadKind] = useState<"systemEvent" | "agentTurn">(
    (job?.payload?.kind as "systemEvent" | "agentTurn") ?? "systemEvent",
  );
  const [payloadValue, setPayloadValue] = useState(
    () => (job?.payload?.text as string) ?? (job?.payload?.message as string) ?? "",
  );
  const [description, setDescription] = useState(job?.description ?? "");
  const [enabled, setEnabled] = useState(job?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template !== "custom" && TEMPLATES[template]) {
      setCronExpr(TEMPLATES[template]);
    }
  }, [template]);

  const handleSave = async () => {
    setSaving(true);
    const schedule: CronSchedule = { kind: "cron", expr: cronExpr };
    const payload =
      payloadKind === "systemEvent"
        ? { kind: "systemEvent" as const, text: payloadValue }
        : { kind: "agentTurn" as const, message: payloadValue };

    if (job) {
      await updateJob(job.id, {
        name,
        schedule,
        sessionTarget,
        wakeMode,
        payload,
        description,
        enabled,
      });
    } else {
      await addJob({ name, schedule, sessionTarget, wakeMode, payload, description, enabled });
    }
    setSaving(false);
    onDone();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
        {job ? t("editJob") : t("addJob")}
      </h3>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("name")}</Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Schedule template */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("schedule")}</Label>
        <div className="flex gap-1 flex-wrap">
          {(["every5min", "hourly", "daily", "weekly", "custom"] as TemplateKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                template === key
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => setTemplate(key)}
            >
              {t(`templates.${key}`)}
            </button>
          ))}
        </div>
        {template === "custom" && (
          <Input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="* * * * *"
            className="mt-1 h-8 text-xs font-mono"
          />
        )}
      </div>

      {/* Session target */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("sessionTarget")}</Label>
        <div className="flex gap-2">
          {(["main", "isolated"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                sessionTarget === mode
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => setSessionTarget(mode)}
            >
              {t(mode)}
            </button>
          ))}
        </div>
      </div>

      {/* Wake mode */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("wakeMode")}</Label>
        <div className="flex gap-2">
          {(["now", "next-heartbeat"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                wakeMode === mode
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => setWakeMode(mode)}
            >
              {t(mode === "next-heartbeat" ? "nextHeartbeat" : mode)}
            </button>
          ))}
        </div>
      </div>

      {/* Payload type + value */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("payloadType")}</Label>
        <div className="flex gap-2">
          {(["systemEvent", "agentTurn"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                payloadKind === kind
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              onClick={() => setPayloadKind(kind)}
            >
              {t(`payloadKinds.${kind}`)}
            </button>
          ))}
        </div>
        {payloadKind === "systemEvent" ? (
          <Input
            type="text"
            value={payloadValue}
            onChange={(e) => setPayloadValue(e.target.value)}
            placeholder={t("eventNamePlaceholder")}
            className="mt-1 h-8 text-xs"
          />
        ) : (
          <textarea
            value={payloadValue}
            onChange={(e) => setPayloadValue(e.target.value)}
            placeholder={t("agentMessagePlaceholder")}
            rows={3}
            className="mt-1 w-full min-w-0 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs transition-colors duration-150 outline-none placeholder:text-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 resize-none"
          />
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-[var(--text-secondary)]">{t("description")}</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs transition-colors duration-150 outline-none placeholder:text-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 resize-none"
        />
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-2.5">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <Label className="text-xs text-[var(--text-primary)]">{t("enabled")}</Label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? tc("loading") : tc("save")}
        </Button>
        <Button variant="outline" size="sm" onClick={onDone}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}
