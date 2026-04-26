import type { DeckGoThreadEntry } from "../../../api";
import { explainThreadRelation } from "./thread-utils";

type ThreadRelationViewProps = {
  thread: DeckGoThreadEntry;
};

export function ThreadRelationView({ thread }: ThreadRelationViewProps) {
  return (
    <div className="deckgo-surface-tile deck-ui-threads-relation">
      <p className="deckgo-surface-label">Routing relationship</p>
      <div className="deckgo-grid deckgo-grid-3 deck-ui-threads-relation-grid">
        <div className="deck-ui-threads-relation-node">
          <p className="deckgo-kicker">Thread</p>
          <strong>{thread.label || thread.threadId}</strong>
          <p className="deckgo-note">channel: {thread.channelId}</p>
        </div>
        <div className="deck-ui-threads-relation-node">
          <p className="deckgo-kicker">Target session</p>
          <strong>{thread.targetSessionKey}</strong>
          <p className="deckgo-note">kind: {thread.targetKind}</p>
        </div>
        <div className="deck-ui-threads-relation-node">
          <p className="deckgo-kicker">Target agent</p>
          <strong>{thread.agentId}</strong>
          <p className="deckgo-note">account: {thread.accountId}</p>
        </div>
      </div>
      <p className="deckgo-note deck-ui-threads-relation-summary">
        {explainThreadRelation(thread)}
      </p>
    </div>
  );
}
