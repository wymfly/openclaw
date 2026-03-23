"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useSessionsStore, type SessionEntry } from "@/stores/sessions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return color based on context usage percentage. */
function pressureColor(pct: number): string {
  if (pct >= 80) {
    return "var(--danger)";
  }
  if (pct >= 60) {
    return "var(--warning)";
  }
  return "var(--success)";
}

/** Compute context usage percentage (0-100). */
function contextPct(session: SessionEntry): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

/** Truncate session key for display. */
function shortKey(key: string, maxLen = 24): string {
  return key.length > maxLen ? `${key.slice(0, maxLen)}...` : key;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ContextPressure — shows per-session context window usage as colored
 * progress bars. Renders the top 5 sessions by pressure.
 */
export function ContextPressure() {
  const t = useTranslations("usage");
  const { sessions, fetchSessions } = useSessionsStore();

  useEffect(() => {
    // Only fetch if sessions are not yet loaded.
    if (sessions.length === 0) {
      void fetchSessions();
    }
  }, [sessions.length, fetchSessions]);

  // Pick sessions that have a known context window, sort by pressure descending, take top 5.
  const ranked = sessions
    .filter((s) => s.contextWindow > 0)
    .map((s) => ({ ...s, pct: contextPct(s) }))
    .toSorted((a, b) => b.pct - a.pct)
    .slice(0, 5);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        {t("contextPressure")}
      </p>
      <div className="space-y-2.5">
        {ranked.map((s) => {
          const color = pressureColor(s.pct);
          return (
            <div key={s.key}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs truncate mr-2 font-mono"
                  style={{ color: "var(--text-secondary)" }}
                  title={s.key}
                >
                  {shortKey(s.key)}
                </span>
                <span className="text-xs font-medium shrink-0" style={{ color }}>
                  {s.pct}%
                </span>
              </div>
              {/* Bar */}
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--bg-primary)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
