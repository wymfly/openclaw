"use client";

import { Loader2, Wifi, WifiOff, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useChannelsStore, type ProbeResult } from "@/stores/channels";

interface ChannelProbeStatusProps {
  channelId: string;
}

export function ChannelProbeStatus({ channelId }: ChannelProbeStatusProps) {
  const t = useTranslations("channels.probe");
  const { probeResults, probing, probeChannel } = useChannelsStore();

  const isProbing = probing.has(channelId);
  const result = probeResults.get(channelId);

  const handleProbe = useCallback(() => {
    if (!isProbing) {
      void probeChannel(channelId);
    }
  }, [channelId, isProbing, probeChannel]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleProbe}
        disabled={isProbing}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          backgroundColor: "var(--background)",
        }}
      >
        {isProbing ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            {t("testing")}
          </>
        ) : (
          <>
            <Wifi size={12} />
            {t("testConnection")}
          </>
        )}
      </button>

      {result && !isProbing && <ProbeResultBadge result={result} />}
    </div>
  );
}

function ProbeResultBadge({ result }: { result: ProbeResult }) {
  const t = useTranslations("channels.probe");

  const config = {
    success: {
      icon: Wifi,
      color: "var(--status-connected)",
      bg: "color-mix(in srgb, var(--status-connected) 12%, transparent)",
      label: t("success"),
    },
    failure: {
      icon: WifiOff,
      color: "var(--status-disconnected)",
      bg: "color-mix(in srgb, var(--status-disconnected) 12%, transparent)",
      label: t("failure"),
    },
    timeout: {
      icon: Clock,
      color: "var(--warning)",
      bg: "color-mix(in srgb, var(--warning) 12%, transparent)",
      label: t("timeout"),
    },
  }[result.status];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        <Icon size={10} />
        {config.label}
        {result.latencyMs != null && ` (${result.latencyMs}ms)`}
      </span>
      {result.error && (
        <span
          className="text-[10px] max-w-48 truncate"
          style={{ color: "var(--muted-foreground)" }}
        >
          {result.error}
        </span>
      )}
    </div>
  );
}
