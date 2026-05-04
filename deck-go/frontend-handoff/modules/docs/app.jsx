// DocsApp — orchestrator: topbar (brand + search + Extract CTA) + 2-pane
// (tree ↔ viewer) + search overlay. Active doc id stays in URL hash.

const DocsApp = () => {
  const [docs, setDocs] = React.useState(() => DOCS);
  const [selectedId, setSelectedId] = React.useState(() => {
    const hash = window.location.hash.replace("#/", "");
    return hash || DOCS[0].id;
  });
  const [query, setQuery] = React.useState("");
  const [keywordFilter, setKeywordFilter] = React.useState(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(null);
  const [extractOpen, setExtractOpen] = React.useState(false);
  const [extractPhase, setExtractPhase] = React.useState("idle");
  const searchRef = React.useRef(null);
  const extractAnchorRef = React.useRef(null);

  React.useEffect(() => {
    if (selectedId) {
      window.history.replaceState(null, "", `#/${selectedId}`);
    }
  }, [selectedId]);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setExtractOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allKeywords = React.useMemo(() => {
    const set = new Set();
    for (const d of docs) for (const k of d.keywords) set.add(k);
    return [...set].sort();
  }, [docs]);

  const results = React.useMemo(() => buildSearchResults(docs, query), [docs, query]);

  const selected = docs.find((d) => d.id === selectedId) || docs[0];

  const handlePick = (id) => {
    setSelectedId(id);
    setSearchOpen(false);
    setQuery("");
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1400);
  };

  const handleDelete = (id) => {
    setDocs((curr) => curr.filter((d) => d.id !== id));
    const next = docs.find((d) => d.id !== id);
    if (next) setSelectedId(next.id);
  };

  const handleExtractConfirm = () => {
    setExtractPhase("running");
    setTimeout(() => {
      const newDoc = {
        id: `doc-summary-extracted-${Date.now()}`,
        title: `Summary of ${ACTIVE_SESSION.id}`,
        category: "summary",
        sourceSession: ACTIVE_SESSION.id,
        sourceAgent: ACTIVE_SESSION.agentId,
        keywords: ["extracted", ACTIVE_SESSION.agentName],
        language: "en",
        extractedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: `# Summary of ${ACTIVE_SESSION.id}\n\nExtracted at ${new Date().toLocaleString()} from ${ACTIVE_SESSION.messageCount} messages by agent **${ACTIVE_SESSION.agentName}**.\n\n## Highlights\n\n- (production fills these from the LLM extraction step)\n- session ran ~${Math.floor((Date.now() - new Date(ACTIVE_SESSION.startedAt).getTime()) / 60000)} minutes\n- prototype output is a deterministic stub`,
      };
      setDocs((curr) => [newDoc, ...curr]);
      setSelectedId(newDoc.id);
      setExtractPhase("done");
      setTimeout(() => {
        setExtractOpen(false);
        setExtractPhase("idle");
      }, 900);
    }, 700);
  };

  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <div className="docs-topbar__brand">
          <IconBook />
          <span>Docs</span>
          <span className="muted small">/ extracted from sessions</span>
        </div>
        <div className="docs-topbar__search-wrap">
          <label className="search-input docs-topbar__search">
            <IconSearch />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search docs… (⌘K)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {query && (
              <button
                className="search-input__clear"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                aria-label="Clear search"
              >
                <IconClose />
              </button>
            )}
          </label>
          {searchOpen && query && (
            <SearchResults
              query={query}
              results={results}
              onPick={handlePick}
              onClose={() => {
                setSearchOpen(false);
                setQuery("");
              }}
            />
          )}
        </div>
        <div className="docs-topbar__actions">
          <span className="muted small docs-topbar__count">{docs.length} docs</span>
          <div className="docs-extract">
            <button
              ref={extractAnchorRef}
              className="btn btn--primary btn--sm"
              onClick={() => setExtractOpen((v) => !v)}
            >
              <IconArrowRight />
              Extract from session
            </button>
            {extractOpen && (
              <div className="docs-extract__pop">
                <div className="docs-extract__pop-head">
                  <span className="docs-extract__pop-title">Active session</span>
                  <button
                    className="docs-extract__pop-close"
                    onClick={() => setExtractOpen(false)}
                    aria-label="Close"
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="docs-extract__pop-body">
                  <div className="docs-extract__row">
                    <span className="muted small">Session</span>
                    <code>{ACTIVE_SESSION.id}</code>
                  </div>
                  <div className="docs-extract__row">
                    <span className="muted small">Agent</span>
                    <span>{ACTIVE_SESSION.agentName}</span>
                  </div>
                  <div className="docs-extract__row">
                    <span className="muted small">Messages</span>
                    <span>{ACTIVE_SESSION.messageCount}</span>
                  </div>
                  <div className="docs-extract__row">
                    <span className="muted small">Started</span>
                    <span>{formatRelative(ACTIVE_SESSION.startedAt)}</span>
                  </div>
                </div>
                <div className="docs-extract__pop-foot">
                  {extractPhase === "idle" && (
                    <>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => setExtractOpen(false)}
                      >
                        Cancel
                      </button>
                      <button className="btn btn--primary btn--sm" onClick={handleExtractConfirm}>
                        Extract
                      </button>
                    </>
                  )}
                  {extractPhase === "running" && <span className="muted small">Extracting…</span>}
                  {extractPhase === "done" && (
                    <span className="docs-extract__done small">Doc extracted ✓</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="docs-workspace">
        <aside className="docs-workspace__tree">
          <DocsTree
            categories={CATEGORIES}
            docs={docs}
            selectedId={selectedId}
            onSelect={handlePick}
            keywordFilter={keywordFilter}
          />
        </aside>
        <section className="docs-workspace__viewer">
          {selected && (
            <DocViewer
              doc={selected}
              categories={CATEGORIES}
              agents={AGENTS}
              allKeywords={allKeywords}
              onKeywordFilter={setKeywordFilter}
              keywordFilter={keywordFilter}
              onSelectId={handlePick}
              onCopyId={handleCopyId}
              copiedId={copiedId}
              onDelete={handleDelete}
            />
          )}
        </section>
      </main>

      <TweaksPanel />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<DocsApp />);
