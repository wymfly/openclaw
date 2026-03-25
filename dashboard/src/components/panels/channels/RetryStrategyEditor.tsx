"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

interface RetryStrategyEditorProps {
  attempts: number;
  minDelayMs: number;
  maxDelayMs: number;
  jitter: number;
  onChange: (field: string, value: number) => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function RetryStrategyEditor({
  attempts,
  minDelayMs,
  maxDelayMs,
  jitter,
  onChange,
}: RetryStrategyEditorProps) {
  const t = useTranslations("channels.settings");

  // Compute retry delays for the visualization
  const retryData = useMemo(() => {
    const delays: number[] = [];
    let totalTime = 0;
    // attempts includes the first try, so retries = attempts - 1
    const retryCount = Math.max(0, attempts - 1);
    for (let n = 0; n < retryCount; n++) {
      const raw = Math.min(minDelayMs * Math.pow(2, n), maxDelayMs);
      delays.push(raw);
      totalTime += raw;
    }
    return { delays, totalTime, retryCount };
  }, [attempts, minDelayMs, maxDelayMs]);

  const ariaLabel = t("retry.totalTime", { time: formatDuration(retryData.totalTime) });

  return (
    <div>
      <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {t("retry.title")}
      </h4>

      {/* Input fields - 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Attempts */}
        <div>
          <label className="block text-[11px] mb-1" style={{ color: "var(--muted-foreground)" }}>
            {t("retry.attempts")}
          </label>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={attempts}
            onChange={(e) =>
              onChange("attempts", Math.max(1, Math.min(10, Number(e.target.value))))
            }
            className="w-full px-2 py-1 text-xs rounded border outline-none transition-colors"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Min Delay */}
        <div>
          <label className="block text-[11px] mb-1" style={{ color: "var(--muted-foreground)" }}>
            {t("retry.minDelay")}
          </label>
          <input
            type="number"
            min={100}
            max={60000}
            step={100}
            value={minDelayMs}
            onChange={(e) =>
              onChange("minDelayMs", Math.max(100, Math.min(60000, Number(e.target.value))))
            }
            className="w-full px-2 py-1 text-xs rounded border outline-none transition-colors"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Max Delay */}
        <div>
          <label className="block text-[11px] mb-1" style={{ color: "var(--muted-foreground)" }}>
            {t("retry.maxDelay")}
          </label>
          <input
            type="number"
            min={1000}
            max={300000}
            step={1000}
            value={maxDelayMs}
            onChange={(e) =>
              onChange("maxDelayMs", Math.max(1000, Math.min(300000, Number(e.target.value))))
            }
            className="w-full px-2 py-1 text-xs rounded border outline-none transition-colors"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Jitter */}
        <div>
          <label className="block text-[11px] mb-1" style={{ color: "var(--muted-foreground)" }}>
            {t("retry.jitter")}
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={jitter}
            onChange={(e) => onChange("jitter", Math.max(0, Math.min(1, Number(e.target.value))))}
            className="w-full px-2 py-1 text-xs rounded border outline-none transition-colors"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>

      {/* Retry Timeline Visualization */}
      {retryData.retryCount > 0 && (
        <div
          className="rounded-lg border px-3 py-2.5"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
          }}
          aria-label={ariaLabel}
        >
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {/* Initial attempt circle */}
            <div
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              1
            </div>

            {/* Retry attempts with delay arrows */}
            {retryData.delays.map((delay, idx) => (
              <div key={idx} className="flex items-center gap-1 shrink-0">
                {/* Delay arrow */}
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-[9px] whitespace-nowrap"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDuration(delay)}
                  </span>
                  <div className="w-8 h-px" style={{ backgroundColor: "var(--border)" }} />
                </div>

                {/* Retry circle */}
                <div
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {idx + 2}
                </div>
              </div>
            ))}

            {/* Total time */}
            <span
              className="ml-2 text-xs font-medium whitespace-nowrap"
              style={{ color: "var(--foreground)" }}
            >
              {t("retry.totalTime", { time: formatDuration(retryData.totalTime) })}
            </span>

            {/* Jitter note */}
            {jitter > 0 && (
              <span
                className="text-[9px] whitespace-nowrap"
                style={{ color: "var(--muted-foreground)" }}
              >
                ({"\u00B1"}
                {t("retry.jitter").toLowerCase()})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
