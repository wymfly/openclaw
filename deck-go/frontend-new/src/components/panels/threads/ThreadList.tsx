import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { channelKindFromId, formatRelativeThreadTime, isThreadStale } from "./thread-utils";

type ThreadListProps = {
  threads: DeckGoThreadEntry[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
};

export function ThreadList({ threads, selectedThreadId, onSelectThread }: ThreadListProps) {
  const t = useTranslations("threads");

  if (threads.length === 0) {
    return (
      <div className="threads-panel__empty">
        <strong>{t("noThreads")}</strong>
        <p>{t("noThreadsLoaded")}</p>
      </div>
    );
  }

  return (
    <ul className="threads-panel__thread-list">
      <li className="threads-panel__thread-list-header" aria-hidden="true">
        <span>{t("channel")}</span>
        <span>{t("agentSession")}</span>
        <span>{t("targetKind")}</span>
        <span>{t("accountBoundBy")}</span>
        <span>{t("lastActivity")}</span>
        <span>{t("boundAt")}</span>
      </li>
      {threads.map((thread) => (
        <li key={thread.threadId}>
          <button
            type="button"
            className={`threads-panel__thread-row ${
              selectedThreadId === thread.threadId ? "is-selected" : ""
            } ${isThreadStale(thread) ? "is-stale" : ""}`}
            onClick={() => onSelectThread(thread.threadId)}
          >
            <span className="threads-panel__thread-channel">
              <span className="threads-panel__channel-badge">
                {channelKindFromId(thread.channelId)}
              </span>
              <span className="threads-panel__thread-id" title={thread.channelId}>
                {thread.channelId}
              </span>
            </span>
            <span className="threads-panel__thread-main">
              <strong title={thread.label || thread.threadId}>
                {thread.label || thread.threadId}
              </strong>
              <span className="threads-panel__thread-id">{thread.agentId}</span>
              <span className="threads-panel__thread-id" title={thread.targetSessionKey}>
                {thread.targetSessionKey}
              </span>
            </span>
            <span className="threads-panel__pill" title={thread.targetKind}>
              {thread.targetKind}
            </span>
            <span className="threads-panel__thread-main">
              <span title={thread.accountId}>{thread.accountId}</span>
              <span className="threads-panel__thread-id" title={thread.boundBy}>
                {thread.boundBy}
              </span>
            </span>
            <span className="threads-panel__last-activity">
              {formatRelativeThreadTime(thread.lastActivityAt, t)}
            </span>
            <span className="threads-panel__last-activity">
              {formatRelativeThreadTime(thread.boundAt, t)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
