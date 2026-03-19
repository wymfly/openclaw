"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSessionsStore, type SessionEntry } from "@/stores/sessions";

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

function shortKey(key: string, maxLen = 24): string {
  return key.length > maxLen ? `${key.slice(0, maxLen)}...` : key;
}

export function ContextPressure() {
  const t = useTranslations("usage");
  const { sessions, fetchSessions } = useSessionsStore();

  useEffect(() => {
    if (sessions.length === 0) {
      void fetchSessions();
    }
  }, [sessions.length, fetchSessions]);

  const ranked = sessions
    .filter((s) => s.contextWindow > 0)
    .map((s) => ({ ...s, pct: contextPct(s) }))
    .toSorted((a, b) => b.pct - a.pct)
    .slice(0, 5);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("contextPressure")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {ranked.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs truncate mr-2 font-mono text-muted-foreground"
                  title={s.key}
                >
                  {shortKey(s.key)}
                </span>
                <span className={cn("text-xs font-medium shrink-0", pressureTextClass(s.pct))}>
                  {s.pct}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", pressureBarClass(s.pct))}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
