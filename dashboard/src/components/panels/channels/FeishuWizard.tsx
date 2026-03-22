"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useChannelsStore } from "@/stores/channels";
import { ConfigWizard, type WizardStep } from "./ConfigWizard";

type FeishuConnectionMode = "websocket" | "webhook";

interface FeishuFormData {
  connectionMode: FeishuConnectionMode | null;
  appId: string;
  appSecret: string;
}

const INITIAL_FORM: FeishuFormData = {
  connectionMode: null,
  appId: "",
  appSecret: "",
};

export function FeishuWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("wizard");
  const { channelOrder, updateChannelConfig } = useChannelsStore();
  const [form, setForm] = useState<FeishuFormData>({ ...INITIAL_FORM });
  const [probeResult, setProbeResult] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [probeMessage, setProbeMessage] = useState("");

  const pluginInstalled = channelOrder.includes("feishu");

  const updateField = useCallback(
    <K extends keyof FeishuFormData>(key: K, val: FeishuFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  const handleProbe = useCallback(async () => {
    setProbeResult("testing");
    setProbeMessage("");
    try {
      const res = await fetch("/api/channels?probe=true");
      if (res.ok) {
        const data = await res.json();
        const feishuStatus = data.channels?.feishu;
        if (feishuStatus) {
          setProbeResult("success");
          setProbeMessage(t("feishu.probeSuccess"));
        } else {
          setProbeResult("error");
          setProbeMessage(t("feishu.probeNoChannel"));
        }
      } else {
        setProbeResult("error");
        setProbeMessage(t("feishu.probeFailed"));
      }
    } catch {
      setProbeResult("error");
      setProbeMessage(t("feishu.probeFailed"));
    }
  }, [t]);

  const connectionModes: Array<{
    id: FeishuConnectionMode;
    title: string;
    desc: string;
    recommended?: boolean;
  }> = useMemo(
    () => [
      {
        id: "websocket",
        title: t("feishu.modeWebSocket"),
        desc: t("feishu.modeWebSocketDesc"),
        recommended: true,
      },
      {
        id: "webhook",
        title: t("feishu.modeWebhook"),
        desc: t("feishu.modeWebhookDesc"),
      },
    ],
    [t],
  );

  // Step 1: connection mode
  const step1Content = (
    <div className="space-y-3">
      {!pluginInstalled && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--warning-muted)] px-3 py-2 text-xs text-[var(--warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{t("feishu.pluginNotInstalled")}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {connectionModes.map((mode) => (
          <div
            key={mode.id}
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer rounded-lg border p-3 text-left transition-colors",
              form.connectionMode === mode.id
                ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                : "border-[var(--border)] hover:border-[var(--border-hover)]",
            )}
            onClick={() => updateField("connectionMode", mode.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                updateField("connectionMode", mode.id);
              }
            }}
          >
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-[var(--text-primary)]">{mode.title}</p>
              {mode.recommended && (
                <span className="rounded bg-[var(--accent-muted)] px-1 py-0.5 text-[9px] font-medium text-[var(--accent)]">
                  {t("recommended")}
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{mode.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // Step 2: credentials
  const step2Content = (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{t("feishu.appId")}</Label>
        <Input
          value={form.appId}
          onChange={(e) => updateField("appId", e.target.value)}
          placeholder={t("feishu.appIdHint")}
          className="mt-1"
        />
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{t("feishu.appIdHelp")}</p>
      </div>
      <div>
        <Label className="text-xs">{t("feishu.appSecret")}</Label>
        <Input
          type="password"
          value={form.appSecret}
          onChange={(e) => updateField("appSecret", e.target.value)}
          placeholder={t("feishu.appSecretHint")}
          className="mt-1"
        />
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{t("feishu.appSecretHelp")}</p>
      </div>
    </div>
  );

  // Step 3: connection test
  const step3Content = (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-secondary)]">{t("feishu.testDesc")}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleProbe()}
        disabled={probeResult === "testing"}
      >
        {probeResult === "testing" ? t("testing") : t("testConnection")}
      </Button>
      {probeResult === "success" && (
        <div className="flex items-center gap-2 text-xs text-[var(--success)]">
          <CheckCircle2 size={14} />
          <span>{probeMessage}</span>
        </div>
      )}
      {probeResult === "error" && (
        <div className="flex items-center gap-2 text-xs text-[var(--danger)]">
          <XCircle size={14} />
          <span>{probeMessage}</span>
        </div>
      )}
    </div>
  );

  const steps: WizardStep[] = useMemo(
    () => [
      {
        title: t("feishu.step1Title"),
        content: step1Content,
        validate: () => form.connectionMode !== null,
      },
      {
        title: t("feishu.step2Title"),
        content: step2Content,
        validate: () => form.appId.trim() !== "" && form.appSecret.trim() !== "",
      },
      {
        title: t("feishu.step3Title"),
        content: step3Content,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, form, probeResult, probeMessage, pluginInstalled],
  );

  const handleComplete = useCallback(async () => {
    const patch = {
      connectionMode: form.connectionMode,
      appId: form.appId,
      appSecret: form.appSecret,
    };
    await updateChannelConfig("feishu", patch);
    setForm({ ...INITIAL_FORM });
    setProbeResult("idle");
    onOpenChange(false);
  }, [form, updateChannelConfig, onOpenChange]);

  return (
    <ConfigWizard
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setForm({ ...INITIAL_FORM });
          setProbeResult("idle");
        }
        onOpenChange(nextOpen);
      }}
      title={t("feishu.title")}
      steps={steps}
      onComplete={() => void handleComplete()}
    />
  );
}
