import type { DeckGoThreadEntry } from "../../../api";
import { formatRelativeThreadTime } from "./thread-utils";

type ThreadListProps = {
  threads: DeckGoThreadEntry[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
};

export function ThreadList({ threads, selectedThreadId, onSelectThread }: ThreadListProps) {
  if (threads.length === 0) {
    return <p className="deckgo-note deck-ui-threads-empty">No threads loaded.</p>;
  }

  return (
    <ul className="deckgo-shell-list deck-ui-threads-list">
      {threads.map((thread) => (
        <li key={thread.threadId}>
          <button
            type="button"
            className={`deckgo-selectable-card deck-ui-threads-row ${selectedThreadId === thread.threadId ? "is-selected" : ""}`}
            onClick={() => onSelectThread(thread.threadId)}
          >
            <strong>{thread.label || thread.threadId}</strong>
            <div className="deckgo-meta deck-ui-threads-meta">
              agent: {thread.agentId} | channel: {thread.channelId}
            </div>
            <div className="deckgo-meta deck-ui-threads-meta">
              session: {thread.targetSessionKey} | kind: {thread.targetKind}
            </div>
            <div className="deckgo-meta deck-ui-threads-meta">
              last activity: {formatRelativeThreadTime(thread.lastActivityAt)} | bound:{" "}
              {formatRelativeThreadTime(thread.boundAt)}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
