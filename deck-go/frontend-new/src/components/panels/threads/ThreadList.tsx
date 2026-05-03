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
    return (
      <div className="threads-panel__empty">
        <strong>{t("noThreads")}</strong>
        <p>{t("noThreadsLoaded")}</p>
      </div>
    );
  }

  return (
    <ul className="threads-panel__thread-list">
      {threads.map((thread) => (
        <li key={thread.threadId}>
          <button
            type="button"
            className={`threads-panel__thread-row ${
              selectedThreadId === thread.threadId ? "is-selected" : ""
            }`}
            onClick={() => onSelectThread(thread.threadId)}
          >
            <span className="threads-panel__thread-main">
              <strong>{thread.label || thread.threadId}</strong>
              <span className="threads-panel__thread-id">{thread.threadId}</span>
              <span className="threads-panel__row-meta">
                <span>
                  {t("threadListAgentChannel", {
                    agent: thread.agentId,
                    channel: thread.channelId,
                  })}
                </span>
                <span>
                  {t("threadListSessionKind", {
                    kind: thread.targetKind,
                    session: thread.targetSessionKey,
                  })}
                </span>
                <span>
                  {t("threadListActivityBound", {
                    bound: formatRelativeThreadTime(thread.boundAt, t),
                    lastActivity: formatRelativeThreadTime(thread.lastActivityAt, t),
                  })}
                </span>
              </span>
            </span>
            <span className="threads-panel__thread-side">
              <span className="threads-panel__pill">{thread.targetKind}</span>
              <span className="threads-panel__last-activity">
                {formatRelativeThreadTime(thread.lastActivityAt, t)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
