// Full-width list view: header + searchable agent rows + status footer.
const { useState: _lState, useMemo: _lMemo, useRef: _lRef, useEffect: _lEffect } = React;

const SORT_OPTIONS = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name" },
  { value: "sessions", label: "Sessions" },
];
const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "busy", label: "Busy" },
  { value: "idle", label: "Idle" },
];

function ListView({ agents, listState, streamStatus, onSelect, onCreateClick }) {
  const [search, setSearch] = _lState("");
  const [filter, setFilter] = _lState("all");
  const [sort, setSort] = _lState("recent");
  const searchRef = _lRef(null);
  const rowRefs = _lRef([]);

  const visible = _lMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((a) => {
        const haystack = `${a.name} ${a.id} ${a.model ?? ""} ${a.workspace ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
        if (filter === "busy" && a.status !== "busy") return false;
        if (filter === "idle" && a.status !== "idle") return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return (a.name || "").localeCompare(b.name || "");
        if (sort === "sessions") return (b.sessionCount ?? -1) - (a.sessionCount ?? -1);
        return (b.lastActiveAtMs ?? 0) - (a.lastActiveAtMs ?? 0);
      });
  }, [agents, search, filter, sort]);

  // Keyboard nav within rows
  const onRowKey = (e, i) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      rowRefs.current[Math.min(visible.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      rowRefs.current[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(visible[i]?.id);
    }
  };

  // Global ⌘K / "/" focus search
  _lEffect(() => {
    const h = (e) => {
      const isText =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (!isText && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const total = agents.length;
  const busy = agents.filter((a) => a.status === "busy").length;
  const idle = agents.filter((a) => a.status === "idle").length;

  return (
    <div className="view">
      {/* Header */}
      <header className="list-header">
        <div className="list-header__heading">
          <h1>Agents</h1>
          <p>Configure agent identity, skills, runtime policy, files, and event subscriptions.</p>
        </div>
        <div className="list-header__actions">
          <div className="list-search">
            <IconSearch className="list-search__icon" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              placeholder="Search agents"
              aria-label="Search agents"
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="kbd-pair">
              <span className="kbd">⌘</span>
              <span className="kbd">K</span>
            </span>
          </div>
          <button className="btn btn--primary" onClick={onCreateClick}>
            <IconPlus /> New agent
            <span className="kbd-pair" style={{ marginLeft: 4 }}>
              <span className="kbd" style={{ borderColor: "transparent", color: "rgba(0,0,0,.4)" }}>
                ⌘N
              </span>
            </span>
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="list-toolbar">
        <span>
          {visible.length} of {total} {total === 1 ? "agent" : "agents"}
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="segmented" role="radiogroup" aria-label="Filter">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={filter === opt.value}
                className={filter === opt.value ? "is-active" : ""}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="radiogroup" aria-label="Sort">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={sort === opt.value}
                className={sort === opt.value ? "is-active" : ""}
                onClick={() => setSort(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List body */}
      {listState === "loading" ? (
        <div className="list-loading">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : listState === "error" ? (
        <div className="banner banner--error" style={{ marginTop: 12 }}>
          <IconX />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="banner__title">Could not load agents</span>
            <span className="mono">gateway unavailable · agents.list timed out after 5s</span>
          </div>
          <button className="btn banner__action">Retry</button>
        </div>
      ) : agents.length === 0 ? (
        <div className="list-empty">
          <div className="list-empty__icon">
            <IconUser size={24} />
          </div>
          <h3>No agents configured</h3>
          <p>Create the first agent to configure identity, skills, subagents, and event streams.</p>
          <button className="btn btn--primary" onClick={onCreateClick}>
            <IconPlus /> Create first agent
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="list-empty">
          <div className="list-empty__icon">
            <IconSearch size={24} />
          </div>
          <h3>No matches</h3>
          <p>
            No agents match "<strong style={{ color: "var(--ds-text-1)" }}>{search}</strong>" with
            current filters.
          </p>
          <button
            className="btn"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="agent-list" role="list">
          {visible.map((agent, i) => (
            <button
              key={agent.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className="agent-row"
              role="listitem"
              tabIndex={0}
              onClick={() => onSelect(agent.id)}
              onKeyDown={(e) => onRowKey(e, i)}
            >
              <span
                className={`agent-row__avatar${agent.isDefault ? " agent-row__avatar--accent" : ""}`}
                aria-hidden="true"
              >
                {agent.emoji || (agent.name || agent.id || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="agent-row__main">
                <span className="agent-row__name">
                  <strong>{agent.name || agent.id}</strong>
                  {agent.isDefault ? <span className="tag tag--accent">default</span> : null}
                </span>
                <span className="agent-row__sub">
                  <span>{agent.id}</span>
                  <span className="sep">·</span>
                  {agent.model ? (
                    <span>{agent.model}</span>
                  ) : (
                    <span className="agent-row__missing">no model</span>
                  )}
                  <span className="sep">·</span>
                  {agent.workspace ? (
                    <span>{agent.workspace}</span>
                  ) : (
                    <span className="agent-row__missing">no workspace</span>
                  )}
                </span>
              </span>
              <span className="agent-row__status">
                <span className="agent-row__counts">
                  <span className="agent-row__count">
                    <strong>{agent.sessionCount ?? "—"}</strong>sessions
                  </span>
                  <span className="agent-row__count">
                    <strong>{agent.bindingCount ?? "—"}</strong>bindings
                  </span>
                </span>
                <span className={`pill pill--${agent.status || "offline"}`}>
                  <span className="pill__dot" />
                  {agent.status || "unknown"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="view__footer">
        <div className="view__footer-row">
          <span>{total} agents</span>
          {busy > 0 ? <span>· {busy} busy</span> : null}
          {idle > 0 ? <span>· {idle} idle</span> : null}
        </div>
        <div className="view__footer-row">
          <span>
            <span
              className={`pill__dot`}
              style={{
                background:
                  streamStatus === "connected"
                    ? "var(--ds-success)"
                    : streamStatus === "reconnecting"
                      ? "var(--ds-warn)"
                      : "var(--ds-error)",
              }}
            />
            {streamStatus === "connected"
              ? "live · agent.status.changed · activity.event"
              : streamStatus === "reconnecting"
                ? "reconnecting…"
                : "stream disconnected"}
          </span>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { ListView });
