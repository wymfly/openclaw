import { useEffect, useState } from "react";
import type { DeckGoThreadEntry } from "../../api";
import { fetchThreads } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

export function RestoredThreadsPanel() {
  const [threads, setThreads] = useState<DeckGoThreadEntry[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "all">("active");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");

  const refresh = async (preferredThreadId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchThreads({
        agentId: filterAgent,
        channel: filterChannel,
        status: filterStatus,
      });
      const nextThreads = next.threads ?? [];
      setThreads(nextThreads);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredThreadId?.trim() || nextThreads[0]?.threadId || "";
      setSelectedThreadId((current) =>
        nextThreads.some((thread) => thread.threadId === current)
          ? current
          : nextThreads.some((thread) => thread.threadId === fallbackId)
            ? fallbackId
            : nextThreads[0]?.threadId || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load threads");
    }
  };

  useEffect(() => {
    void refresh();
  }, [filterAgent, filterChannel, filterStatus]);

  const selectedThread =
    threads.find((thread) => thread.threadId === selectedThreadId) ?? threads[0] ?? null;

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Threads</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect-first Vite thread surface over `deck.threads.list`.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Threads {loadState}
              </span>
              <span className="deckgo-pill">{threads.length} results</span>
            </div>
            <div className="deckgo-actions">
              <input
                className="deckgo-input"
                value={filterAgent}
                onChange={(event) => setFilterAgent(event.target.value)}
                placeholder="agent id"
              />
              <input
                className="deckgo-input"
                value={filterChannel}
                onChange={(event) => setFilterChannel(event.target.value)}
                placeholder="channel id"
              />
              <select
                className="deckgo-input"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as "active" | "all")}
              >
                <option value="active">active</option>
                <option value="all">all</option>
              </select>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedThreadId)}
              >
                Refresh threads
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="threads" value={threads.length} />
              <ShellStat label="selected" value={selectedThread?.threadId || "n/a"} />
            </div>
            {threads.length === 0 ? (
              <p className="deckgo-note">No threads loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {threads.map((thread) => (
                  <li key={thread.threadId}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedThread?.threadId === thread.threadId ? "is-selected" : ""}`}
                      onClick={() => setSelectedThreadId(thread.threadId)}
                    >
                      <strong>{thread.label || thread.threadId}</strong>
                      <div className="deckgo-meta">
                        agent: {thread.agentId} | channel: {thread.channelId}
                      </div>
                      <div className="deckgo-meta">
                        session: {thread.targetSessionKey} | kind: {thread.targetKind}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected thread</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice keeps thread migration inspect-first instead of waiting for the richer
            relation tooling.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedThread ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Thread</p>
                    <strong>{selectedThread.label || selectedThread.threadId}</strong>
                    <p className="deckgo-note">{selectedThread.threadId}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedThread.channelId}</span>
                    <span className="deckgo-pill">{selectedThread.agentId}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat
                    label="bound at"
                    value={new Date(selectedThread.boundAt).toLocaleString()}
                  />
                  <ShellStat
                    label="last activity"
                    value={new Date(selectedThread.lastActivityAt).toLocaleString()}
                  />
                </div>
                <JsonDetails title="Thread payload" payload={selectedThread} />
              </>
            ) : (
              <p className="deckgo-note">Choose a thread to inspect it.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
