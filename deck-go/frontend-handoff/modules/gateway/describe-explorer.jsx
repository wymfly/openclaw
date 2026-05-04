// describe-explorer.jsx — searchable methods + events catalog from
// gateway.describe response. Two modes (Methods | Events) + search +
// scope filter + selection drives the right-side detail card.

const { useMemo: useDescMemo, useState: useDescState } = React;

const SCOPE_FILTERS = ["all", "operator.read", "operator.write", "system"];

function DescribeExplorer({ describeResp }) {
  const [mode, setMode] = useDescState("methods");
  const [query, setQuery] = useDescState("");
  const [scopeFilter, setScopeFilter] = useDescState("all");
  const [selectedKey, setSelectedKey] = useDescState(null);

  const methods = useDescMemo(() => {
    const m = describeResp?.methods || {};
    return Object.entries(m).map(([name, meta]) => ({ name, ...meta }));
  }, [describeResp]);

  const events = useDescMemo(() => {
    const e = describeResp?.events || {};
    return Object.entries(e).map(([name, meta]) => ({ name, ...meta }));
  }, [describeResp]);

  const list = mode === "methods" ? methods : events;

  const filtered = useDescMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((x) => {
      if (mode === "methods" && scopeFilter !== "all" && x.scope !== scopeFilter) return false;
      if (q) {
        const blob = `${x.name} ${x.scope || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [list, query, scopeFilter, mode]);

  const selected = useDescMemo(
    () => filtered.find((x) => x.name === selectedKey) || filtered[0] || null,
    [filtered, selectedKey],
  );

  const counts = {
    methods: methods.length,
    events: events.length,
    untyped: (describeResp?.untyped || []).length,
    read: methods.filter((m) => m.scope === "operator.read").length,
    write: methods.filter((m) => m.scope === "operator.write").length,
  };

  return (
    <article className="describe-explorer">
      <header className="describe-explorer__head">
        <h2>Methods &amp; events</h2>
        <p className="describe-explorer__hint">
          From <code>gateway.describe</code> · {counts.methods} methods · {counts.events} events ·{" "}
          {counts.untyped} untyped
        </p>
      </header>

      <div className="describe-explorer__controls">
        <div className="describe-explorer__mode" role="tablist" aria-label="Describe mode">
          <button
            role="tab"
            aria-selected={mode === "methods"}
            className={`ds-seg ${mode === "methods" ? "ds-seg--on" : ""}`}
            onClick={() => {
              setMode("methods");
              setSelectedKey(null);
            }}
          >
            Methods <span className="ds-seg__count">{counts.methods}</span>
          </button>
          <button
            role="tab"
            aria-selected={mode === "events"}
            className={`ds-seg ${mode === "events" ? "ds-seg--on" : ""}`}
            onClick={() => {
              setMode("events");
              setSelectedKey(null);
            }}
          >
            Events <span className="ds-seg__count">{counts.events}</span>
          </button>
        </div>
        <label className="describe-explorer__search">
          <IconSearch size={13} />
          <input
            type="search"
            placeholder={mode === "methods" ? "Filter methods (e.g., sessions.)" : "Filter events"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter describe entries"
          />
        </label>
        {mode === "methods" ? (
          <div className="describe-explorer__scope" role="tablist" aria-label="Scope filter">
            {SCOPE_FILTERS.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={scopeFilter === s}
                className={`ds-seg ${scopeFilter === s ? "ds-seg--on" : ""}`}
                onClick={() => setScopeFilter(s)}
              >
                {s === "all" ? "All" : s.replace("operator.", "")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="describe-explorer__split">
        <div className="describe-explorer__list" role="region" aria-label="Describe entries">
          {filtered.length === 0 ? (
            <div className="describe-explorer__empty">
              <strong>No entries match.</strong>
              <span>Try clearing search / scope filter.</span>
            </div>
          ) : (
            <ul role="list">
              {filtered.map((x) => (
                <li
                  key={x.name}
                  role="listitem"
                  className={`describe-row ${selected?.name === x.name ? "describe-row--on" : ""}`}
                  onClick={() => setSelectedKey(x.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedKey(x.name);
                    }
                  }}
                  tabIndex={0}
                  aria-pressed={selected?.name === x.name}
                >
                  <code className="describe-row__name">{x.name}</code>
                  <div className="describe-row__meta">
                    {mode === "methods" ? (
                      <ScopePill scope={x.scope} />
                    ) : (
                      <span className="event-tag">event</span>
                    )}
                    {x.since != null ? <SinceTag since={x.since} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="describe-explorer__detail"
          role="region"
          aria-label="Selected describe entry detail"
        >
          {selected ? (
            <DescribeDetail selected={selected} mode={mode} />
          ) : (
            <div className="describe-explorer__placeholder">
              <IconLayers size={20} />
              <strong>Pick a {mode === "methods" ? "method" : "event"}</strong>
              <span>Inspect scope, params, result, and version.</span>
            </div>
          )}
        </div>
      </div>

      {mode === "methods" && describeResp?.untyped?.length ? (
        <footer className="describe-explorer__untyped">
          <h3>
            Untyped methods{" "}
            <span className="describe-explorer__count">{describeResp.untyped.length}</span>
          </h3>
          <p className="describe-explorer__hint">
            No params/result schema published. Use with caution.
          </p>
          <ul className="describe-explorer__untyped-list">
            {describeResp.untyped.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}

function DescribeDetail({ selected, mode }) {
  const paramsJson = selected.params ? JSON.stringify(selected.params, null, 2) : null;
  const resultJson = selected.result
    ? typeof selected.result === "string"
      ? selected.result
      : JSON.stringify(selected.result, null, 2)
    : null;
  const payloadJson = selected.payload ? JSON.stringify(selected.payload, null, 2) : null;
  return (
    <div className="describe-detail">
      <header>
        <code className="describe-detail__name">{selected.name}</code>
        <div className="describe-detail__meta">
          {mode === "methods" ? (
            <ScopePill scope={selected.scope} />
          ) : (
            <span className="event-tag">event</span>
          )}
          {selected.since != null ? <SinceTag since={selected.since} /> : null}
        </div>
      </header>
      {paramsJson ? (
        <section>
          <h4>params</h4>
          <pre className="json-block">{paramsJson}</pre>
        </section>
      ) : null}
      {resultJson ? (
        <section>
          <h4>result</h4>
          <pre className="json-block">{resultJson}</pre>
        </section>
      ) : null}
      {payloadJson ? (
        <section>
          <h4>payload</h4>
          <pre className="json-block">{payloadJson}</pre>
        </section>
      ) : null}
      {!paramsJson && !resultJson && !payloadJson ? (
        <p className="describe-detail__no-schema">No schema published.</p>
      ) : null}
    </div>
  );
}

Object.assign(window, { DescribeExplorer });
