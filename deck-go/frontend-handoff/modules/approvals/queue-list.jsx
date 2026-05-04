// QueueList — left pane with pending exec + plugin approvals, kind filter,
// search, per-row countdown timer, click-to-select.

const QueueList = ({
  pendingExec,
  pendingPlugin,
  selectedId,
  onSelect,
  kindFilter,
  onKindFilter,
  query,
  onQuery,
}) => {
  const merged = React.useMemo(() => {
    const execEntries = pendingExec.map((p) => ({
      ...p,
      __kind: "exec",
      __display: p.command,
      __subtitle: p.agentId || "—",
    }));
    const pluginEntries = pendingPlugin.map((p) => ({
      ...p,
      __kind: "plugin",
      __display: p.pluginName || p.pluginId,
      __subtitle: p.requester || "—",
      expiresAtMs: p.createdAtMs + 5 * 60_000,
    }));
    return [...execEntries, ...pluginEntries].sort((a, b) => a.expiresAtMs - b.expiresAtMs);
  }, [pendingExec, pendingPlugin]);

  const filtered = merged.filter((r) => {
    if (kindFilter !== "all" && r.__kind !== kindFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        (r.__display || "").toLowerCase().includes(q) ||
        (r.__subtitle || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="queue-list" role="region" aria-label="Pending approvals">
      <div className="queue-list__head">
        <h3 className="queue-list__title">Pending queue</h3>
        <span className="queue-list__count">{filtered.length}</span>
      </div>
      <div className="queue-list__filters">
        <div className="seg-filter" role="tablist" aria-label="Approval kind filter">
          {["all", "exec", "plugin"].map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kindFilter === k}
              className={`seg-filter__btn ${kindFilter === k ? "seg-filter__btn--on" : ""}`}
              onClick={() => onKindFilter(k)}
            >
              {k === "all" ? "All" : k === "exec" ? "Exec" : "Plugin"}
              <span className="seg-filter__count">
                {k === "all" ? merged.length : merged.filter((m) => m.__kind === k).length}
              </span>
            </button>
          ))}
        </div>
        <label className="search-input">
          <IconSearch />
          <input
            type="text"
            placeholder="Search command / agent / id"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      </div>
      <ul className="queue-list__rows" role="list">
        {filtered.length === 0 ? (
          <li className="queue-list__empty">No pending approvals match.</li>
        ) : (
          filtered.map((row) => (
            <li
              key={row.id}
              role="listitem"
              tabIndex={0}
              className={`queue-row ${selectedId === row.id ? "queue-row--on" : ""} ${row.__kind === "plugin" ? "queue-row--plugin" : "queue-row--exec"}`}
              onClick={() => onSelect(row.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(row.id);
                }
              }}
            >
              <div className="queue-row__head">
                <KindBadge kind={row.__kind} />
                <CountdownTimer expiresAtMs={row.expiresAtMs} />
              </div>
              <CommandTag command={row.__display} />
              <div className="queue-row__meta">
                <span className="queue-row__subtitle">
                  {row.__kind === "exec" ? <IconUser /> : <IconPlug />}
                  {row.__subtitle}
                </span>
                <span className="queue-row__age">{formatRelative(row.createdAtMs)}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

Object.assign(window, { QueueList });
