/* deck-go threads prototype v2 — orchestrator */

const { useState, useMemo, useEffect, useCallback } = React;

function ThreadsApp() {
  const data = window.__threadsData;

  const [tweaks, setTweaks] = useState({
    theme: "dark",
    density: "compact",
    listState: "ready",
    detailState: "ready",
  });

  const [view, setView] = useState("list"); // list | detail
  const [query, setQuery] = useState("");
  const [channelKindFilter, setChannelKindFilter] = useState("__all__");
  const [targetKindFilter, setTargetKindFilter] = useState("__all__");
  const [staleFilter, setStaleFilter] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dialog, setDialog] = useState(null);
  const [threads, setThreads] = useState(data.threads);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const onSelect = useCallback((id) => {
    setSelectedThreadId(id);
    setActiveTab("overview");
    setView("detail");
  }, []);

  const onBack = useCallback(() => {
    setView("list");
  }, []);

  const onRefresh = useCallback(() => {
    setTweaks((t) => ({ ...t, listState: "loading" }));
    window.setTimeout(() => setTweaks((t) => ({ ...t, listState: "ready" })), 280);
  }, []);

  const onUnbind = useCallback(() => {
    if (!selectedThread) return;
    setThreads((prev) => prev.filter((t) => t.threadId !== selectedThread.threadId));
    setView("list");
    setDialog(null);
  }, [selectedThread]);

  const onRebind = useCallback(
    (newAgentId) => {
      if (!selectedThread) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === selectedThread.threadId ? { ...t, agentId: newAgentId } : t,
        ),
      );
      setDialog(null);
    },
    [selectedThread],
  );

  const onRename = useCallback(
    (newLabel) => {
      if (!selectedThread) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === selectedThread.threadId ? { ...t, label: newLabel ?? undefined } : t,
        ),
      );
      setDialog(null);
    },
    [selectedThread],
  );

  const onOpenChat = useCallback(() => {
    if (!selectedThread) return;
    // In production: navigate to chat panel filtered to selectedThread.targetSessionKey
    setDialog({ kind: "open-chat-stub" });
  }, [selectedThread]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const el = document.querySelector('input[type="search"]');
        if (el) el.focus();
        return;
      }
      if (e.key === "Escape") {
        if (dialog) {
          setDialog(null);
          return;
        }
        if (view === "detail") {
          setView("list");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, view]);

  const agents = useMemo(() => {
    return Array.from(
      new Set([
        ...threads.map((t) => t.agentId),
        "main",
        "build",
        "research",
        "incident",
        "designer",
        "platform",
      ]),
    ).sort();
  }, [threads]);

  const listState = tweaks.listState;
  const showDetail = view === "detail" && selectedThread;

  return (
    <div className="threads-app">
      <header className="threads-app__topbar">
        <div className="threads-app__title">
          <p className="threads-app__eyebrow">operations / threads</p>
          <h1>Channel ↔ agent bindings</h1>
          <p className="threads-app__subtitle">
            A read-mostly registry mapping channel accounts to deck-go agents. The conversation
            transcript itself lives in the <code>Chat</code> panel; threads exposes binding
            metadata, projected recent activity, and audit history.
          </p>
        </div>
        <div className="threads-app__topbar-actions">
          <span
            className={`status-pill${listState === "loading" ? " status-pill--warn" : " status-pill--ok"}`}
          >
            <span className="status-pill__dot" />
            {listState === "loading" ? "Refreshing…" : "Ready"}
          </span>
          <kbd className="kbd-hint" title="Focus search">
            ⌘K
          </kbd>
        </div>
      </header>

      <main className="threads-app__main">
        {showDetail ? (
          <ThreadDetailView
            thread={selectedThread}
            recentActivity={data.recentActivity}
            auditTrail={data.auditTrail}
            channelKindFromId={data.channelKindFromId}
            now={data.NOW}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onBack={onBack}
            onUnbind={() => setDialog({ kind: "unbind" })}
            onRebind={() => setDialog({ kind: "rebind" })}
            onRename={() => setDialog({ kind: "rename" })}
            onOpenChat={onOpenChat}
            onOpenRaw={() => setDialog({ kind: "raw" })}
          />
        ) : listState === "loading" ? (
          <section className="state-overlay">
            <div className="state-overlay__spinner" aria-hidden />
            <p>Refreshing thread bindings…</p>
          </section>
        ) : listState === "error" ? (
          <section className="state-overlay state-overlay--error">
            <div className="state-overlay__glyph">
              <IconAlert size={28} />
            </div>
            <h2>Threads fetch failed</h2>
            <p>The Gateway returned 5xx. Click retry to reload.</p>
            <button type="button" className="action-btn action-btn--primary" onClick={onRefresh}>
              <IconRefresh size={12} /> <span>Retry</span>
            </button>
          </section>
        ) : (
          <ThreadsListView
            threads={threads}
            query={query}
            onQueryChange={setQuery}
            channelKindFilter={channelKindFilter}
            onChannelKindChange={setChannelKindFilter}
            targetKindFilter={targetKindFilter}
            onTargetKindChange={setTargetKindFilter}
            staleFilter={staleFilter}
            onStaleChange={setStaleFilter}
            onSelect={onSelect}
            channelKinds={data.channelKinds}
            targetKinds={data.targetKinds}
            channelKindFromId={data.channelKindFromId}
            now={data.NOW}
            onRefresh={onRefresh}
          />
        )}
      </main>

      {dialog?.kind === "unbind" && selectedThread && (
        <UnbindDialog
          thread={selectedThread}
          channelKindFromId={data.channelKindFromId}
          onClose={() => setDialog(null)}
          onConfirm={onUnbind}
        />
      )}
      {dialog?.kind === "rebind" && selectedThread && (
        <RebindDialog
          thread={selectedThread}
          agents={agents}
          onClose={() => setDialog(null)}
          onConfirm={onRebind}
        />
      )}
      {dialog?.kind === "rename" && selectedThread && (
        <RenameDialog
          thread={selectedThread}
          onClose={() => setDialog(null)}
          onConfirm={onRename}
        />
      )}
      {dialog?.kind === "raw" && selectedThread && (
        <RawEntryDialog thread={selectedThread} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "open-chat-stub" && (
        <ModalShell
          title="Open in chat"
          subtitle={selectedThread?.targetSessionKey}
          onClose={() => setDialog(null)}
        >
          <p>
            In production this jumps to the <code>Chat</code> panel scoped to{" "}
            <code>{selectedThread?.targetSessionKey}</code>. The prototype stops here.
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="modal__btn modal__btn--primary"
              onClick={() => setDialog(null)}
            >
              OK
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

const TWEAK_FIELDS = [
  { key: "theme", label: "Theme", type: "segmented", options: ["dark", "light"] },
  { key: "density", label: "Density", type: "segmented", options: ["compact", "cozy"] },
  {
    key: "listState",
    label: "List state",
    type: "segmented",
    options: ["ready", "loading", "error"],
  },
  { key: "detailState", label: "Detail state", type: "segmented", options: ["ready", "empty"] },
];

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ThreadsApp />);

const tweaksRoot = ReactDOM.createRoot(document.getElementById("tweaks-root"));
function TweaksHost() {
  const [tweaks, setTweaks] = useState({
    theme: "dark",
    density: "compact",
    listState: "ready",
    detailState: "ready",
  });
  return (
    <TweaksPanel
      title="Threads prototype"
      fields={TWEAK_FIELDS}
      values={tweaks}
      onChange={(k, v) => setTweaks((t) => ({ ...t, [k]: v }))}
      onReset={() => {
        setTweaks({ theme: "dark", density: "compact", listState: "ready", detailState: "ready" });
      }}
    />
  );
}
tweaksRoot.render(<TweaksHost />);
