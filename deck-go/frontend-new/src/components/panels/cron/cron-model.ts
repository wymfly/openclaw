import type { DeckGoCronJob, DeckGoCronJobInput, DeckGoCronSchedule } from "../../../api";

export type PanelState = "idle" | "loading" | "ready";
export type CronScheduleKind = DeckGoCronSchedule["kind"];
export type CronPayloadKind = "systemEvent" | "agentTurn";
export type CronTemplateKey = "every5min" | "hourly" | "daily" | "weekly";
export type CronActionState = "idle" | "creating" | "updating" | "running" | "deleting";

export type CronDraft = {
  name: string;
  scheduleKind: CronScheduleKind;
  scheduleValue: string;
  sessionTarget: string;
  wakeMode: string;
  payloadKind: CronPayloadKind;
  payloadValue: string;
  agentId: string;
  description: string;
  enabled: boolean;
};

export const DEFAULT_DRAFT: CronDraft = {
  name: "",
  scheduleKind: "cron",
  scheduleValue: "0 9 * * *",
  sessionTarget: "main",
  wakeMode: "now",
  payloadKind: "systemEvent",
  payloadValue: "",
  agentId: "",
  description: "",
  enabled: true,
};

export const CRON_TEMPLATES: Array<{ key: CronTemplateKey; expr: string }> = [
  { key: "every5min", expr: "*/5 * * * *" },
  { key: "hourly", expr: "0 * * * *" },
  { key: "daily", expr: "0 9 * * *" },
  { key: "weekly", expr: "0 9 * * 1" },
];

export function formatCronDate(value?: number) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

export function summarizeSchedule(job: DeckGoCronJob) {
  if (job.schedule.kind === "cron") {
    return job.schedule.expr || "cron";
  }
  if (job.schedule.kind === "every") {
    return job.schedule.everyMs ? `every ${job.schedule.everyMs}ms` : "every";
  }
  return job.schedule.at || "at";
}

function scheduleValueFromJob(job: DeckGoCronJob) {
  if (job.schedule.kind === "every") {
    return String(job.schedule.everyMs ?? "");
  }
  if (job.schedule.kind === "at") {
    return job.schedule.at ?? "";
  }
  return job.schedule.expr ?? "";
}

function scheduleFromDraft(draft: CronDraft): DeckGoCronSchedule {
  if (draft.scheduleKind === "every") {
    return { kind: "every", everyMs: Math.trunc(Number(draft.scheduleValue)) };
  }
  if (draft.scheduleKind === "at") {
    return { kind: "at", at: draft.scheduleValue };
  }
  return { kind: "cron", expr: draft.scheduleValue };
}

function payloadKindFromJob(job: DeckGoCronJob): CronPayloadKind {
  return job.payload.kind === "agentTurn" ? "agentTurn" : "systemEvent";
}

function formatPayloadValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function payloadValueFromJob(job: DeckGoCronJob) {
  if (job.payload.kind === "agentTurn") {
    return formatPayloadValue(job.payload.message ?? job.payload.prompt);
  }
  return formatPayloadValue(job.payload.text);
}

export function draftFromJob(job: DeckGoCronJob): CronDraft {
  const payloadKind = payloadKindFromJob(job);
  return {
    name: job.name,
    scheduleKind: job.schedule.kind,
    scheduleValue: scheduleValueFromJob(job),
    sessionTarget: job.sessionTarget ?? (payloadKind === "agentTurn" ? "isolated" : "main"),
    wakeMode: job.wakeMode ?? "now",
    payloadKind,
    payloadValue: payloadValueFromJob(job),
    agentId: job.agentId ?? "",
    description: job.description ?? "",
    enabled: job.enabled,
  };
}

export function cronInputFromDraft(draft: CronDraft): DeckGoCronJobInput {
  const input: DeckGoCronJobInput = {
    name: draft.name,
    schedule: scheduleFromDraft(draft),
    sessionTarget: draft.sessionTarget,
    wakeMode: draft.wakeMode,
    payload:
      draft.payloadKind === "agentTurn"
        ? { kind: "agentTurn", message: draft.payloadValue }
        : { kind: "systemEvent", text: draft.payloadValue },
    description: draft.description,
    enabled: draft.enabled,
  };
  const agentId = draft.agentId.trim();
  if (agentId) {
    input.agentId = agentId;
  }
  return input;
}
