"use client";

import { AlertTriangle, Minimize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pressureBarClass, pressureTextClass, formatTokens } from "@/lib/context-utils";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import { useSessionsStore } from "@/stores/sessions";

/**
 * Compact context window pressure bar for the Chat panel header.
 * Reads from both chat store (sessionMetas, always populated) and
 * sessions store (SSE-driven, populated after events arrive).
 */
export function ChatContextBar() {
  const t = useTranslations("chat");
  const ts = useTranslations("sessions");
  const activeSessionKey = useActiveSessionKey();
  const [compacting, setCompacting] = useState(false);
  const [compactError, setCompactError] = useState<string | null>(null);

  // Primary source: chat store sessionMetas (always populated on page load)
  const meta = useChatStore((s) =>
    activeSessionKey ? s.sessionMetas.find((m) => m.key === activeSessionKey) : undefined,
  );
  // Secondary source: sessions store (populated via SSE events, has richer data)
  const sessionEntry = useSessionsStore((s) =>
    activeSessionKey ? s.sessions.find((e) => e.key === activeSessionKey) : undefined,
  );
  const compactSession = useSessionsStore((s) => s.compactSession);

  // Merge: prefer sessions store if available, fall back to chat store meta
  const contextWindow = sessionEntry?.contextWindow ?? meta?.contextTokens ?? 0;
  const totalTokens = sessionEntry?.totalTokens ?? meta?.totalTokens;
  const tokensIn = sessionEntry?.tokensIn ?? 0;
  const tokensOut = sessionEntry?.tokensOut ?? 0;
  const compactionCount = sessionEntry?.compactionCount ?? 0;

  if (contextWindow <= 0) {
    return null;
  }

  const used = totalTokens ?? tokensIn + tokensOut;
  const pct = Math.min(100, Math.round((used / contextWindow) * 100));
  const totalUsed = used;
  const compacted = compactionCount > 0;

  const handleCompact = () => {
    if (!activeSessionKey || compacting) return;
    setCompacting(true);
    setCompactError(null);
    void compactSession(activeSessionKey).then((result) => {
      setCompacting(false);
      if (!result.ok) {
        setCompactError(ts("compactFailed", { reason: result.reason ?? "" }));
        setTimeout(() => setCompactError(null), 3000);
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <span className="inline-flex items-center gap-1.5 cursor-default">
            <span className="text-[10px] text-[var(--muted-foreground)]">{t("contextLabel")}</span>
            <span className="w-14 h-1.5 rounded-full overflow-hidden bg-[var(--muted)] inline-block">
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
          <p>{`${formatTokens(totalUsed)} / ${formatTokens(contextWindow)} tokens`}</p>
          {pct >= 80 && <p className="text-[var(--destructive)]">{t("contextWarning")}</p>}
          {compacted && (
            <p className="text-[var(--warning)]">
              {t("contextCompacted", { count: compactionCount })}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
      {pct >= 60 && (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <span
              role="button"
              tabIndex={0}
              onClick={handleCompact}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleCompact();
              }}
              className={cn(
                "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] cursor-pointer transition-colors",
                compacting
                  ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  : "bg-[var(--primary-muted)] text-[var(--primary)] hover:bg-[var(--primary)]/20",
              )}
            >
              <Minimize2 size={9} />
              {compacting ? ts("compacting") : ts("compact")}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{ts("compactConfirm")}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {compacted && (
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] bg-[var(--warning-muted)] text-[var(--warning-muted-text)] cursor-default">
              <AlertTriangle size={9} />
              {compactionCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("contextCompacted", { count: compactionCount })}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {compactError && (
        <span className="text-[9px] text-[var(--destructive)] px-1">{compactError}</span>
      )}
    </span>
  );
}
