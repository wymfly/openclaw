// session-table.jsx — sessions list with filters / sort / row CTA.
//
// Columns: session | agent | channel | model | tokens (in/out) | cost | spark | open
// Renders DeckGoUsageSessionEntry rows. Selection drives the right-side
// SessionDetail drawer.

const { useMemo, useState } = React;

const SESSION_FILTERS = {
  ALL_AGENTS: "all",
  ALL_CHANNELS: "all",
};

const SESSION_SORTS = [
  { id: "recent", label: "Recent" },
  { id: "cost", label: "Highest cost" },
  { id: "tokens", label: "Most tokens" },
];

function SessionTable({ sessions, selectedKey, onSelect, agentLabels, channelLabels }) {
  const [query, setQuery] = useState("");
  const [filterAgent, setFilterAgent] = useState(SESSION_FILTERS.ALL_AGENTS);
  const [filterChannel, setFilterChannel] = useState(SESSION_FILTERS.ALL_CHANNELS);
  const [sort, setSort] = useState("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = sessions.slice();
    if (q) {
      rows = rows.filter((s) => {
        const blob = [
          s.label || "",
          s.key || "",
          s.sessionId || "",
          agentLabels[s.agentId] || s.agentId || "",
          channelLabels[s.channel] || s.channel || "",
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    if (filterAgent !== SESSION_FILTERS.ALL_AGENTS) {
      rows = rows.filter((s) => s.agentId === filterAgent);
    }
    if (filterChannel !== SESSION_FILTERS.ALL_CHANNELS) {
      rows = rows.filter((s) => s.channel === filterChannel);
    }
    if (sort === "cost") {
      rows.sort((a, b) => (b.usage?.totalCost || 0) - (a.usage?.totalCost || 0));
    } else if (sort === "tokens") {
      rows.sort((a, b) => (b.usage?.totalTokens || 0) - (a.usage?.totalTokens || 0));
    } else {
      rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return rows;
  }, [sessions, query, filterAgent, filterChannel, sort, agentLabels, channelLabels]);

  const agentOptions = useMemo(() => {
    const set = new Set(sessions.map((s) => s.agentId).filter(Boolean));
    return Array.from(set);
  }, [sessions]);

  const channelOptions = useMemo(() => {
    const set = new Set(sessions.map((s) => s.channel).filter(Boolean));
    return Array.from(set);
  }, [sessions]);

  return (
    <section className="session-table">
      <header className="session-table__head">
        <h2 className="session-table__title">Sessions</h2>
        <p className="session-table__hint">
          Click a row to see context-weight, timeseries, and logs.
        </p>
      </header>
      <div className="session-table__filters">
        <label className="session-table__search">
          <IconSearch size={13} />
          <input
            type="search"
            placeholder="Search session label / id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sessions"
          />
        </label>
        <label className="session-table__select">
          <span>Agent</span>
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
            <option value={SESSION_FILTERS.ALL_AGENTS}>All</option>
            {agentOptions.map((id) => (
              <option key={id} value={id}>
                {agentLabels[id] || id}
              </option>
            ))}
          </select>
        </label>
        <label className="session-table__select">
          <span>Channel</span>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}>
            <option value={SESSION_FILTERS.ALL_CHANNELS}>All</option>
            {channelOptions.map((c) => (
              <option key={c} value={c}>
                {channelLabels[c] || c}
              </option>
            ))}
          </select>
        </label>
        <div className="session-table__sort" role="tablist" aria-label="Sort sessions">
          {SESSION_SORTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={sort === s.id}
              className={`ds-seg ${sort === s.id ? "ds-seg--on" : ""}`}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="session-table__empty">
          <strong>No sessions match.</strong>
          <span>Try clearing filters or extending the date range.</span>
        </div>
      ) : (
        <div className="session-table__scroll" role="region" aria-label="Sessions table">
          <table className="session-table__grid">
            <thead>
              <tr>
                <th>Session</th>
                <th>Agent</th>
                <th>Channel</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th className="num">Total</th>
                <th className="num">Cost</th>
                <th>Trend</th>
                <th aria-label="Open"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const u = s.usage || {};
                const sparkValues =
                  s.usage && s.usage.totalTokens
                    ? [
                        Math.round((u.input || 0) * 0.1),
                        Math.round((u.input || 0) * 0.4),
                        Math.round((u.input || 0) * 0.7),
                        Math.round((u.input || 0) + (u.output || 0) * 0.3),
                        Math.round((u.input || 0) + (u.output || 0) * 0.7),
                        u.totalTokens,
                      ]
                    : null;
                return (
                  <tr
                    key={s.key}
                    className={`session-row ${selectedKey === s.key ? "session-row--on" : ""}`}
                    onClick={() => onSelect(s.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(s.key);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedKey === s.key}
                  >
                    <td>
                      <div className="session-row__label">{s.label || s.sessionId || s.key}</div>
                      <div className="session-row__meta">
                        <code>{s.key}</code>
                        <span>·</span>
                        <span>{formatRelative(s.updatedAt)}</span>
                      </div>
                    </td>
                    <td>
                      <AgentChip agentId={s.agentId} label={agentLabels[s.agentId] || s.agentId} />
                    </td>
                    <td>
                      <ChannelChip
                        channel={s.channel}
                        label={channelLabels[s.channel] || s.channel}
                      />
                    </td>
                    <td className="num mono">{formatTokens(u.input)}</td>
                    <td className="num mono">{formatTokens(u.output)}</td>
                    <td className="num mono">
                      <strong>{formatTokens(u.totalTokens)}</strong>
                    </td>
                    <td className="num mono">
                      <strong>{formatCost(u.totalCost)}</strong>
                    </td>
                    <td>
                      {sparkValues ? (
                        <LineSpark values={sparkValues} tone="accent" />
                      ) : (
                        <span className="spark-empty">—</span>
                      )}
                    </td>
                    <td className="session-row__open">
                      <IconChevronRight size={14} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

Object.assign(window, { SessionTable });
