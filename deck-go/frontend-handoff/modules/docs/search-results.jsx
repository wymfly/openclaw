// SearchResults — dropdown overlay below the topbar search input. Shows
// matched docs grouped by category, with snippet excerpting + first match
// highlighted. Search hits weight-by: title (×10) > keyword (×5) > body (×1).

const SearchResults = ({ query, results, onPick, onClose }) => {
  if (!query) return null;

  const grouped = React.useMemo(() => {
    const map = new Map();
    for (const r of results) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category).push(r);
    }
    return [...map.entries()];
  }, [results]);

  return (
    <div className="search-results" role="listbox">
      <div className="search-results__head">
        <span className="muted small">
          {results.length} match{results.length === 1 ? "" : "es"} for
        </span>
        <code>{query}</code>
        <button className="search-results__close" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>
      {results.length === 0 ? (
        <div className="search-results__empty">
          <p className="muted">No docs match. Try fewer terms or a different keyword.</p>
        </div>
      ) : (
        <div className="search-results__body">
          {grouped.map(([cat, items]) => (
            <div key={cat} className="search-results__group">
              <h4 className="search-results__group-title">{cat}</h4>
              <ul className="search-results__list">
                {items.map((r) => (
                  <li key={r.id}>
                    <button className="search-results__row" onClick={() => onPick(r.id)}>
                      <div className="search-results__row-head">
                        <Highlight text={r.title} q={query} />
                        <span className="muted small">
                          {r.matchCount} hit{r.matchCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="search-results__row-snippet">
                        <Highlight text={r.snippet} q={query} />
                      </p>
                      <div className="search-results__row-tags">
                        {r.keywords.map((k) => (
                          <span key={k} className="search-results__row-tag">
                            {k}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Highlight = ({ text, q }) => {
  if (!q) return <>{text}</>;
  const parts = [];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let last = 0;
  let idx = lower.indexOf(ql);
  while (idx >= 0) {
    if (idx > last) parts.push({ kind: "txt", value: text.slice(last, idx) });
    parts.push({ kind: "hit", value: text.slice(idx, idx + q.length) });
    last = idx + q.length;
    idx = lower.indexOf(ql, last);
  }
  if (last < text.length) parts.push({ kind: "txt", value: text.slice(last) });
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "hit" ? (
          <mark key={i} className="hl">
            {p.value}
          </mark>
        ) : (
          p.value
        ),
      )}
    </>
  );
};

function buildSearchResults(docs, query) {
  if (!query) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const d of docs) {
    const titleHits = d.title.toLowerCase().includes(q) ? 2 : 0;
    const keywordHits = d.keywords.some((k) => k.toLowerCase().includes(q)) ? 1 : 0;
    const sessionHits = d.sourceSession && d.sourceSession.toLowerCase().includes(q) ? 1 : 0;
    const bodyHits = countMatches(d.content.toLowerCase(), q);
    const matchCount = titleHits + keywordHits + sessionHits + bodyHits;
    if (matchCount === 0) continue;
    const snippet = makeSnippet(d.content, q) || d.title;
    results.push({
      id: d.id,
      category: d.category,
      title: d.title,
      keywords: d.keywords,
      snippet,
      matchCount,
      score: titleHits * 10 + keywordHits * 5 + sessionHits * 3 + bodyHits,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

function countMatches(haystack, needle) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx >= 0) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function makeSnippet(body, query) {
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + query.length + 80);
  let s = body.slice(start, end).replace(/\n/g, " ").replace(/\s+/g, " ");
  if (start > 0) s = "…" + s;
  if (end < body.length) s = s + "…";
  return s;
}

Object.assign(window, { SearchResults, buildSearchResults });
