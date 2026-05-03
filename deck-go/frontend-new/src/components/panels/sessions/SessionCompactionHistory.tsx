import { useCallback, useEffect, useState } from "react";
import type { DeckGoCompactionCheckpoint } from "../../../api";
import {
  branchCompactionCheckpoint,
  fetchCompactionCheckpoints,
  restoreCompactionCheckpoint,
} from "../../../api";
import { Badge, Button } from "../../../design-system/atoms";
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
    <section className="sessions-surface sessions-compaction-panel">
      <div className="sessions-section-heading">
        <h3>{t("compactionCheckpoints")}</h3>
        <Badge variant={loading ? "neutral" : "ok"}>
          {loading ? t("loading") : t("loadedCount", { count: checkpoints.length })}
        </Badge>
      </div>
      {error ? <p className="sessions-error">{error}</p> : null}
      {actionResult ? (
        <p className="sessions-note">{t("lastCompactionAction", { action: actionResult })}</p>
      ) : null}
      {checkpoints.length === 0 ? (
        <p className="sessions-empty">{t("noCompactionCheckpoints")}</p>
      ) : (
        <ul className="sessions-list">
          {checkpoints.map((checkpoint) => {
            const saved = savedTokens(checkpoint);
            const isActing = actingCheckpointId === checkpoint.checkpointId;
            return (
              <li className="sessions-timeline-row" key={checkpoint.checkpointId}>
                <div className="sessions-row-top">
                  <strong>{checkpoint.reason}</strong>
                  <Badge>{checkpoint.checkpointId}</Badge>
                </div>
                <div className="sessions-meta">
                  {checkpoint.checkpointId} | {formatTimestamp(checkpoint.createdAt)}
                  {saved ? ` | ${t("savedTokensMeta", { tokens: formatTokens(saved) })}` : ""}
                </div>
                {checkpoint.summary ? <p className="sessions-note">{checkpoint.summary}</p> : null}
                <div className="sessions-actions">
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => void runCheckpointAction(checkpoint.checkpointId, "branch")}
                  >
                    {t("branchCheckpoint", { checkpointId: checkpoint.checkpointId })}
                  </Button>
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => void runCheckpointAction(checkpoint.checkpointId, "restore")}
                  >
                    {t("restoreCheckpoint", { checkpointId: checkpoint.checkpointId })}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
