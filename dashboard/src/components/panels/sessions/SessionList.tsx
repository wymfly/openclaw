"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionsStore, type SessionEntry, type SessionKind } from "@/stores/sessions";

const KIND_BADGE_STYLES: Record<SessionKind, string> = {
  direct: "bg-[var(--accent-muted)] text-[var(--accent)]",
  group: "bg-[var(--success-muted)] text-[var(--success)]",
  global: "bg-[var(--purple-muted)] text-[var(--purple)]",
  unknown: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

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

function contextPct(session: SessionEntry): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

function shortKey(key: string, maxLen = 20): string {
  return key.length > maxLen ? `${key.slice(0, maxLen)}...` : key;
}

export function SessionList() {
  const t = useTranslations("sessions");
  const { sessions, selectedKey, selectSession } = useSessionsStore();

  return (
    <div className="flex flex-col py-1">
      {sessions.map((session) => {
        const isActive = session.key === selectedKey;
        const pct = contextPct(session);

        return (
          <button
            key={session.key}
            type="button"
            className={cn(
              "relative flex flex-col gap-1.5 px-4 py-2.5 text-left transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-inset",
              isActive
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
            )}
            onClick={() => selectSession(session.key)}
          >
            {/* Active indicator */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                aria-hidden
              />
            )}

            {/* Top row: kind badge + key */}
            <div className="flex items-center gap-2 min-w-0">
              <Badge className={cn("text-[10px] h-auto py-0.5", KIND_BADGE_STYLES[session.kind])}>
                {t(session.kind)}
              </Badge>
              <span className="text-xs font-mono truncate" title={session.key}>
                {shortKey(session.key)}
              </span>
            </div>

            {/* Bottom row: model + context bar */}
            <div className="flex items-center gap-2 min-w-0">
              {session.model && (
                <span className="text-[10px] truncate shrink-0 text-[var(--text-secondary)]">
                  {session.model}
                </span>
              )}
              {session.contextWindow > 0 && (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        pressureBarClass(pct),
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-mono shrink-0", pressureTextClass(pct))}>
                    {pct}%
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
