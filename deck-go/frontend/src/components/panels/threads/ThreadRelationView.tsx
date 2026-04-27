import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

type ThreadRelationViewProps = {
  thread: DeckGoThreadEntry;
};

export function ThreadRelationView({ thread }: ThreadRelationViewProps) {
  const t = useTranslations("threads");

  return (
    <div className="deckgo-surface-tile deck-ui-threads-relation">
      <p className="deckgo-surface-label">{t("relationTitle")}</p>
      <div className="deckgo-grid deckgo-grid-3 deck-ui-threads-relation-grid">
        <div className="deck-ui-threads-relation-node">
          <p className="deckgo-kicker">{t("thread")}</p>
          <strong>{thread.label || thread.threadId}</strong>
          <p className="deckgo-note">{t("channelMeta", { channel: thread.channelId })}</p>
        </div>
        <div className="deck-ui-threads-relation-node">
          <p className="deckgo-kicker">{t("targetSession")}</p>
          <strong>{thread.targetSessionKey}</strong>
          <p className="deckgo-note">{t("kindMeta", { kind: thread.targetKind })}</p>
        </div>
        <div className="deck-ui-threads-relation-node">
          <p className="deckgo-kicker">{t("targetAgent")}</p>
          <strong>{thread.agentId}</strong>
          <p className="deckgo-note">{t("accountMeta", { account: thread.accountId })}</p>
        </div>
      </div>
      <p className="deckgo-note deck-ui-threads-relation-summary">
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
    </div>
  );
}
