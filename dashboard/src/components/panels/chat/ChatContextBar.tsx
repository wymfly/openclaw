"use client";

import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { contextPct, pressureBarClass, pressureTextClass, formatTokens } from "@/lib/context-utils";
import { cn } from "@/lib/utils";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import { useSessionsStore } from "@/stores/sessions";

/**
 * Compact context window pressure bar for the Chat panel header.
 * Reads from the sessions store (SSE-driven), no extra API calls.
 */
export function ChatContextBar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const session = useSessionsStore((s) =>
    activeSessionKey ? s.sessions.find((e) => e.key === activeSessionKey) : undefined,
  );

  if (!session || session.contextWindow <= 0) {
    return null;
  }

  const pct = contextPct(session);
  const totalUsed = session.tokensIn + session.tokensOut;

  return (
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
        <p>
          {pct >= 80
            ? t("contextWarning")
            : `${formatTokens(totalUsed)} / ${formatTokens(session.contextWindow)} tokens`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
