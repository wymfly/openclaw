/* deck-go logs prototype v2 — orchestrator */

const { useState, useMemo, useEffect, useCallback } = React;

function LogsApp() {
  const data = window.__logsData;

  const [tweaks, setTweaks] = useState({
    theme: "dark",
    density: "compact",
    listState: "ready",
    streamState: "live",
    detailState: "ready",
  });

  const [query, setQuery] = useState("");
  const [enabledLevels, setEnabledLevels] = useState(
    () => new Set(["debug", "info", "warn", "error"]),
  );
  const [source, setSource] = useState("__all__");
  const [session, setSession] = useState("__all__");
  const [correlationId, setCorrelationId] = useState("");
  const [selectedCursor, setSelectedCursor] = useState(data.tail.lines[0]?.cursor ?? null);
  const [rawDialog, setRawDialog] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.tail.lines.filter((line) => {
      if (!enabledLevels.has(line.level)) return false;
      if (source !== "__all__" && line.source !== source) return false;
      if (session !== "__all__" && line.sessionKey !== session) return false;
      if (correlationId.trim() && line.correlationId !== correlationId.trim()) return false;
      if (q) {
        const hay =
          `${line.ts}|${line.message}|${line.sessionKey}|${line.source}|${line.correlationId ?? ""}|${JSON.stringify(line.fields)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.tail.lines, query, enabledLevels, source, session, correlationId]);

  useEffect(() => {
    if (selectedCursor != null && !visible.some((l) => l.cursor === selectedCursor)) {
      setSelectedCursor(visible[0]?.cursor ?? null);
    }
  }, [visible, selectedCursor]);

  const selected = useMemo(
    () => data.tail.lines.find((l) => l.cursor === selectedCursor) ?? null,
    [data.tail.lines, selectedCursor],
  );

  const onToggleLevel = useCallback((level) => {
    setEnabledLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const onClearAll = useCallback(() => {
    setQuery("");
    setEnabledLevels(new Set(["debug", "info", "warn", "error"]));
    setSource("__all__");
    setSession("__all__");
    setCorrelationId("");
  }, []);

  const onJumpCorrelation = useCallback((cid) => {
    if (!cid) return;
    setCorrelationId(cid);
    setQuery("");
  }, []);

  const onCopyMessage = useCallback(() => {
    if (!selected) return;
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1400);
  }, [selected]);

  const onTogglePause = useCallback(() => {
    setTweaks((t) => ({ ...t, streamState: t.streamState === "paused" ? "live" : "paused" }));
  }, []);

  const onRefresh = useCallback(() => {
    setTweaks((t) => ({ ...t, listState: "loading" }));
    window.setTimeout(() => setTweaks((t) => ({ ...t, listState: "ready" })), 280);
  }, []);

  const onClearLocal = useCallback(() => {
    setSelectedCursor(null);
  }, []);

  // Keyboard: Esc clear, ⌘K focus search, ⌘/ open free text, "/" focus search
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && (rawDialog || exportOpen)) {
        if (rawDialog) setRawDialog(null);
        if (exportOpen) setExportOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const el = document.querySelector('input[type="search"]');
        if (el) el.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rawDialog, exportOpen]);

  const listState = tweaks.listState;

  return (
    <div className="logs-app">
      <header className="logs-app__topbar">
        <div className="logs-app__title">
          <p className="logs-app__eyebrow">operations / logs</p>
          <h1>Log viewer</h1>
          <p className="logs-app__subtitle">
            Tail and live-stream evidence from Deck BFF + Gateway. Local filters narrow loaded rows;
            refreshing the tail re-fetches.
          </p>
        </div>
        <div className="logs-app__topbar-actions">
          <span
            className={`status-pill${tweaks.streamState === "paused" ? " status-pill--warn" : " status-pill--ok"}`}
          >
            <span className="status-pill__dot" />
            {tweaks.streamState === "paused" ? "Stream paused" : "Stream live"}
          </span>
          <span className="status-pill status-pill--ok">
            Tail {listState === "loading" ? "loading…" : "ready"}
          </span>
          <kbd className="kbd-hint" title="Focus search">
            ⌘K
          </kbd>
        </div>
      </header>

      <FilterBar
        query={query}
        onQueryChange={setQuery}
        levels={data.levels}
        enabledLevels={enabledLevels}
        onToggleLevel={onToggleLevel}
        sources={data.sources}
        source={source}
        onSourceChange={setSource}
        sessions={data.sessions}
        session={session}
        onSessionChange={setSession}
        correlationId={correlationId}
        onCorrelationChange={setCorrelationId}
        onClearAll={onClearAll}
      />

      <div className={`logs-app__workbench logs-app__workbench--${listState}`}>
        {listState === "loading" ? (
          <section className="state-overlay">
            <div className="state-overlay__spinner" aria-hidden />
            <p>Loading tail (limit 200)…</p>
          </section>
        ) : listState === "error" ? (
          <section className="state-overlay state-overlay--error">
            <div className="state-overlay__glyph" aria-hidden>
              <IconError size={28} />
            </div>
            <h2>Tail fetch failed</h2>
            <p>The Gateway returned 5xx. Click retry to reload the deck-go logs tail.</p>
            <button type="button" className="action-btn action-btn--primary" onClick={onRefresh}>
              <IconRefresh size={12} />
              <span>Retry</span>
            </button>
          </section>
        ) : (
          <>
            <LogStream
              lines={data.tail.lines}
              visible={visible}
              selectedCursor={selectedCursor}
              onSelect={setSelectedCursor}
              density={tweaks.density}
              streamState={tweaks.streamState}
              onTogglePause={onTogglePause}
              onRefresh={onRefresh}
              onClearLocal={onClearLocal}
              onPrepareExport={() => setExportOpen(true)}
              bufferCap={5000}
              cursor={data.tail.cursor}
              liveTape={data.tape}
              onOpenTapeRaw={(evt) => setRawDialog({ kind: "tape", entry: evt })}
            />

            <DetailsPane
              line={selected}
              onJumpCorrelation={onJumpCorrelation}
              onOpenRaw={() => selected && setRawDialog({ kind: "line", entry: selected })}
              onCopyMessage={onCopyMessage}
              copyState={copyState}
            />
          </>
        )}
      </div>

      {rawDialog && (
        <RawLineDialog
          entry={rawDialog.entry}
          kind={rawDialog.kind}
          onClose={() => setRawDialog(null)}
        />
      )}
      {exportOpen && (
        <ExportPreviewDialog visible={visible} query={query} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}

const TWEAK_FIELDS = [
  {
    key: "theme",
    label: "Theme",
    type: "segmented",
    options: ["dark", "light"],
  },
  {
    key: "density",
    label: "Density",
    type: "segmented",
    options: ["compact", "cozy"],
  },
  {
    key: "listState",
    label: "List state",
    type: "segmented",
    options: ["ready", "loading", "error"],
  },
  {
    key: "streamState",
    label: "Stream state",
    type: "segmented",
    options: ["live", "paused"],
  },
  {
    key: "detailState",
    label: "Detail state",
    type: "segmented",
    options: ["ready", "empty"],
  },
];

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<LogsApp />);

const tweaksRoot = ReactDOM.createRoot(document.getElementById("tweaks-root"));
function TweaksHost() {
  const [tweaks, setTweaks] = useState({
    theme: "dark",
    density: "compact",
    listState: "ready",
    streamState: "live",
    detailState: "ready",
  });
  return (
    <TweaksPanel
      title="Logs prototype"
      fields={TWEAK_FIELDS}
      values={tweaks}
      onChange={(k, v) => setTweaks((t) => ({ ...t, [k]: v }))}
      onReset={() => {
        setTweaks({
          theme: "dark",
          density: "compact",
          listState: "ready",
          streamState: "live",
          detailState: "ready",
        });
      }}
    />
  );
}
tweaksRoot.render(<TweaksHost />);
