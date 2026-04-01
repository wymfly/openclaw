"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
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
      <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        {job ? t("editJob") : t("addJob")}
      </h3>

      {/* Name */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("name")}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-md border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        />
      </label>

      {/* Schedule template */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("schedule")}
        </span>
        <div className="flex gap-1 flex-wrap">
          {(["every5min", "hourly", "daily", "weekly", "custom"] as TemplateKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="px-2 py-1 text-[11px] rounded-md transition-colors"
              style={{
                backgroundColor: template === key ? "var(--primary)" : "var(--muted)",
                color: template === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setTemplate(key)}
            >
              {t(`templates.${key}`)}
            </button>
          ))}
        </div>
        {template === "custom" && (
          <input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="* * * * *"
            className="mt-1 px-2 py-1.5 text-xs rounded-md border font-mono"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        )}
      </label>

      {/* Session target */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("sessionTarget")}
        </span>
        <div className="flex gap-2">
          {(["main", "isolated"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="px-2 py-1 text-[11px] rounded-md transition-colors"
              style={{
                backgroundColor: sessionTarget === mode ? "var(--primary)" : "var(--muted)",
                color:
                  sessionTarget === mode ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setSessionTarget(mode)}
            >
              {t(mode)}
            </button>
          ))}
        </div>
      </label>

      {/* Wake mode */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("wakeMode")}
        </span>
        <div className="flex gap-2">
          {(["now", "next-heartbeat"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="px-2 py-1 text-[11px] rounded-md transition-colors"
              style={{
                backgroundColor: wakeMode === mode ? "var(--primary)" : "var(--muted)",
                color: wakeMode === mode ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setWakeMode(mode)}
            >
              {t(mode === "next-heartbeat" ? "nextHeartbeat" : mode)}
            </button>
          ))}
        </div>
      </label>

      {/* Payload type + value */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("payloadType")}
        </span>
        <div className="flex gap-2">
          {(["systemEvent", "agentTurn"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className="px-2 py-1 text-[11px] rounded-md transition-colors"
              style={{
                backgroundColor: payloadKind === kind ? "var(--primary)" : "var(--muted)",
                color:
                  payloadKind === kind ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
              onClick={() => setPayloadKind(kind)}
            >
              {t(`payloadKinds.${kind}`)}
            </button>
          ))}
        </div>
        {payloadKind === "systemEvent" ? (
          <input
            type="text"
            value={payloadValue}
            onChange={(e) => setPayloadValue(e.target.value)}
            placeholder={t("eventNamePlaceholder")}
            className="mt-1 px-2 py-1.5 text-xs rounded-md border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        ) : (
          <textarea
            value={payloadValue}
            onChange={(e) => setPayloadValue(e.target.value)}
            placeholder={t("agentMessagePlaceholder")}
            rows={3}
            className="mt-1 px-2 py-1.5 text-xs rounded-md border resize-none"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        )}
      </label>

      {/* Description */}
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("description")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="px-2 py-1.5 text-xs rounded-md border resize-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        />
      </label>

      {/* Enabled */}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="text-xs" style={{ color: "var(--foreground)" }}>
          {t("enabled")}
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? tc("loading") : tc("save")}
        </button>
        <button
          type="button"
          className="px-3 py-1.5 text-xs rounded-md transition-colors"
          style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          onClick={onDone}
        >
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}
