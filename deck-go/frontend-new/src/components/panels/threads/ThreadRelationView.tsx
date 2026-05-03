import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

type ThreadRelationViewProps = {
  thread: DeckGoThreadEntry;
};

export function ThreadRelationView({ thread }: ThreadRelationViewProps) {
  const t = useTranslations("threads");

  return (
    <section className="threads-panel__relationship" aria-label={t("relationTitle")}>
      <div className="threads-panel__relation-node">
        <p className="threads-panel__eyebrow">{t("platformThread")}</p>
        <strong>{thread.label || thread.threadId}</strong>
        <p className="threads-panel__note">
          {thread.channelId} / {thread.threadId}
        </p>
      </div>
      <div className="threads-panel__relation-node">
        <p className="threads-panel__eyebrow">{t("sessionTarget")}</p>
        <strong>{thread.targetSessionKey}</strong>
        <p className="threads-panel__note">{t("kindMeta", { kind: thread.targetKind })}</p>
      </div>
      <div className="threads-panel__relation-node">
        <p className="threads-panel__eyebrow">{t("targetAgent")}</p>
        <strong>{thread.agentId}</strong>
        <p className="threads-panel__note">{t("accountMeta", { account: thread.accountId })}</p>
      </div>
      <p className="threads-panel__relation-summary">
        {t("relationSummary", {
          accountId: thread.accountId,
          agentId: thread.agentId,
          boundBy: thread.boundBy,
          channelId: thread.channelId,
          targetKind: thread.targetKind,
          targetSessionKey: thread.targetSessionKey,
          threadId: thread.threadId,
        })}
      </p>
    </section>
  );
}
