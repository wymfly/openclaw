"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { contextPct, pressureBarClass, pressureTextClass, formatTokens } from "@/lib/context-utils";
import { cn } from "@/lib/utils";
import type { SessionEntry } from "@/stores/sessions";

const STATUS_DOT_COLOR: Record<string, string> = {
  running: "var(--primary)",
  done: "var(--success)",
  failed: "var(--destructive)",
  killed: "var(--warning)",
  timeout: "var(--warning)",
  idle: "var(--neutral-muted-text)",
};

export function ContextHealthBar({ session }: { session: SessionEntry }) {
  const t = useTranslations("sessions");
  const pct = contextPct(session);
  const totalUsed = session.totalTokens ?? session.tokensIn + session.tokensOut;
  const showBar = session.contextWindow > 0;
  const statusColor = session.status ? STATUS_DOT_COLOR[session.status] : undefined;

  return (
    <div className="flex items-center gap-2">
      {/* Status dot indicator */}
      {statusColor && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: statusColor }}
          title={session.status}
        />
      )}
      {showBar ? (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <span className="inline-flex items-center gap-1.5 cursor-default">
              <span className="w-16 h-1.5 rounded-full overflow-hidden bg-[var(--muted)] inline-block">
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
        <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
          {formatTokens(totalUsed)} tokens
        </span>
      )}

      {(session.compactionCount ?? 0) === 0 ? (
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
            <p>{t("compactionWarning", { count: session.compactionCount ?? 0 })}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
