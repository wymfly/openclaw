"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { RunEventRow } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StreamKind = "tool_call" | "model" | "file_op" | "subagent" | "compaction" | "system";

interface TimelineEvent {
  id: number;
  kind: StreamKind;
  label: string;
  startMs: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyKind(kind: string): StreamKind {
  if (kind === "tool_call" || kind === "tool") {
    return "tool_call";
  }
  if (kind === "model" || kind === "llm") {
    return "model";
  }
  if (kind === "file_op" || kind === "file") {
    return "file_op";
  }
  if (kind === "subagent") {
    return "subagent";
  }
  if (kind === "compaction") {
    return "compaction";
  }
  return "system";
}

/** Color config per stream kind — uses CSS variables only. */
const STREAM_COLORS: Record<StreamKind, { bar: string; bg: string }> = {
  tool_call: { bar: "var(--purple)", bg: "var(--purple-muted)" },
  model: { bar: "var(--primary)", bg: "var(--primary-muted)" },
  file_op: { bar: "var(--success)", bg: "var(--success-muted)" },
  subagent: { bar: "var(--warning)", bg: "var(--warning-muted)" },
  compaction: { bar: "var(--warning)", bg: "var(--warning-muted)" },
  system: { bar: "var(--neutral-muted-text)", bg: "var(--neutral-muted)" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function parseEvents(rows: RunEventRow[]): TimelineEvent[] {
  if (rows.length === 0) {
    return [];
  }

  const events: TimelineEvent[] = [];
  for (const row of rows) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      // skip unparsable
    }

    const label =
      (parsed.toolName as string | undefined) ??
      (parsed.name as string | undefined) ??
      (parsed.model as string | undefined) ??
      row.stream;

    const duration = typeof parsed.durationMs === "number" ? parsed.durationMs : 0;
    const startMs = new Date(row.created_at + "Z").getTime();

    events.push({
      id: row.id,
      kind: classifyKind(row.stream),
      label,
      startMs,
      durationMs: duration,
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Time axis
// ---------------------------------------------------------------------------

function TimeAxis({ totalMs }: { totalMs: number }) {
  const ticks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => ({
      pct: (i / count) * 100,
      label: formatDuration(Math.round((i / count) * totalMs)),
    }));
  }, [totalMs]);

  return (
    <div className="relative h-5 mb-1 border-b border-[var(--border)]">
      {ticks.map((tick) => (
        <span
          key={tick.pct}
          className="absolute text-[10px] text-[var(--muted-foreground)] -translate-x-1/2 top-0"
          style={{ left: `${tick.pct}%` }}
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RunTimelineProps {
  events: RunEventRow[];
}

export function RunTimeline({ events }: RunTimelineProps) {
  const t = useTranslations("monitor");

  const timelineEvents = useMemo(() => parseEvents(events), [events]);

  if (timelineEvents.length === 0) {
    return (
      <p className="text-xs text-[var(--muted-foreground)] italic py-2">
        {t("timeline.noTimedEvents")}
      </p>
    );
  }

  const minTs = Math.min(...timelineEvents.map((e) => e.startMs));
  const maxTs = Math.max(...timelineEvents.map((e) => e.startMs + e.durationMs));
  const totalMs = Math.max(maxTs - minTs, 1);

  return (
    <div>
      <TimeAxis totalMs={totalMs} />
      <div className="space-y-0.5">
        {timelineEvents.map((evt) => {
          const startPct = ((evt.startMs - minTs) / totalMs) * 100;
          const durationPct = Math.max((evt.durationMs / totalMs) * 100, 0.5);
          const colors = STREAM_COLORS[evt.kind];
          const isCompaction = evt.kind === "compaction";

          if (isCompaction) {
            // Compaction events render as vertical marker lines
            return (
              <div key={evt.id} className="relative h-6">
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed"
                  style={{
                    left: `${startPct}%`,
                    borderColor: colors.bar,
                  }}
                />
                <span
                  className="absolute text-[10px] font-medium top-0.5"
                  style={{
                    left: `${startPct + 0.5}%`,
                    color: colors.bar,
                  }}
                >
                  {evt.label}
                </span>
              </div>
            );
          }

          return (
            <div key={evt.id} className="relative h-6 group">
              {/* Bar */}
              <div
                className="absolute top-0.5 bottom-0.5 rounded-sm transition-opacity group-hover:opacity-90"
                style={{
                  left: `${startPct}%`,
                  width: `${durationPct}%`,
                  backgroundColor: colors.bg,
                  borderLeft: `3px solid ${colors.bar}`,
                }}
              />
              {/* Label */}
              <span
                className="absolute top-1 text-[10px] font-medium truncate pointer-events-none"
                style={{
                  left: `${startPct + 0.3}%`,
                  maxWidth: `${Math.max(durationPct - 0.5, 8)}%`,
                  color: colors.bar,
                  paddingLeft: "4px",
                }}
              >
                {evt.label}
                {evt.durationMs > 0 && (
                  <span className="ml-1 opacity-70">({formatDuration(evt.durationMs)})</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
