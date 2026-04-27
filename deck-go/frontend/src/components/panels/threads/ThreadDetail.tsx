import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { formatThreadTimestamp } from "./thread-utils";
import { ThreadRelationView } from "./ThreadRelationView";

type ThreadDetailProps = {
  handoffMessage: string;
  onCopySessionKey: () => void;
  onOpenAgent: () => void;
  onOpenSession: () => void;
  thread: DeckGoThreadEntry | null;
};

export function ThreadDetail({
  handoffMessage,
  onCopySessionKey,
  onOpenAgent,
  onOpenSession,
  thread,
}: ThreadDetailProps) {
  const t = useTranslations("threads");

  if (!thread) {
    return <p className="deckgo-note deck-ui-threads-empty">{t("chooseThread")}</p>;
  }

  return (
    <>
      <div className="deckgo-panel-hero-strip deck-ui-threads-hero">
        <div>
          <p className="deckgo-kicker">{t("thread")}</p>
          <strong>{thread.label || thread.threadId}</strong>
          <p className="deckgo-note">{thread.threadId}</p>
        </div>
        <div className="deckgo-pill-row deck-ui-threads-status-row">
          <span className="deckgo-pill">{thread.channelId}</span>
          <span className="deckgo-pill">{thread.agentId}</span>
        </div>
      </div>
      <div className="deckgo-actions deck-ui-threads-actions">
        <button
          className="deckgo-button deck-ui-threads-button"
          type="button"
          onClick={onCopySessionKey}
        >
          {t("copySessionKey")}
        </button>
        <button
          className="deckgo-button deck-ui-threads-button"
          type="button"
          onClick={onOpenSession}
        >
          {t("openSession")}
        </button>
        <button
          className="deckgo-button deck-ui-threads-button"
          type="button"
          onClick={onOpenAgent}
        >
          {t("openAgent")}
        </button>
      </div>
      {handoffMessage ? (
        <p className="deckgo-note deck-ui-threads-handoff">{handoffMessage}</p>
      ) : null}
      <div className="deckgo-grid deckgo-grid-2 deck-ui-threads-stats">
        <ShellStat label={t("boundAtLower")} value={formatThreadTimestamp(thread.boundAt)} />
        <ShellStat
          label={t("lastActivityLower")}
          value={formatThreadTimestamp(thread.lastActivityAt)}
        />
        <ShellStat label={t("accountLower")} value={thread.accountId} />
        <ShellStat label={t("boundByLower")} value={thread.boundBy} />
      </div>
      <ThreadRelationView thread={thread} />
      <JsonDetails title={t("threadPayload")} payload={thread} />
    </>
  );
}
