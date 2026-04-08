"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { type ChannelHealthStatus } from "@/stores/channels";

const STATUS_CONFIG: Record<
  ChannelHealthStatus,
  { dot: string; text: string; label: string }
> = {
  healthy: {
    dot: "bg-[var(--status-connected)]",
    text: "text-[var(--success-muted-text)]",
    label: "healthy",
  },
  degraded: {
    dot: "bg-[var(--warning)]",
    text: "text-[var(--warning-muted-text)]",
    label: "degraded",
  },
  down: {
    dot: "bg-[var(--destructive)]",
    text: "text-[var(--destructive-muted-text)]",
    label: "down",
  },
  unknown: {
    dot: "bg-[var(--muted-foreground)]",
    text: "text-[var(--muted-foreground)]",
    label: "unknown",
  },
};

interface ChannelHealthBadgeProps {
  status: ChannelHealthStatus;
  latencyMs?: number;
  error?: string;
  lastCheckedAt?: number;
  /** Compact mode: dot only, no text */
  compact?: boolean;
}

export function ChannelHealthBadge({
  status,
  latencyMs,
  error,
  lastCheckedAt,
  compact,
}: ChannelHealthBadgeProps) {
  const t = useTranslations("channels");
  const config = STATUS_CONFIG[status];

  const tooltipParts: string[] = [t(`health.${config.label}`)];
  if (latencyMs != null) {
    tooltipParts.push(`${latencyMs}ms`);
  }
  if (error) {
    tooltipParts.push(error);
  }
  if (lastCheckedAt) {
    tooltipParts.push(new Date(lastCheckedAt).toLocaleTimeString());
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", !compact && config.text)}
      title={tooltipParts.join(" · ")}
    >
      <span
        className={cn(
          "inline-block rounded-full shrink-0",
          config.dot,
          compact ? "w-1.5 h-1.5" : "w-2 h-2",
          status === "healthy" && "animate-pulse",
        )}
      />
      {!compact && (
        <span className="text-[10px] font-medium">{t(`health.${config.label}`)}</span>
      )}
    </span>
  );
}
