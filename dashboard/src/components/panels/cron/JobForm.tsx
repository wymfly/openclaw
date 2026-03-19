"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCronStore, type CronJob, type CronSchedule } from "@/stores/cron";

// Schedule templates pre-fill cron expression
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

  // Sync cron expression when template changes
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
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-foreground">{job ? t("editJob") : t("addJob")}</h3>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("name")}</Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* Schedule template */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("schedule")}</Label>
        <div className="flex gap-1 flex-wrap">
          {(["every5min", "hourly", "daily", "weekly", "custom"] as TemplateKey[]).map((key) => (
            <Button
              key={key}
              variant={template === key ? "default" : "secondary"}
              size="xs"
              onClick={() => setTemplate(key)}
            >
              {t(`templates.${key}`)}
            </Button>
          ))}
        </div>
        {template === "custom" && (
          <Input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="* * * * *"
            className="mt-1 h-7 text-xs font-mono"
          />
        )}
      </div>

      {/* Session target */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("sessionTarget")}</Label>
        <div className="flex gap-2">
          {(["main", "isolated"] as const).map((mode) => (
            <Button
              key={mode}
              variant={sessionTarget === mode ? "default" : "secondary"}
              size="xs"
              onClick={() => setSessionTarget(mode)}
            >
              {t(mode)}
            </Button>
          ))}
        </div>
      </div>

      {/* Wake mode */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("wakeMode")}</Label>
        <div className="flex gap-2">
          {(["now", "next-heartbeat"] as const).map((mode) => (
            <Button
              key={mode}
              variant={wakeMode === mode ? "default" : "secondary"}
              size="xs"
              onClick={() => setWakeMode(mode)}
            >
              {t(mode === "next-heartbeat" ? "nextHeartbeat" : mode)}
            </Button>
          ))}
        </div>
      </div>

      {/* Payload type + value */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("payloadType")}</Label>
        <div className="flex gap-2">
          {(["systemEvent", "agentTurn"] as const).map((kind) => (
            <Button
              key={kind}
              variant={payloadKind === kind ? "default" : "secondary"}
              size="xs"
              onClick={() => setPayloadKind(kind)}
            >
              {t(`payloadKinds.${kind}`)}
            </Button>
          ))}
        </div>
        {payloadKind === "systemEvent" ? (
          <Input
            type="text"
            value={payloadValue}
            onChange={(e) => setPayloadValue(e.target.value)}
            placeholder={t("eventNamePlaceholder")}
            className="mt-1 h-7 text-xs"
          />
        ) : (
          <textarea
            value={payloadValue}
            onChange={(e) => setPayloadValue(e.target.value)}
            placeholder={t("agentMessagePlaceholder")}
            rows={3}
            className="mt-1 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none dark:bg-input/30"
          />
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("description")}</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none dark:bg-input/30"
        />
      </div>

      {/* Enabled */}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="text-xs text-foreground">{t("enabled")}</span>
      </label>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
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
