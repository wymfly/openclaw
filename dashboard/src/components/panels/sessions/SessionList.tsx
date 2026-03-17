"use client";

import { useTranslations } from "next-intl";
import { useSessionsStore, type SessionEntry, type SessionKind } from "@/stores/sessions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KIND_COLORS: Record<SessionKind, string> = {
  direct: "#3b82f6", // blue
  group: "#22c55e", // green
  global: "#a855f7", // purple
  unknown: "#6b7280", // gray
};

/** Color for context usage percentage. */
function pressureColor(pct: number): string {
  if (pct >= 80) {
    return "#ef4444";
  }
  if (pct >= 60) {
    return "#eab308";
  }
  return "#22c55e";
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
function shortKey(key: string, maxLen = 20): string {
  return key.length > maxLen ? `${key.slice(0, maxLen)}...` : key;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SessionList — list of sessions with kind badge, key, model, and context bar.
 */
export function SessionList() {
  const t = useTranslations("sessions");
  const { sessions, selectedKey, selectSession } = useSessionsStore();

  return (
    <div className="flex flex-col">
      {sessions.map((session) => {
        const isActive = session.key === selectedKey;
        const pct = contextPct(session);
        const color = pressureColor(pct);
        const kindColor = KIND_COLORS[session.kind];

        return (
          <button
            key={session.key}
            type="button"
            className="flex flex-col gap-1.5 px-4 py-3 text-left border-b transition-colors"
            style={{
              borderColor: "var(--border)",
              backgroundColor: isActive
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
            }}
            onClick={() => selectSession(session.key)}
          >
            {/* Top row: kind badge + key */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `color-mix(in srgb, ${kindColor} 18%, transparent)`,
                  color: kindColor,
                }}
              >
                {t(session.kind)}
              </span>
              <span
                className="text-xs font-mono truncate"
                style={{ color: "var(--text-primary)" }}
                title={session.key}
              >
                {shortKey(session.key)}
              </span>
            </div>

            {/* Bottom row: model + context bar */}
            <div className="flex items-center gap-2 min-w-0">
              {session.model && (
                <span
                  className="text-[10px] truncate shrink-0"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {session.model}
                </span>
              )}
              {session.contextWindow > 0 && (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--bg-primary)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color }}>
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
