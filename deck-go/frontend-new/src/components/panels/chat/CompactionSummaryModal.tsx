import { useTranslations } from "next-intl";
import { useCompactionCheckpointsQuery } from "@/data/modules/sessions";
import { XIcon } from "@/deck-ui/icons";
import { Button } from "@/design-system/atoms/Button";
import { IconButton } from "@/design-system/atoms/IconButton";
import { Markdown } from "@/design-system/atoms/Markdown";
import { Modal } from "@/design-system/atoms/Modal";
import { formatTokenCount } from "@/lib/format-utils";
import "./chat-widgets.css";

export function CompactionSummaryModal({
  open,
  onClose,
  sessionKey,
}: {
  open: boolean;
  onClose: () => void;
  sessionKey: string;
}) {
  const t = useTranslations("chat");
  const checkpointsQuery = useCompactionCheckpointsQuery(sessionKey, { enabled: open });
  const checkpoints = checkpointsQuery.data?.checkpoints ?? null;
  const error = checkpointsQuery.error
    ? checkpointsQuery.error instanceof Error
      ? checkpointsQuery.error.message
      : String(checkpointsQuery.error)
    : null;
  const loading = checkpointsQuery.isFetching;

  return (
    <Modal open={open} onClose={onClose} size="lg" aria-labelledby="ds-compaction-summary-title">
      <div className="ds-compaction-summary">
        <header className="ds-compaction-summary__head">
          <h2 id="ds-compaction-summary-title" className="ds-compaction-summary__title">
            {t("compactionSummaryTitle")}
          </h2>
          <IconButton size="sm" aria-label={t("artifactClose")} onClick={onClose}>
            <XIcon />
          </IconButton>
        </header>
        <div className="ds-compaction-summary__body">
          {loading ? (
            <p className="ds-compaction-summary__status">{t("compactionSummaryLoading")}</p>
          ) : error ? (
            <p className="ds-compaction-summary__status ds-compaction-summary__status--error">
              {error}
            </p>
          ) : !checkpoints || checkpoints.length === 0 ? (
            <p className="ds-compaction-summary__status">{t("compactionSummaryEmpty")}</p>
          ) : (
            <ol className="ds-compaction-summary__list">
              {checkpoints.map((cp) => (
                <li key={cp.checkpointId} className="ds-compaction-summary__item">
                  <div className="ds-compaction-summary__meta">
                    <span className="ds-compaction-summary__time">
                      {new Date(cp.createdAt).toLocaleString()}
                    </span>
                    <span className="ds-compaction-summary__reason">{cp.reason}</span>
                    {typeof cp.tokensBefore === "number" && typeof cp.tokensAfter === "number" ? (
                      <span className="ds-compaction-summary__counts">
                        {formatTokenCount(cp.tokensBefore)} → {formatTokenCount(cp.tokensAfter)}
                      </span>
                    ) : null}
                  </div>
                  {cp.summary ? (
                    <Markdown content={cp.summary} className="ds-compaction-summary__text" />
                  ) : (
                    <p className="ds-compaction-summary__status">{t("compactionSummaryNoText")}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        <footer className="ds-compaction-summary__foot">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("artifactClose")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
