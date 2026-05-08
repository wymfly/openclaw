import { useEffect, useState } from "react";
import type { DeckGoCompactionCheckpoint } from "@/api-types";
import {
  useBranchCompactionCheckpointMutation,
  useCompactionCheckpointsQuery,
  useRestoreCompactionCheckpointMutation,
} from "../../../data/modules/sessions";
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
  const checkpointsQuery = useCompactionCheckpointsQuery(props.sessionKey, {
    enabled: Boolean(props.sessionKey.trim() && props.compactionCount),
  });
  const branchMutation = useBranchCompactionCheckpointMutation();
  const restoreMutation = useRestoreCompactionCheckpointMutation();
  const [actingCheckpointId, setActingCheckpointId] = useState("");
  const [restoreConfirmingCheckpointId, setRestoreConfirmingCheckpointId] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [actionError, setActionError] = useState("");
  const checkpoints = checkpointsQuery.data?.checkpoints ?? [];
  const loading = checkpointsQuery.isLoading;
  const queryError = checkpointsQuery.error;
  const error =
    actionError ||
    (queryError instanceof Error
      ? queryError.message
      : queryError
        ? t("failedLoadCompaction")
        : "");

  useEffect(() => {
    setActionResult("");
    setActionError("");
    setRestoreConfirmingCheckpointId("");
  }, [props.sessionKey]);

  const runCheckpointAction = async (checkpointId: string, action: "branch" | "restore") => {
    const sessionKey = props.sessionKey.trim();
    if (!sessionKey) {
      return;
    }
    setActingCheckpointId(checkpointId);
    if (action === "branch") {
      setRestoreConfirmingCheckpointId("");
    }
    try {
      const result =
        action === "branch"
          ? await branchMutation.mutateAsync({ checkpointId, sessionKey })
          : await restoreMutation.mutateAsync({ checkpointId, sessionKey });
      setActionResult(
        action === "branch" ? `branch ${result.key ?? checkpointId}` : `restore ${checkpointId}`,
      );
      setRestoreConfirmingCheckpointId("");
      setActionError("");
      if (action === "restore") {
        await checkpointsQuery.refetch();
      }
    } catch (actionError) {
      setActionError(
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
                    onClick={() => {
                      if (restoreConfirmingCheckpointId !== checkpoint.checkpointId) {
                        setRestoreConfirmingCheckpointId(checkpoint.checkpointId);
                        return;
                      }
                      void runCheckpointAction(checkpoint.checkpointId, "restore");
                    }}
                  >
                    {restoreConfirmingCheckpointId === checkpoint.checkpointId
                      ? t("confirmRestore")
                      : t("restoreCheckpoint", { checkpointId: checkpoint.checkpointId })}
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
