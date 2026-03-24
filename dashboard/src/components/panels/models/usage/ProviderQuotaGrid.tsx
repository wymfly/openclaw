"use client";

import { AlertTriangle, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UsageProviderStatus } from "@/stores/models";

interface ProviderQuotaGridProps {
  providers: UsageProviderStatus[];
}

/**
 * 2-column grid of provider quota cards with progress bars and reset timers.
 */
export function ProviderQuotaGrid({ providers }: ProviderQuotaGridProps) {
  const t = useTranslations("models.usage");

  if (providers.length === 0) {
    return null;
  }

  // Split providers: those with windows vs those with only errors
  const withWindows = providers.filter((p) => p.windows.length > 0);
  const errorOnly = providers.filter((p) => p.windows.length === 0 && p.error);

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
        <Shield size={12} className="text-[var(--primary)]" />
        {t("quota")}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {withWindows.map((provider) => (
          <QuotaCard key={provider.provider} provider={provider} t={t} />
        ))}
        {errorOnly.map((provider) => (
          <ErrorCard key={provider.provider} provider={provider} t={t} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  QuotaCard — provider with usage windows                            */
/* ------------------------------------------------------------------ */

interface QuotaCardProps {
  provider: UsageProviderStatus;
  t: ReturnType<typeof useTranslations>;
}

function QuotaCard({ provider, t }: QuotaCardProps) {
  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs">
          <span className="text-[var(--foreground)]">{provider.displayName}</span>
          {provider.plan && (
            <Badge variant="secondary" className="text-[10px]">
              {provider.plan}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {provider.windows.map((win) => (
          <QuotaWindow
            key={win.label}
            label={win.label}
            usedPercent={win.usedPercent}
            resetsInMs={win.resetsInMs}
            t={t}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  QuotaWindow — single usage window with progress bar                */
/* ------------------------------------------------------------------ */

interface QuotaWindowProps {
  label: string;
  usedPercent: number;
  resetsInMs: number;
  t: ReturnType<typeof useTranslations>;
}

function QuotaWindow({ label, usedPercent, resetsInMs, t }: QuotaWindowProps) {
  const barColor =
    usedPercent > 90
      ? "bg-[var(--destructive)]"
      : usedPercent > 70
        ? "bg-[var(--warning)]"
        : "bg-[var(--primary)]";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--muted-foreground)]">{label}</span>
        <span className="text-[11px] font-mono font-medium text-[var(--foreground)]">
          {usedPercent.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(usedPercent, 100)}%` }}
        />
      </div>

      <p className="text-[10px] text-[var(--muted-foreground)]">
        {t("resetsIn")} {formatDuration(resetsInMs)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ErrorCard — provider with no windows, only an error                */
/* ------------------------------------------------------------------ */

function ErrorCard({ provider, t }: QuotaCardProps) {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xs">
          <span className="text-[var(--muted-foreground)]">{provider.displayName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)]">
          <AlertTriangle size={12} className="text-[var(--warning)]" />
          <span className="text-[11px] text-[var(--muted-foreground)]">{t("noQuotaData")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Duration formatter                                                 */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d`;
  }
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
