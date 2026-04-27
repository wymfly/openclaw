import { useCallback, useEffect, useState } from "react";
import type { DeckGoCompactionCheckpoint } from "../../../api";
import {
  branchCompactionCheckpoint,
  fetchCompactionCheckpoints,
  restoreCompactionCheckpoint,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";

type SessionCompactionHistoryProps = {
  compactionCount?: number;
  sessionKey: string;
};

function formatTokens(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

function formatTimestamp(value: number) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function savedTokens(checkpoint: DeckGoCompactionCheckpoint) {
  if (typeof checkpoint.tokensBefore !== "number" || typeof checkpoint.tokensAfter !== "number") {
    return null;
  }
  return Math.max(0, checkpoint.tokensBefore - checkpoint.tokensAfter);
}

export function SessionCompactionHistory(props: SessionCompactionHistoryProps) {
  const t = useTranslations("sessions");
  const [checkpoints, setCheckpoints] = useState<DeckGoCompactionCheckpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingCheckpointId, setActingCheckpointId] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const sessionKey = props.sessionKey.trim();
    if (!sessionKey || !props.compactionCount) {
      setCheckpoints([]);
      setError("");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchCompactionCheckpoints(sessionKey);
      setCheckpoints(result.checkpoints ?? []);
      setError("");
    } catch (loadError) {
      setCheckpoints([]);
      setError(loadError instanceof Error ? loadError.message : t("failedLoadCompaction"));
    } finally {
      setLoading(false);
    }
  }, [props.compactionCount, props.sessionKey, t]);

  useEffect(() => {
    setActionResult("");
    void refresh();
  }, [refresh]);

  const runCheckpointAction = async (checkpointId: string, action: "branch" | "restore") => {
    const sessionKey = props.sessionKey.trim();
    if (!sessionKey) {
      return;
    }
    setActingCheckpointId(checkpointId);
    try {
      const result =
        action === "branch"
          ? await branchCompactionCheckpoint(sessionKey, checkpointId)
          : await restoreCompactionCheckpoint(sessionKey, checkpointId);
      setActionResult(
        action === "branch" ? `branch ${result.key ?? checkpointId}` : `restore ${checkpointId}`,
      );
      setError("");
      if (action === "restore") {
        await refresh();
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : t("compactionActionFailed", { action }),
      );
    } finally {
      setActingCheckpointId("");
    }
  };

  if (!props.compactionCount) {
    return null;
  }

  return (
    <div className="deckgo-surface-tile deck-ui-sessions-surface deck-ui-sessions-compaction">
      <div className="deckgo-pill-row deck-ui-sessions-status-row">
        <p className="deckgo-surface-label">{t("compactionCheckpoints")}</p>
        <span className={`deckgo-pill ${loading ? "is-muted" : "is-positive"}`}>
          {loading ? t("loading") : t("loadedCount", { count: checkpoints.length })}
        </span>
      </div>
      {error ? <p className="deckgo-note deck-ui-sessions-error">{error}</p> : null}
      {actionResult ? (
        <p className="deckgo-note deck-ui-sessions-meta">
          {t("lastCompactionAction", { action: actionResult })}
        </p>
      ) : null}
      {checkpoints.length === 0 ? (
        <p className="deckgo-note deck-ui-sessions-empty">{t("noCompactionCheckpoints")}</p>
      ) : (
        <ul className="deckgo-shell-list deck-ui-sessions-list">
          {checkpoints.map((checkpoint) => {
            const saved = savedTokens(checkpoint);
            const isActing = actingCheckpointId === checkpoint.checkpointId;
            return (
              <li key={checkpoint.checkpointId}>
                <strong>{checkpoint.reason}</strong>
                <div className="deckgo-meta deck-ui-sessions-meta">
                  {checkpoint.checkpointId} | {formatTimestamp(checkpoint.createdAt)}
                  {saved ? ` | ${t("savedTokensMeta", { tokens: formatTokens(saved) })}` : ""}
                </div>
                {checkpoint.summary ? <p className="deckgo-note">{checkpoint.summary}</p> : null}
                <div className="deckgo-actions deck-ui-sessions-actions">
                  <button
                    className="deckgo-button deck-ui-sessions-button"
                    type="button"
                    disabled={isActing}
                    onClick={() => void runCheckpointAction(checkpoint.checkpointId, "branch")}
                  >
                    {t("branchCheckpoint", { checkpointId: checkpoint.checkpointId })}
                  </button>
                  <button
                    className="deckgo-button deck-ui-sessions-button"
                    type="button"
                    disabled={isActing}
                    onClick={() => void runCheckpointAction(checkpoint.checkpointId, "restore")}
                  >
                    {t("restoreCheckpoint", { checkpointId: checkpoint.checkpointId })}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
