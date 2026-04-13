import type { ChannelAccount, ChannelInfo, ProbeResult } from "@/stores/channels";
import {
  getAccountHealthDiagnostic,
  type ChannelDiagnosticTone,
} from "./channel-health-diagnostics";

export interface ChannelHealthAlert {
  severity: Exclude<ChannelDiagnosticTone, "success" | "neutral">;
  titleKey: ReturnType<typeof getAccountHealthDiagnostic>["titleKey"];
  descriptionKey: ReturnType<typeof getAccountHealthDiagnostic>["descriptionKey"];
  nextStepKey: ReturnType<typeof getAccountHealthDiagnostic>["nextStepKey"];
}

export function getAccountHealthAlert(account: ChannelAccount): ChannelHealthAlert | null {
  const diagnostic = getAccountHealthDiagnostic(account);
  if (diagnostic.tone === "success" || diagnostic.tone === "neutral") {
    return null;
  }

  return {
    severity: diagnostic.tone,
    titleKey: diagnostic.titleKey,
    descriptionKey: diagnostic.descriptionKey,
    nextStepKey: diagnostic.nextStepKey,
  };
}

export function countChannelAlerts(channel: ChannelInfo): number {
  return channel.accounts.filter((account) =>
    (() => {
      const alert = getAccountHealthAlert(account);
      return Boolean(alert);
    })(),
  ).length;
}

export function hasChannelProbeAlert(probeResult?: ProbeResult): boolean {
  return probeResult?.status === "failure" || probeResult?.status === "timeout";
}
