"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry, ProbeResult } from "@/stores/models";
import { AuthStatusDot } from "../shared/AuthStatusDot";
import { ProbeButton } from "./ProbeButton";

interface AuthHealthCardProps {
  entry: AuthOverviewEntry;
  probeResult?: ProbeResult;
  probeLoading: boolean;
  onProbe: () => void;
}

/** Format milliseconds to a human-readable countdown (e.g. "18h 32m"). */
function formatCountdown(ms: number): string {
  if (ms <= 0) {
    return "expired";
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/** Auth type display label. */
function authTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "api_key":
      return "API Key";
    case "oauth":
      return "OAuth";
    case "token":
      return "Token";
    case "aws-sdk":
      return "AWS SDK";
    default:
      return "\u2014";
  }
}

/** Status badge variant. */
function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "warning":
      return "secondary";
    case "missing":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Auth health overview card — shows provider auth status, type, source,
 * OAuth expiry countdown, cooldown state, and a probe diagnostic button.
 */
export function AuthHealthCard({ entry, probeResult, probeLoading, onProbe }: AuthHealthCardProps) {
  const t = useTranslations("models");

  const oauthExpiryMs = entry.oauth?.remainingMs ?? 0;
  const cooldownMs = entry.cooldown?.remainingMs ?? 0;
  // Cooldown progress: remaining / (remaining + elapsed), capped at 100%
  const cooldownUntil = entry.cooldown?.until ?? 0;
  const cooldownTotal = cooldownUntil > 0 ? cooldownUntil - Date.now() + cooldownMs : cooldownMs;
  const cooldownProgress =
    cooldownTotal > 0 ? Math.min(100, (cooldownMs / cooldownTotal) * 100) : 0;

  return (
    <Card className="transition-panel">
      {/* Header: provider name + status */}
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-3">
          <AuthStatusDot status={entry.status} size="md" />
          <CardTitle className="text-sm uppercase tracking-wide">{entry.provider}</CardTitle>
          <Badge
            variant={statusBadgeVariant(entry.status)}
            className="ml-auto text-[10px] px-2 py-0 h-4"
          >
            {t(`auth.${entry.status}`)}
          </Badge>
        </div>
      </CardHeader>

      {/* Content: auth details */}
      <CardContent className="space-y-3 pt-3">
        {/* Auth type */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("auth.type")}</span>
          <span className="font-medium text-[var(--text-primary)]">
            {authTypeLabel(entry.auth?.type)}
          </span>
        </div>

        {/* Source */}
        {entry.auth?.source && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("auth.source")}</span>
            <span className="font-mono text-[var(--text-primary)] text-[11px]">
              {entry.auth.source}
            </span>
          </div>
        )}

        {/* OAuth expiry */}
        {entry.oauth && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("auth.expires")}</span>
            <span
              className={cn(
                "font-mono text-[11px] font-medium",
                oauthExpiryMs < 3_600_000
                  ? "text-[var(--danger)]"
                  : oauthExpiryMs < 86_400_000
                    ? "text-[var(--warning)]"
                    : "text-[var(--text-primary)]",
              )}
            >
              {formatCountdown(oauthExpiryMs)}
            </span>
          </div>
        )}

        {/* Cooldown */}
        {entry.cooldown && cooldownMs > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("auth.cooldown")}</span>
              <span className="font-mono text-[11px] text-[var(--warning)]">
                {entry.cooldown.reason} &middot; {formatCountdown(cooldownMs)}
              </span>
            </div>
            {/* Simple progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full bg-[var(--warning)] transition-all duration-500"
                style={{ width: `${cooldownProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer: probe button */}
      <CardFooter>
        <ProbeButton
          provider={entry.provider}
          result={probeResult}
          onProbe={onProbe}
          loading={probeLoading}
        />
      </CardFooter>
    </Card>
  );
}
