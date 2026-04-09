"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

type ProbeStatus = "idle" | "testing" | "success" | "error";

interface ValidationStepProps {
  /** Channel ID to probe (e.g. "wecom", "feishu", "telegram") */
  channelId: string;
  /** Optional custom probe handler. Defaults to fetching /api/channels?probe=true */
  onProbe?: () => Promise<{ ok: boolean; message?: string }>;
}

/**
 * Reusable wizard step that runs a connection probe and shows the result.
 * Extracted from WeComWizard/FeishuWizard shared probe patterns.
 */
export function ValidationStep({ channelId, onProbe }: ValidationStepProps) {
  const t = useTranslations("wizard");
  const [status, setStatus] = useState<ProbeStatus>("idle");
  const [message, setMessage] = useState("");

  const handleProbe = useCallback(async () => {
    setStatus("testing");
    setMessage("");
    try {
      if (onProbe) {
        const result = await onProbe();
        setStatus(result.ok ? "success" : "error");
        setMessage(result.message ?? "");
        return;
      }
      // Default probe: call channels API with probe flag
      const res = await fetch("/api/channels?probe=true");
      if (res.ok) {
        const data = await res.json();
        const channelStatus = data.channels?.[channelId];
        if (channelStatus) {
          setStatus("success");
          setMessage(t("validation.probeSuccess"));
        } else {
          setStatus("error");
          setMessage(t("validation.probeNoChannel"));
        }
      } else {
        setStatus("error");
        setMessage(t("validation.probeFailed"));
      }
    } catch {
      setStatus("error");
      setMessage(t("validation.probeFailed"));
    }
  }, [channelId, onProbe, t]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">{t("validation.description")}</p>

      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleProbe()}
        disabled={status === "testing"}
        className="w-full"
      >
        {status === "testing" ? t("validation.testing") : t("validation.testConnection")}
      </Button>

      {status !== "idle" && status !== "testing" && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
          style={{
            backgroundColor:
              status === "success"
                ? "color-mix(in srgb, var(--success) 10%, transparent)"
                : "color-mix(in srgb, var(--destructive) 10%, transparent)",
            color:
              status === "success" ? "var(--success-muted-text)" : "var(--destructive-muted-text)",
          }}
        >
          {status === "success" ? (
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          ) : (
            <XCircle size={14} className="shrink-0 mt-0.5" />
          )}
          <span>{message}</span>
        </div>
      )}

      {status === "idle" && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
          style={{
            backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
            color: "var(--warning-muted-text)",
          }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{t("validation.hint")}</span>
        </div>
      )}
    </div>
  );
}
