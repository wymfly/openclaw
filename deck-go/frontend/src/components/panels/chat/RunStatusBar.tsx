import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDuration, formatTokenCount } from "@/lib/format-utils";
import type { RunMetadata } from "@/stores/chat-types";

export function RunStatusBar({
  metadata,
  sessionTotalTokens,
  sessionCostUsd,
  sessionStatus,
}: {
  metadata: RunMetadata;
  sessionTotalTokens?: number;
  sessionCostUsd?: number;
  sessionStatus?: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
}) {
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

  return (
    <div className="deck-ui-run-status">
      {sessionStatus && sessionStatus !== "idle" ? (
        <span className={`deck-ui-run-status-badge is-${sessionStatus}`}>
          {sessionStatus === "running" ? (
            <span className="deck-ui-run-status-dot animate-pulse" aria-hidden="true" />
          ) : null}
          {t(`status_${sessionStatus}`)}
        </span>
      ) : null}
      {metadata.model ? <span className="deck-ui-run-status-model">{metadata.model}</span> : null}
      <span>
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
        {metadata.streaming ? t("runStreaming") : t("runDuration")} {formatDuration(elapsed)}
      </span>
      {sessionTotalTokens != null && sessionTotalTokens > 0 ? (
        <span>
          {sessionTokensDisplayLabel} {formatTokenCount(sessionTotalTokens)}
          {sessionCostUsd != null && sessionCostUsd > 0 ? ` $${sessionCostUsd.toFixed(4)}` : ""}
        </span>
      ) : null}
    </div>
  );
}
