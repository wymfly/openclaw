"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useChannelsStore, type ThroughputWindow } from "@/stores/channels";

const WINDOWS: ThroughputWindow[] = ["1h", "6h", "24h"];
const REFRESH_INTERVAL = 30_000;

function formatTime(ts: number, window: ThroughputWindow): string {
  const d = new Date(ts);
  if (window === "24h") {
    return `${d.getHours().toString().padStart(2, "0")}:00`;
  }
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) {
    return `${secs}s`;
  }
  return `${Math.floor(secs / 60)}m`;
}

export function ThroughputChart({ channelId }: { channelId: string }) {
  const t = useTranslations("channels");
  const { throughput, throughputWindow, fetchThroughput, setThroughputWindow } = useChannelsStore();

  const [hovering, setHovering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch on mount and when window changes
  useEffect(() => {
    fetchThroughput(channelId);
    setLastRefresh(Date.now());
  }, [channelId, throughputWindow, fetchThroughput]);

  // Auto-refresh every 30s, pause on hover
  useEffect(() => {
    if (hovering) {
      return;
    }

    const id = setInterval(() => {
      fetchThroughput(channelId);
      setLastRefresh(Date.now());
    }, REFRESH_INTERVAL);

    return () => clearInterval(id);
  }, [channelId, hovering, fetchThroughput]);

  // Update elapsed timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - lastRefresh);
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [lastRefresh]);

  const handleMouseEnter = useCallback(() => setHovering(true), []);
  const handleMouseLeave = useCallback(() => setHovering(false), []);

  const data = throughput.get(channelId);
  const buckets = data?.buckets ?? [];
  const maxVal = Math.max(1, ...buckets.map((b) => Math.max(b.in, b.out)));

  return (
    <div className="space-y-2" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Header: title + window selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            {t("throughput")}
          </label>
          <span className="text-[10px] text-[var(--text-tertiary)] italic">{t("estimated")}</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-md bg-[var(--bg-tertiary)] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setThroughputWindow(w)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer",
                throughputWindow === w
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Summary numbers */}
      {data && (
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-[var(--accent)]">
            <ArrowDownLeft size={10} />
            {data.messagesIn} {t("messagesIn")}
          </span>
          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
            <ArrowUpRight size={10} />
            {data.messagesOut} {t("messagesOut")}
          </span>
        </div>
      )}

      {/* Bar chart */}
      <div className="relative h-20 flex items-end gap-[2px] rounded-lg bg-[var(--bg-tertiary)] p-2 pt-1">
        {buckets.length === 0 || (data?.messagesIn === 0 && data?.messagesOut === 0) ? (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {t("noThroughput", { window: throughputWindow })}
            </span>
          </div>
        ) : (
          buckets.map((bucket, i) => {
            const inPct = (bucket.in / maxVal) * 100;
            const outPct = (bucket.out / maxVal) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex items-end gap-[1px] group relative"
                title={`${formatTime(bucket.time, throughputWindow)} — ↓${bucket.in} ↑${bucket.out}`}
              >
                <div
                  className="flex-1 rounded-t-sm bg-[var(--accent)] opacity-80 transition-all min-h-[1px]"
                  style={{ height: `${Math.max(inPct, 2)}%` }}
                />
                <div
                  className="flex-1 rounded-t-sm bg-[var(--text-secondary)] opacity-40 transition-all min-h-[1px]"
                  style={{ height: `${Math.max(outPct, 2)}%` }}
                />
              </div>
            );
          })
        )}
      </div>

      {/* X-axis labels */}
      {buckets.length > 0 && (
        <div className="flex justify-between px-2">
          <span className="text-[9px] text-[var(--text-tertiary)]">
            {formatTime(buckets[0].time, throughputWindow)}
          </span>
          <span className="text-[9px] text-[var(--text-tertiary)]">
            {formatTime(buckets[buckets.length - 1].time, throughputWindow)}
          </span>
        </div>
      )}

      {/* Last updated */}
      <div className="text-[10px] text-[var(--text-tertiary)] text-right">
        {t("lastUpdated", { time: formatElapsed(elapsed) })}
        {hovering && <span className="ml-1 text-[var(--warning)]">{t("refreshPaused")}</span>}
      </div>
    </div>
  );
}
