"use client";

import { CheckCircle2, XCircle, Loader2, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";

interface TestResult {
  ok: boolean;
  error?: string;
  latencyMs: number;
  timestamp: number;
  check?: string;
}

interface ChannelTestToolProps {
  channelId: string;
}

function pushResult(setResults: Dispatch<SetStateAction<TestResult[]>>, result: TestResult): void {
  setResults((prev) => [result, ...prev].slice(0, 5));
}

function readOptionalCheck(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

/**
 * Connectivity check tool — verifies channel reachability via probe.
 */
export function ChannelTestTool({ channelId }: ChannelTestToolProps) {
  const t = useTranslations("channels");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const handleSend = useCallback(async () => {
    setSending(true);
    const start = Date.now();
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        pushResult(setResults, {
          ok: true,
          check: readOptionalCheck((data as { check?: unknown }).check),
          latencyMs,
          timestamp: Date.now(),
        });
      } else {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        pushResult(setResults, {
          ok: false,
          error: readErrorMessage(data.error, `HTTP ${res.status}`),
          check: readOptionalCheck(data.check),
          latencyMs,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      pushResult(setResults, {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
        latencyMs: Date.now() - start,
        timestamp: Date.now(),
      });
    } finally {
      setSending(false);
    }
  }, [channelId]);

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        {t("test.description")}
      </p>
      <Button
        size="sm"
        onClick={() => void handleSend()}
        disabled={sending}
        aria-label={t("test.sendTest")}
      >
        {sending ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
        <span className="ml-1.5">{sending ? t("test.testing") : t("test.sendTest")}</span>
      </Button>

      {/* Results history */}
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r) => (
            <div
              key={r.timestamp}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
              style={{
                backgroundColor: r.ok
                  ? "color-mix(in srgb, var(--success) 8%, transparent)"
                  : "color-mix(in srgb, var(--destructive) 8%, transparent)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {r.ok ? (
                  <CheckCircle2 size={12} className="text-[var(--success)] shrink-0" />
                ) : (
                  <XCircle size={12} className="text-[var(--destructive)] shrink-0" />
                )}
                <span className="truncate" style={{ color: "var(--foreground)" }}>
                  {r.ok ? t("test.success") : r.error}
                </span>
              </div>
              <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 ml-2">
                {r.latencyMs}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
