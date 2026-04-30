import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ClockIcon, CpuIcon, ZapIcon } from "@/deck-ui/icons";
import { Badge } from "@/design-system/atoms/Badge";
import { Chip } from "@/design-system/atoms/Chip";
import { formatDuration, formatTokenCount } from "@/lib/format-utils";
import type { RunMetadata } from "@/stores/chat-types";

const SESSION_BADGE_VARIANT: Record<
  Exclude<RunStatusBarProps["sessionStatus"], "idle" | undefined>,
  "running" | "ok" | "err" | "warn"
> = {
  running: "running",
  done: "ok",
  failed: "err",
  killed: "err",
  timeout: "warn",
};

interface RunStatusBarProps {
  metadata: RunMetadata;
  sessionTotalTokens?: number;
  sessionCostUsd?: number;
  sessionStatus?: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
}

export function RunStatusBar({
  metadata,
  sessionTotalTokens,
  sessionCostUsd,
  sessionStatus,
}: RunStatusBarProps) {
  const t = useTranslations("chat");
  const [elapsed, setElapsed] = useState(metadata.durationMs);
  const sessionTokensLabel = t("sessionTokens");
  const sessionTokensDisplayLabel = /(^|[.:])sessionTokens$/i.test(sessionTokensLabel)
    ? "Session"
    : sessionTokensLabel;

  useEffect(() => {
    if (!metadata.streaming || !metadata.startedAt) {
      setElapsed(metadata.durationMs);
      return undefined;
    }

    setElapsed(Date.now() - metadata.startedAt);
    const interval = window.setInterval(() => {
      setElapsed(Date.now() - metadata.startedAt!);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [metadata.durationMs, metadata.startedAt, metadata.streaming]);

  const showSessionBadge = sessionStatus && sessionStatus !== "idle";
  const cacheHitPercent =
    typeof metadata.cacheHit === "number" ? Math.round(metadata.cacheHit * 100) : undefined;

  return (
    <div className="ds-run-status-bar deck-ui-run-status">
      {showSessionBadge ? (
        <Badge
          variant={SESSION_BADGE_VARIANT[sessionStatus]}
          className={`deck-ui-run-status-badge is-${sessionStatus}`}
        >
          {sessionStatus === "running" ? (
            <span className="deck-ui-run-status-dot animate-pulse" aria-hidden="true" />
          ) : null}
          {t(`status_${sessionStatus}`)}
        </Badge>
      ) : null}
      {metadata.model ? (
        <span className="ds-run-status-bar__model deck-ui-run-status-model">
          <CpuIcon />
          {metadata.model}
        </span>
      ) : null}
      <span>
        <ZapIcon />
        {t("runTokensIn")} {formatTokenCount(metadata.usage?.input)} / {t("runTokensOut")}{" "}
        {formatTokenCount(metadata.usage?.output)}
        {metadata.usage?.cache !== undefined ? (
          <>
            {" "}
            / {t("runTokensCache")} {formatTokenCount(metadata.usage.cache)}
          </>
        ) : null}
      </span>
      <span>
        <ClockIcon />
        {metadata.streaming ? t("runStreaming") : t("runDuration")} {formatDuration(elapsed)}
      </span>
      {/* P2a chat capability extension §7 — cacheHit / cost chips with hide-on-undefined.
          Visual: bundle metadata bar uses small accent chips for these. */}
      {cacheHitPercent !== undefined ? (
        <Chip data-run-stat="cache-hit">cache {cacheHitPercent}%</Chip>
      ) : null}
      {typeof metadata.cost === "number" ? (
        <Chip active data-run-stat="cost">
          ${metadata.cost.toFixed(4)}
        </Chip>
      ) : null}
      {sessionTotalTokens != null && sessionTotalTokens > 0 ? (
        <span>
          {sessionTokensDisplayLabel} {formatTokenCount(sessionTotalTokens)}
          {sessionCostUsd != null && sessionCostUsd > 0 ? ` $${sessionCostUsd.toFixed(4)}` : ""}
        </span>
      ) : null}
    </div>
  );
}
