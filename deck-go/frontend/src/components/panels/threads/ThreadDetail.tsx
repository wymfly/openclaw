import type { DeckGoThreadEntry } from "../../../api";
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
  if (!thread) {
    return <p className="deckgo-note deck-ui-threads-empty">Choose a thread to inspect it.</p>;
  }

  return (
    <>
      <div className="deckgo-panel-hero-strip deck-ui-threads-hero">
        <div>
          <p className="deckgo-kicker">Thread</p>
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
          Copy session key
        </button>
        <button
          className="deckgo-button deck-ui-threads-button"
          type="button"
          onClick={onOpenSession}
        >
          Open session
        </button>
        <button
          className="deckgo-button deck-ui-threads-button"
          type="button"
          onClick={onOpenAgent}
        >
          Open agent
        </button>
      </div>
      {handoffMessage ? (
        <p className="deckgo-note deck-ui-threads-handoff">{handoffMessage}</p>
      ) : null}
      <div className="deckgo-grid deckgo-grid-2 deck-ui-threads-stats">
        <ShellStat label="bound at" value={formatThreadTimestamp(thread.boundAt)} />
        <ShellStat label="last activity" value={formatThreadTimestamp(thread.lastActivityAt)} />
        <ShellStat label="account" value={thread.accountId} />
        <ShellStat label="bound by" value={thread.boundBy} />
      </div>
      <ThreadRelationView thread={thread} />
      <JsonDetails title="Thread payload" payload={thread} />
    </>
  );
}
