"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SessionEntry } from "@/stores/sessions";

function contextPct(session: SessionEntry): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

function pressureBarClass(pct: number): string {
  if (pct >= 80) {
    return "bg-[var(--danger)]";
  }
  if (pct >= 60) {
    return "bg-[var(--warning)]";
  }
  return "bg-[var(--success)]";
}

function pressureTextClass(pct: number): string {
  if (pct >= 80) {
    return "text-[var(--danger)]";
  }
  if (pct >= 60) {
    return "text-[var(--warning)]";
  }
  return "text-[var(--success)]";
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

export function ContextHealthBar({ session }: { session: SessionEntry }) {
  const t = useTranslations("sessions");
  const pct = contextPct(session);
  const totalUsed = session.tokensIn + session.tokensOut;
  const showBar = session.contextWindow > 0;

  return (
    <div className="flex items-center gap-2">
      {showBar ? (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <span className="inline-flex items-center gap-1.5 cursor-default">
              <span className="w-16 h-1.5 rounded-full overflow-hidden bg-[var(--bg-tertiary)] inline-block">
                <span
                  className={cn(
                    "block h-full rounded-full transition-all duration-300",
                    pressureBarClass(pct),
                  )}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className={cn("text-[10px] font-mono font-semibold", pressureTextClass(pct))}>
                {pct}%
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {pct >= 80
                ? t("healthWarning")
                : `${t("context")}: ${formatTokens(totalUsed)} / ${formatTokens(session.contextWindow)}`}
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
          {formatTokens(totalUsed)} tokens
        </span>
      )}

      {session.compactionCount === 0 ? (
        <span className="inline-flex items-center text-[var(--success)]">
          <CheckCircle2 size={12} />
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-[var(--warning)]/10 text-[var(--warning)]">
              <AlertTriangle size={10} />
              {session.compactionCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("compactionWarning", { count: session.compactionCount })}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
