import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { formatRelativeThreadTime } from "./thread-utils";

type ThreadListProps = {
  threads: DeckGoThreadEntry[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
};

export function ThreadList({ threads, selectedThreadId, onSelectThread }: ThreadListProps) {
  const t = useTranslations("threads");

  if (threads.length === 0) {
    return <p className="deckgo-note deck-ui-threads-empty">{t("noThreadsLoaded")}</p>;
  }

  return (
    <div className="deck-ui-threads-list-wrap">
      <div className="deck-ui-threads-list-header" aria-hidden="true">
        <span>{t("channel")}</span>
        <span>{t("agent")}</span>
        <span>{t("threadId")}</span>
        <span>{t("kind")}</span>
        <span>{t("boundAt")}</span>
        <span>{t("lastActivity")}</span>
      </div>
      <ul className="deckgo-shell-list deck-ui-threads-list">
        {threads.map((thread) => (
          <li key={thread.threadId}>
            <button
              type="button"
              className={`deckgo-selectable-card deck-ui-threads-row ${selectedThreadId === thread.threadId ? "is-selected" : ""}`}
              onClick={() => onSelectThread(thread.threadId)}
            >
              <span className="deck-ui-threads-row-cell" title={thread.channelId}>
                {thread.channelId}
              </span>
              <span className="deck-ui-threads-row-cell" title={thread.agentId}>
                {thread.agentId}
              </span>
              <strong className="deck-ui-threads-row-cell" title={thread.threadId}>
                {thread.label || thread.threadId}
              </strong>
              <span className="deckgo-pill deck-ui-threads-kind">{thread.targetKind}</span>
              <span className="deck-ui-threads-row-cell">
                {formatRelativeThreadTime(thread.boundAt, t)}
              </span>
              <span className="deck-ui-threads-row-cell">
                {formatRelativeThreadTime(thread.lastActivityAt, t)}
              </span>
              <span className="deckgo-meta deck-ui-threads-meta deck-ui-threads-row-summary">
                {t("threadListAgentChannel", {
                  agent: thread.agentId,
                  channel: thread.channelId,
                })}
              </span>
              <span className="deckgo-meta deck-ui-threads-meta deck-ui-threads-row-summary">
                {t("threadListSessionKind", {
                  kind: thread.targetKind,
                  session: thread.targetSessionKey,
                })}
              </span>
              <span className="deckgo-meta deck-ui-threads-meta deck-ui-threads-row-summary">
                {t("threadListActivityBound", {
                  bound: formatRelativeThreadTime(thread.boundAt, t),
                  lastActivity: formatRelativeThreadTime(thread.lastActivityAt, t),
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
