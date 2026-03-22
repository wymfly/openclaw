"use client";

import { Cpu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { RunEventRow } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelStat {
  model: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  hasFallback: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

function aggregateModelStats(events: RunEventRow[]): ModelStat[] {
  const modelEvents = events.filter((e) => e.stream === "model");
  if (modelEvents.length === 0) {
    return [];
  }

  const statsMap = new Map<string, ModelStat>();

  for (const row of modelEvents) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      // skip
    }

    const model =
      (parsed.model as string | undefined) ?? (parsed.modelId as string | undefined) ?? "unknown";

    const existing = statsMap.get(model) ?? {
      model,
      callCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      hasFallback: false,
    };

    existing.callCount += 1;

    // Token data may be nested in a `usage` object (normalized pipeline shape)
    const usage = parsed.usage as Record<string, number> | undefined;
    if (usage) {
      existing.inputTokens += usage.input_tokens ?? 0;
      existing.outputTokens += usage.output_tokens ?? 0;
      existing.cacheTokens += usage.cache_read_input_tokens ?? 0;
    }

    if (parsed.isFallback === true || parsed.fallback === true) {
      existing.hasFallback = true;
    }

    statsMap.set(model, existing);
  }

  return [...statsMap.values()].toSorted((a, b) => b.callCount - a.callCount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ModelStatsProps {
  events: RunEventRow[];
}

export function ModelStats({ events }: ModelStatsProps) {
  const t = useTranslations("monitor");

  const stats = useMemo(() => aggregateModelStats(events), [events]);

  if (stats.length === 0) {
    return (
      <p className="text-xs text-[var(--text-secondary)] italic py-2">
        {t("timeline.noModelData")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {stats.map((stat) => (
        <div
          key={stat.model}
          className="flex items-start gap-3 p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)]"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--accent-muted)] shrink-0 mt-0.5">
            <Cpu size={12} className="text-[var(--accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                {stat.model}
              </span>
              {stat.hasFallback && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--warning-muted)] text-[var(--warning-muted-text)] shrink-0">
                  {t("timeline.fallback")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--text-secondary)]">
              <span>
                {t("timeline.calls")}:{" "}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {stat.callCount}
                </strong>
              </span>
              <span>
                {t("timeline.tokensIn")}:{" "}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {formatTokens(stat.inputTokens)}
                </strong>
              </span>
              <span>
                {t("timeline.tokensOut")}:{" "}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {formatTokens(stat.outputTokens)}
                </strong>
              </span>
              {stat.cacheTokens > 0 && (
                <span>
                  {t("timeline.tokensCache")}:{" "}
                  <strong className="text-[var(--text-primary)] tabular-nums">
                    {formatTokens(stat.cacheTokens)}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
