import type { ReactNode } from "react";

export function AgentListBoundary({ children }: { children: ReactNode }) {
  return (
    <div
      className="deckgo-column deck-ui-agents-column deck-ui-agent-list-boundary"
      data-agent-boundary="list"
    >
      {children}
    </div>
  );
}

export function AgentDetailBoundary({ children }: { children: ReactNode }) {
  return (
    <div
      className="deckgo-column deckgo-panel-main deck-ui-agents-column deck-ui-agent-detail-boundary"
      data-agent-boundary="detail"
    >
      {children}
    </div>
  );
}

export function AgentCompareBoundary({ children }: { children: ReactNode }) {
  return (
    <div className="deck-ui-agent-compare-panel" data-agent-boundary="compare">
      {children}
    </div>
  );
}

export function AgentEditorBoundary({ children, kind }: { children: ReactNode; kind: string }) {
  return (
    <div className="deck-ui-agent-editor-boundary" data-agent-editor={kind}>
      {children}
    </div>
  );
}
