"use client";

import { Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TestResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  latencyMs: number;
  timestamp: number;
}

interface ChannelTestToolProps {
  channelId: string;
}

/**
 * Send test message tool — verifies end-to-end channel connectivity.
 */
export function ChannelTestTool({ channelId }: ChannelTestToolProps) {
  const t = useTranslations("channels");
  const [message, setMessage] = useState("Test message from OpenClaw Deck");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const handleSend = useCallback(async () => {
    setSending(true);
    const start = Date.now();
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        setResults((prev) =>
          [
            {
              ok: true,
              messageId: data.messageId,
              latencyMs,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 5),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setResults((prev) =>
          [
            {
              ok: false,
              error: (data as Record<string, unknown>).error
                ? String((data as Record<string, unknown>).error)
                : `HTTP ${res.status}`,
              latencyMs,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 5),
        );
      }
    } catch (err) {
      setResults((prev) =>
        [
          {
            ok: false,
            error: err instanceof Error ? err.message : "Network error",
            latencyMs: Date.now() - start,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 5),
      );
    } finally {
      setSending(false);
    }
  }, [channelId, message]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleSend();
            }
          }}
          placeholder={t("test.placeholder")}
          className="text-xs flex-1"
        />
        <Button size="sm" onClick={() => void handleSend()} disabled={sending || !message.trim()}>
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </Button>
      </div>

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
                  {r.ok ? `${t("test.success")}${r.messageId ? ` (${r.messageId})` : ""}` : r.error}
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
