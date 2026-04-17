"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChannelsStore } from "@/stores/channels";
import { ConfigWizard, type WizardStep as ShellWizardStep } from "../ConfigWizard";
import type { WizardSpec } from "./wizard-spec.types";

type WizardRunnerProps = {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: WizardSpec;
};

type StepValues = Record<string, unknown>;
type ActionStatus = "idle" | "running" | "success" | "error";

function resolveText(value: string | undefined, t: (key: string) => string): string | undefined {
  if (!value) {
    return value;
  }
  if (!value.startsWith("$t:")) {
    return value;
  }
  const key = value.slice(3);
  if (key.startsWith("wizard.")) {
    return t(key.slice("wizard.".length));
  }
  return key;
}

function resolveRef(path: string, stepValues: StepValues): unknown {
  const [scope, stepId, root, ...rest] = path.split(".");
  if (scope !== "$steps" || !stepId || root !== "value") {
    return undefined;
  }
  let current = stepValues[stepId];
  for (const segment of rest) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function resolveParams(
  params: Record<string, string | number | boolean | { $ref: string }> | undefined,
  stepValues: StepValues,
): Record<string, unknown> | undefined {
  if (!params) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "object" && value !== null && "$ref" in value) {
        return [key, resolveRef(value.$ref, stepValues)];
      }
      return [key, value];
    }),
  );
}

function coerceFieldValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function RadioStep({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string; description?: string; badge?: string }>;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <div
          key={option.value}
          role="button"
          tabIndex={0}
          className={`cursor-pointer rounded-lg border p-3 text-left transition-colors ${
            value === option.value
              ? "border-[var(--primary)] bg-[var(--primary-muted)]"
              : "border-[var(--border)] hover:border-[var(--border-hover)]"
          }`}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              onChange(option.value);
            }
          }}
        >
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-[var(--foreground)]">{option.label}</p>
            {option.badge && (
              <span className="rounded bg-[var(--primary-muted)] px-1 py-0.5 text-[9px] font-medium text-[var(--primary)]">
                {option.badge}
              </span>
            )}
          </div>
          {option.description && (
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{option.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function FormStep({
  schema,
  value,
  onChange,
  t,
}: {
  schema: Record<string, unknown>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  t: (key: string) => string;
}) {
  const properties =
    typeof schema.properties === "object" && schema.properties !== null
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};

  return (
    <div className="space-y-3">
      {Object.entries(properties).map(([key, fieldSchema]) => {
        const inputId = `wizard-field-${key}`;
        const label =
          typeof fieldSchema.title === "string" ? (resolveText(fieldSchema.title, t) ?? key) : key;
        const placeholder =
          typeof fieldSchema.placeholder === "string"
            ? resolveText(fieldSchema.placeholder, t)
            : undefined;
        const help =
          typeof fieldSchema.description === "string"
            ? resolveText(fieldSchema.description, t)
            : undefined;
        const type = fieldSchema.format === "password" ? "password" : "text";
        return (
          <div key={key}>
            <Label htmlFor={inputId} className="text-xs">
              {label}
            </Label>
            <Input
              id={inputId}
              type={type}
              value={coerceFieldValue(value[key])}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
              placeholder={placeholder}
              className="mt-1"
            />
            {help && <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{help}</p>}
          </div>
        );
      })}
    </div>
  );
}

function InfoStep({ body }: { body: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[var(--primary-muted)] px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
      <Info size={12} className="mt-0.5 shrink-0 text-[var(--primary)]" />
      <span>{body}</span>
    </div>
  );
}

function ActionStep({
  description,
  actionStatus,
  actionMessage,
  buttonLabel,
  onRun,
}: {
  description?: string;
  actionStatus: ActionStatus;
  actionMessage: string;
  buttonLabel: string;
  onRun: () => void;
}) {
  const t = useTranslations("wizard");

  return (
    <div className="space-y-4">
      {description && <p className="text-xs text-[var(--muted-foreground)]">{description}</p>}
      <Button variant="outline" size="sm" onClick={onRun} disabled={actionStatus === "running"}>
        {actionStatus === "running" ? t("testing") : buttonLabel}
      </Button>
      {actionStatus === "success" && (
        <div className="flex items-center gap-2 text-xs text-[var(--success)]">
          <CheckCircle2 size={14} />
          <span>{actionMessage}</span>
        </div>
      )}
      {actionStatus === "error" && (
        <div className="flex items-center gap-2 text-xs text-[var(--destructive)]">
          <XCircle size={14} />
          <span>{actionMessage}</span>
        </div>
      )}
    </div>
  );
}

export function WizardRunner({ channelId, open, onOpenChange, spec }: WizardRunnerProps) {
  const t = useTranslations("wizard");
  const channelOrder = useChannelsStore((state) => state.channelOrder);
  const updateChannelConfig = useChannelsStore((state) => state.updateChannelConfig);
  const [stepValues, setStepValues] = useState<StepValues>({});
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});

  const pluginInstalled = channelOrder.includes(channelId);

  const runAction = useCallback(
    async (
      stepId: string,
      action: string,
      params: Record<string, unknown> | undefined,
      successMessage?: string,
      failureMessage?: string,
    ) => {
      setActionStatus((prev) => ({ ...prev, [stepId]: "running" }));
      setActionMessages((prev) => ({ ...prev, [stepId]: "" }));
      try {
        if (action === `channel.${channelId}.probe`) {
          const res = await fetch("/api/channels?probe=true");
          if (!res.ok) {
            throw new Error(failureMessage ?? "Probe failed");
          }
          const data = (await res.json()) as { channels?: Record<string, unknown> };
          if (!data.channels?.[channelId]) {
            throw new Error(failureMessage ?? "Channel not found");
          }
          setActionStatus((prev) => ({ ...prev, [stepId]: "success" }));
          setActionMessages((prev) => ({
            ...prev,
            [stepId]: successMessage ?? "Action succeeded",
          }));
          return true;
        }

        if (action === `channel.${channelId}.saveConfig`) {
          const ok = await updateChannelConfig(channelId, params ?? {});
          if (!ok) {
            throw new Error(failureMessage ?? "Save failed");
          }
          setActionStatus((prev) => ({ ...prev, [stepId]: "success" }));
          setActionMessages((prev) => ({
            ...prev,
            [stepId]: successMessage ?? "Saved",
          }));
          return true;
        }

        throw new Error(`Unsupported wizard action: ${action}`);
      } catch (error) {
        setActionStatus((prev) => ({ ...prev, [stepId]: "error" }));
        setActionMessages((prev) => ({
          ...prev,
          [stepId]: error instanceof Error ? error.message : (failureMessage ?? "Action failed"),
        }));
        return false;
      }
    },
    [channelId, updateChannelConfig],
  );

  const steps: ShellWizardStep[] = useMemo(() => {
    return spec.steps.map((step) => {
      switch (step.type) {
        case "radio":
          return {
            title: resolveText(step.title, t) ?? step.title,
            content: (
              <div className="space-y-3">
                {!pluginInstalled && step.id === "mode" && (
                  <div className="flex items-start gap-2 rounded-lg bg-[var(--warning-muted)] px-3 py-2 text-xs text-[var(--warning)]">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>{t("feishu.pluginNotInstalled")}</span>
                  </div>
                )}
                <RadioStep
                  options={step.options.map((option) => ({
                    ...option,
                    label: resolveText(option.label, t) ?? option.label,
                    description: resolveText(option.description, t),
                    badge: resolveText(option.badge, t),
                  }))}
                  value={
                    typeof stepValues[step.id] === "string"
                      ? (stepValues[step.id] as string)
                      : undefined
                  }
                  onChange={(value) => setStepValues((prev) => ({ ...prev, [step.id]: value }))}
                />
              </div>
            ),
            validate: () =>
              typeof stepValues[step.id] === "string" && String(stepValues[step.id]).length > 0,
          };
        case "form":
          return {
            title: resolveText(step.title, t) ?? step.title,
            content: (
              <FormStep
                schema={step.schema}
                value={(stepValues[step.id] as Record<string, unknown> | undefined) ?? {}}
                onChange={(value) => setStepValues((prev) => ({ ...prev, [step.id]: value }))}
                t={t}
              />
            ),
            validate: () => {
              const value = (stepValues[step.id] ?? {}) as Record<string, unknown>;
              const properties =
                typeof step.schema.properties === "object" && step.schema.properties !== null
                  ? (step.schema.properties as Record<string, unknown>)
                  : {};
              const required =
                Array.isArray(step.schema.required) && step.schema.required.length > 0
                  ? step.schema.required
                  : Object.keys(properties);
              return required.every((key) => coerceFieldValue(value[key]).trim().length > 0);
            },
          };
        case "action":
          return {
            title: resolveText(step.title, t) ?? step.title,
            content: (
              <ActionStep
                description={resolveText(step.description, t)}
                actionStatus={actionStatus[step.id] ?? "idle"}
                actionMessage={actionMessages[step.id] ?? ""}
                buttonLabel={t("testConnection")}
                onRun={() => {
                  const params = resolveParams(step.params, stepValues);
                  void runAction(
                    step.id,
                    step.action,
                    params,
                    resolveText(step.successMessage, t),
                    resolveText(step.failureMessage, t),
                  );
                }}
              />
            ),
          };
        case "info":
          return {
            title: resolveText(step.title, t) ?? step.title,
            content: <InfoStep body={resolveText(step.body, t) ?? step.body} />,
          };
      }
      const unreachableStep: never = step;
      throw new Error(`Unsupported wizard step type: ${JSON.stringify(unreachableStep)}`);
    });
  }, [actionMessages, actionStatus, pluginInstalled, runAction, spec.steps, stepValues, t]);

  const handleComplete = useCallback(async () => {
    const params = resolveParams(spec.onComplete.params, stepValues);
    const ok = await runAction(
      "__complete__",
      spec.onComplete.action,
      params,
      undefined,
      undefined,
    );
    if (ok) {
      setStepValues({});
      setActionStatus({});
      setActionMessages({});
      onOpenChange(false);
    }
  }, [onOpenChange, runAction, spec.onComplete.action, spec.onComplete.params, stepValues]);

  return (
    <ConfigWizard
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setStepValues({});
          setActionStatus({});
          setActionMessages({});
        }
        onOpenChange(nextOpen);
      }}
      title={t("feishu.title")}
      steps={steps}
      onComplete={() => void handleComplete()}
    />
  );
}
