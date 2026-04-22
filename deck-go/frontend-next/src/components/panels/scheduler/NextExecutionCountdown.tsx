"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface NextExecutionCountdownProps {
  nextRunAtMs: number | undefined;
  disabled?: boolean;
  activeHours?: { start: string; end: string };
}

/**
 * Format remaining milliseconds into a human-readable countdown string.
 * - >= 1h  -> "2h 15m"
 * - >= 1m  -> "15m"
 * - < 1m   -> "45s"
 */
function formatRemaining(ms: number): string {
  if (ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Check whether the current time falls outside the given active hours window.
 * Returns the next active window start time as a formatted string, or null
 * if we are currently inside the window.
 */
function getOutsideActiveHoursInfo(
  activeHours: { start: string; end: string } | undefined,
): string | null {
  if (!activeHours?.start || !activeHours?.end) {
    return null;
  }
  const now = new Date();
  const [startH, startM] = activeHours.start.split(":").map(Number);
  const [endH, endM] = activeHours.end.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  const isInWindow =
    startMinutes <= endMinutes
      ? nowMinutes >= startMinutes && nowMinutes < endMinutes
      : nowMinutes >= startMinutes || nowMinutes < endMinutes;

  if (isInWindow) {
    return null;
  }
  return activeHours.start;
}

export function NextExecutionCountdown({
  nextRunAtMs,
  disabled,
  activeHours,
}: NextExecutionCountdownProps) {
  const t = useTranslations("scheduler");

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (disabled || nextRunAtMs == null) {
      return;
    }
    const remaining = nextRunAtMs - Date.now();
    // Use shorter interval when < 1 minute for second-level precision.
    const intervalMs = remaining < 60_000 ? 1000 : 60_000;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [disabled, nextRunAtMs, now]);

  if (disabled) {
    return <span className="text-xs text-[var(--text-tertiary)]">{t("disabled")}</span>;
  }

  if (nextRunAtMs == null) {
    return <span className="text-xs text-[var(--text-tertiary)]">--</span>;
  }

  // Check active hours
  const outsideInfo = getOutsideActiveHoursInfo(activeHours);
  if (outsideInfo) {
    return (
      <span className="text-xs text-[var(--warning)]">
        {t("nextActiveWindow", { time: outsideInfo })}
      </span>
    );
  }

  const remaining = nextRunAtMs - now;
  if (remaining <= 0) {
    return <span className="text-xs text-[var(--success)] font-medium">{t("imminent")}</span>;
  }

  return (
    <span className="text-xs font-mono tabular-nums text-[var(--muted-foreground)]">
      {formatRemaining(remaining)}
    </span>
  );
}
