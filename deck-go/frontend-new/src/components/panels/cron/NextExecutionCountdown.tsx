import { useEffect, useState } from "react";
import { PanelPill } from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";

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

export function NextExecutionCountdown(props: { nextRunAtMs?: number; disabled?: boolean }) {
  const t = useTranslations("scheduler");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (props.disabled || props.nextRunAtMs == null) {
      return undefined;
    }
    const remaining = props.nextRunAtMs - Date.now();
    const intervalMs = remaining < 60_000 ? 1000 : 60_000;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [props.disabled, props.nextRunAtMs, now]);

  if (props.disabled) {
    return <PanelPill>{t("disabled")}</PanelPill>;
  }
  if (props.nextRunAtMs == null) {
    return <PanelPill>--</PanelPill>;
  }
  const remaining = props.nextRunAtMs - now;
  if (remaining <= 0) {
    return <PanelPill tone="positive">{t("imminent")}</PanelPill>;
  }
  return <PanelPill>{formatRemaining(remaining)}</PanelPill>;
}
