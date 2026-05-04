// MemorySearch — Search tab. Semantic search over memory store via
// DeckGoMemorySearchResponse. Scope = all | global | agent. Result list
// shows path + tier + scope + relevance + decay + content snippet.

const SCOPE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "global", label: "Global only" },
  { id: "agent", label: "Per-agent" },
];

const MemorySearch = () => {
  const [scope, setScope] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const [response, setResponse] = React.useState(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (phase !== "running") return;
    const timer = setTimeout(() => {
      const fixture = SEARCH_FIXTURES[query.toLowerCase().trim()];
      if (fixture) {
        const filtered =
          scope === "all"
            ? fixture.results
            : scope === "global"
              ? fixture.results.filter((r) => !r.scope || r.scope === "global")
              : fixture.results.filter((r) => r.scope && r.scope.startsWith("agent:"));
        setResponse({ ...fixture, results: filtered });
      } else {
        setResponse({ results: [], unavailableReason: null, lanceDbEnabled: true });
      }
      setPhase("done");
    }, 260);
    return () => clearTimeout(timer);
  }, [phase, query, scope]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setPhase("running");
  };

  const handleClear = () => {
    setQuery("");
    setResponse(null);
    setPhase("idle");
    inputRef.current?.focus();
  };

  return (
    <div className="memory-search">
      <form className="memory-search__form" onSubmit={handleSubmit}>
        <label className="search-input memory-search__input">
          <IconSearch />
          <input
            ref={inputRef}
            type="text"
            placeholder='Try "runtime mode" or "test strategy"…'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPhase("idle");
            }}
          />
          {query && (
            <button
              type="button"
              className="search-input__clear"
              onClick={handleClear}
              aria-label="Clear"
            >
              <IconClose />
            </button>
          )}
        </label>
        <div className="memory-search__scope">
          <span className="muted small">Scope</span>
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`memory-search__scope-btn ${scope === opt.id ? "memory-search__scope-btn--on" : ""}`}
              onClick={() => setScope(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={!query.trim() || phase === "running"}
        >
          {phase === "running" ? "Searching…" : "Search"}
        </button>
      </form>

      {!response && phase === "idle" && (
        <div className="memory-search__hint">
          <p className="muted">
            Semantic search over the memory store. Production hits LanceDB via{" "}
            <code>POST /api/memory/search</code>. Try the demo queries: <code>runtime mode</code>,{" "}
            <code>test strategy</code>, <code>dashboard</code>.
          </p>
        </div>
      )}

      {response && (
        <div className="memory-search__results">
          <header className="memory-search__results-head">
            <span>
              <strong>{response.results.length}</strong> result
              {response.results.length === 1 ? "" : "s"}
              <span className="muted small"> for </span>
              <code>{query}</code>
              <span className="muted small"> · scope: {scope}</span>
            </span>
            {response.lanceDbEnabled === false && (
              <span className="memory-search__warn">
                <IconAlert />
                LanceDB unavailable — keyword fallback active
              </span>
            )}
          </header>

          {response.results.length === 0 ? (
            <div className="memory-search__empty">
              <p className="muted">No matches. Try different terms or change scope.</p>
            </div>
          ) : (
            <ul className="memory-search__list">
              {response.results.map((r, i) => (
                <li key={`${r.path}-${i}`} className="memory-search__row">
                  <div className="memory-search__row-head">
                    <code className="memory-search__row-path">{r.path}</code>
                    <RelevanceBar value={r.relevance} />
                  </div>
                  <p className="memory-search__row-content">{r.content}</p>
                  <div className="memory-search__row-meta">
                    {r.tier && <TierBadge tier={r.tier} />}
                    <ScopeBadge scope={r.scope} />
                    {r.decayScore != null && (
                      <span className="memory-search__decay muted small">
                        decay <DecayBar value={r.decayScore} />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { MemorySearch });
