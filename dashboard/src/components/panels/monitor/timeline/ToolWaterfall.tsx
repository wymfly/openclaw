"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { RunEventRow } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ToolEvent {
  id: number;
  toolName: string;
  durationMs: number;
  phase: string;
  args: unknown;
  result: unknown;
  indent: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function parseToolEvents(events: RunEventRow[]): ToolEvent[] {
  const toolEvents = events.filter((e) => e.stream === "tool_call" || e.stream === "file_op");
  return toolEvents.map((row) => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      // skip
    }
    return {
      id: row.id,
      toolName:
        (parsed.toolName as string | undefined) ??
        (parsed.name as string | undefined) ??
        row.stream,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
      phase: (parsed.phase as string | undefined) ?? "",
      args: parsed.args ?? parsed.input ?? null,
      result: parsed.result ?? parsed.output ?? null,
      indent: typeof parsed.depth === "number" ? parsed.depth : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ToolWaterfallProps {
  events: RunEventRow[];
}

export function ToolWaterfall({ events }: ToolWaterfallProps) {
  const t = useTranslations("monitor");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toolEvents = useMemo(() => parseToolEvents(events), [events]);

  if (toolEvents.length === 0) {
    return (
      <p className="text-xs text-[var(--muted-foreground)] italic py-2">
        {t("timeline.noToolCalls")}
      </p>
    );
  }

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      {toolEvents.map((evt) => {
        const isExpanded = expanded.has(evt.id);

        return (
          <div key={evt.id} style={{ paddingLeft: `${evt.indent * 16}px` }}>
            {/* Row */}
            <button
              type="button"
              onClick={() => toggle(evt.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                "hover:bg-[var(--neutral-muted)] transition-colors",
                isExpanded && "bg-[var(--neutral-muted)]",
              )}
            >
              <ChevronRight
                size={12}
                className={cn(
                  "shrink-0 text-[var(--muted-foreground)] transition-transform",
                  isExpanded && "rotate-90",
                )}
              />
              <span className="text-xs font-medium text-[var(--purple)] truncate">
                {evt.toolName}
              </span>
              {evt.phase && (
                <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                  [{evt.phase}]
                </span>
              )}
              <span className="ml-auto text-[10px] text-[var(--muted-foreground)] tabular-nums shrink-0">
                {evt.durationMs > 0 ? formatDuration(evt.durationMs) : "\u2014"}
              </span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="ml-5 pl-3 border-l-2 border-[var(--purple-muted)] my-1 space-y-2">
                {evt.args != null && (
                  <div>
                    <p className="text-[10px] font-medium text-[var(--muted-foreground)] mb-0.5">
                      {t("timeline.toolArgs")}
                    </p>
                    <pre className="text-[11px] text-[var(--foreground)] bg-[var(--background)] rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                      {typeof evt.args === "string" ? evt.args : JSON.stringify(evt.args, null, 2)}
                    </pre>
                  </div>
                )}
                {evt.result != null && (
                  <div>
                    <p className="text-[10px] font-medium text-[var(--muted-foreground)] mb-0.5">
                      {t("timeline.toolResult")}
                    </p>
                    <pre className="text-[11px] text-[var(--foreground)] bg-[var(--background)] rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                      {typeof evt.result === "string"
                        ? evt.result
                        : JSON.stringify(evt.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
