"use client";

import { Copy, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useChannelsStore } from "@/stores/channels";
import { ConfigWizard, type WizardStep } from "./ConfigWizard";

type WeComTransport = "bot-ws" | "bot-webhook" | "agent-callback" | "kf-api";

interface WeComFormData {
  transport: WeComTransport | null;
  // Bot WS fields
  botId: string;
  botSecret: string;
  // Bot Webhook fields
  botToken: string;
  botEncodingAESKey: string;
  // Agent fields
  corpId: string;
  agentId: string;
  agentSecret: string;
  agentToken: string;
  agentEncodingAESKey: string;
}

const INITIAL_FORM: WeComFormData = {
  transport: null,
  botId: "",
  botSecret: "",
  botToken: "",
  botEncodingAESKey: "",
  corpId: "",
  agentId: "",
  agentSecret: "",
  agentToken: "",
  agentEncodingAESKey: "",
};

export function WeComWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("wizard");
  const { channelOrder, updateChannelConfig } = useChannelsStore();
  const [form, setForm] = useState<WeComFormData>({ ...INITIAL_FORM });
  const [probeResult, setProbeResult] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [probeMessage, setProbeMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const pluginInstalled = channelOrder.includes("wecom");

  const updateField = useCallback(
    <K extends keyof WeComFormData>(key: K, val: WeComFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  const handleCopyUrl = useCallback((url: string) => {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleProbe = useCallback(async () => {
    setProbeResult("testing");
    setProbeMessage("");
    try {
      const res = await fetch("/api/channels?probe=true");
      if (res.ok) {
        const data = await res.json();
        const wecomStatus = data.channels?.wecom;
        if (wecomStatus) {
          setProbeResult("success");
          setProbeMessage(t("wecom.probeSuccess"));
        } else {
          setProbeResult("error");
          setProbeMessage(t("wecom.probeNoChannel"));
        }
      } else {
        setProbeResult("error");
        setProbeMessage(t("wecom.probeFailed"));
      }
    } catch {
      setProbeResult("error");
      setProbeMessage(t("wecom.probeFailed"));
    }
  }, [t]);

  const buildConfigPatch = useCallback(() => {
    switch (form.transport) {
      case "bot-ws":
        return {
          bot: {
            primaryTransport: "ws",
            ws: { botId: form.botId, secret: form.botSecret },
          },
        };
      case "bot-webhook":
        return {
          bot: {
            primaryTransport: "webhook",
            webhook: { token: form.botToken, encodingAESKey: form.botEncodingAESKey },
          },
        };
      case "agent-callback":
      case "kf-api":
        return {
          agent: {
            corpId: form.corpId,
            agentId: form.agentId,
            agentSecret: form.agentSecret,
            token: form.agentToken,
            encodingAESKey: form.agentEncodingAESKey,
          },
        };
      default:
        return {};
    }
  }, [form]);

  const callbackUrl = useMemo(() => {
    if (form.transport === "bot-webhook") {
      return `{GATEWAY_URL}/wecom/bot/callback`;
    }
    if (form.transport === "agent-callback") {
      return `{GATEWAY_URL}/wecom/agent/callback`;
    }
    return null;
  }, [form.transport]);

  const transportCards: Array<{
    id: WeComTransport;
    title: string;
    desc: string;
  }> = useMemo(
    () => [
      { id: "bot-ws", title: t("wecom.transportBotWs"), desc: t("wecom.transportBotWsDesc") },
      {
        id: "bot-webhook",
        title: t("wecom.transportBotWebhook"),
        desc: t("wecom.transportBotWebhookDesc"),
      },
      {
        id: "agent-callback",
        title: t("wecom.transportAgentCallback"),
        desc: t("wecom.transportAgentCallbackDesc"),
      },
      { id: "kf-api", title: t("wecom.transportKfApi"), desc: t("wecom.transportKfApiDesc") },
    ],
    [t],
  );

  // Step 1: transport selection
  const step1Content = (
    <div className="space-y-3">
      {!pluginInstalled && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--warning-muted)] px-3 py-2 text-xs text-[var(--warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{t("wecom.pluginNotInstalled")}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {transportCards.map((card) => (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer rounded-lg border p-3 text-left transition-colors",
              form.transport === card.id
                ? "border-[var(--primary)] bg-[var(--primary-muted)]"
                : "border-[var(--border)] hover:border-[var(--border-hover)]",
            )}
            onClick={() => updateField("transport", card.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                updateField("transport", card.id);
              }
            }}
          >
            <p className="text-xs font-medium text-[var(--foreground)]">{card.title}</p>
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // Step 2: credentials
  const step2Content = (
    <div className="space-y-3">
      {form.transport === "bot-ws" && (
        <>
          <div>
            <Label className="text-xs">{t("wecom.botId")}</Label>
            <Input
              value={form.botId}
              onChange={(e) => updateField("botId", e.target.value)}
              placeholder={t("wecom.botIdHint")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("wecom.botSecret")}</Label>
            <Input
              type="password"
              value={form.botSecret}
              onChange={(e) => updateField("botSecret", e.target.value)}
              placeholder={t("wecom.botSecretHint")}
              className="mt-1"
            />
          </div>
        </>
      )}
      {form.transport === "bot-webhook" && (
        <>
          <div>
            <Label className="text-xs">{t("wecom.token")}</Label>
            <Input
              value={form.botToken}
              onChange={(e) => updateField("botToken", e.target.value)}
              placeholder={t("wecom.tokenHint")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("wecom.encodingAESKey")}</Label>
            <Input
              value={form.botEncodingAESKey}
              onChange={(e) => updateField("botEncodingAESKey", e.target.value)}
              placeholder={t("wecom.encodingAESKeyHint")}
              className="mt-1"
            />
          </div>
        </>
      )}
      {(form.transport === "agent-callback" || form.transport === "kf-api") && (
        <>
          <div>
            <Label className="text-xs">{t("wecom.corpId")}</Label>
            <Input
              value={form.corpId}
              onChange={(e) => updateField("corpId", e.target.value)}
              placeholder={t("wecom.corpIdHint")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("wecom.agentId")}</Label>
            <Input
              value={form.agentId}
              onChange={(e) => updateField("agentId", e.target.value)}
              placeholder={t("wecom.agentIdHint")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("wecom.agentSecret")}</Label>
            <Input
              type="password"
              value={form.agentSecret}
              onChange={(e) => updateField("agentSecret", e.target.value)}
              placeholder={t("wecom.agentSecretHint")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("wecom.token")}</Label>
            <Input
              value={form.agentToken}
              onChange={(e) => updateField("agentToken", e.target.value)}
              placeholder={t("wecom.tokenHint")}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{t("wecom.encodingAESKey")}</Label>
            <Input
              value={form.agentEncodingAESKey}
              onChange={(e) => updateField("agentEncodingAESKey", e.target.value)}
              placeholder={t("wecom.encodingAESKeyHint")}
              className="mt-1"
            />
          </div>
        </>
      )}
    </div>
  );

  // Step 3: callback URL (only for webhook / agent-callback)
  const step3Content = (
    <div className="space-y-3">
      {callbackUrl ? (
        <>
          <p className="text-xs text-[var(--muted-foreground)]">{t("wecom.callbackUrlDesc")}</p>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--neutral-muted)] px-3 py-2">
            <code className="flex-1 text-xs font-mono text-[var(--foreground)] break-all">
              {callbackUrl}
            </code>
            <Button variant="ghost" size="icon-sm" onClick={() => handleCopyUrl(callbackUrl)}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)]">{t("wecom.callbackUrlNote")}</p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">{t("wecom.noCallbackNeeded")}</p>
      )}
    </div>
  );

  // Step 4: connection test
  const step4Content = (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">{t("wecom.testDesc")}</p>
      <div className="flex items-start gap-2 rounded-lg bg-[var(--primary-muted)] px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
        <Info size={12} className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <span>{t("wecom.probeConfigNote")}</span>
      </div>
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
        <div className="flex items-center gap-2 text-xs text-[var(--destructive)]">
          <XCircle size={14} />
          <span>{probeMessage}</span>
        </div>
      )}
    </div>
  );

  const steps: WizardStep[] = useMemo(
    () => [
      {
        title: t("wecom.step1Title"),
        content: step1Content,
        validate: () => form.transport !== null,
      },
      {
        title: t("wecom.step2Title"),
        content: step2Content,
        validate: () => {
          switch (form.transport) {
            case "bot-ws":
              return form.botId.trim() !== "" && form.botSecret.trim() !== "";
            case "bot-webhook":
              return form.botToken.trim() !== "" && form.botEncodingAESKey.trim() !== "";
            case "agent-callback":
            case "kf-api":
              return (
                form.corpId.trim() !== "" &&
                form.agentSecret.trim() !== "" &&
                form.agentToken.trim() !== "" &&
                form.agentEncodingAESKey.trim() !== ""
              );
            default:
              return false;
          }
        },
      },
      {
        title: t("wecom.step3Title"),
        content: step3Content,
      },
      {
        title: t("wecom.step4Title"),
        content: step4Content,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, form, probeResult, probeMessage, copied, pluginInstalled],
  );

  const handleComplete = useCallback(async () => {
    const patch = buildConfigPatch();
    await updateChannelConfig("wecom", patch);
    setForm({ ...INITIAL_FORM });
    setProbeResult("idle");
    onOpenChange(false);
  }, [buildConfigPatch, updateChannelConfig, onOpenChange]);

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
      title={t("wecom.title")}
      steps={steps}
      onComplete={() => void handleComplete()}
    />
  );
}
