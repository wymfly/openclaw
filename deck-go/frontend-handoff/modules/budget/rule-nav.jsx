/* global React, IconSearch, IconPlus, BudgetStatusPill, DimensionIcon, ScopeChip */
const RuleNav = ({
  rules,
  evaluations,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  onCreate,
  fetchedAt,
  onRefresh,
  filterStatus,
  onFilterStatusChange,
}) => {
  const evalById = {};
  evaluations.forEach((e) => {
    evalById[e.ruleId] = e;
  });

  const counts = { ok: 0, warn: 0, over: 0 };
  evaluations.forEach((e) => {
    counts[e.status] = (counts[e.status] || 0) + 1;
  });

  const filtered = rules.filter((r) => {
    if (filterStatus !== "all") {
      const ev = evalById[r.id];
      if (!ev || ev.status !== filterStatus) return false;
    }
    if (!query) return true;
    const q = query.toLowerCase();
    if (r.name.toLowerCase().includes(q)) return true;
    if (r.scope.toLowerCase().includes(q)) return true;
    if (r.agentId && r.agentId.toLowerCase().includes(q)) return true;
    if (r.taskId && r.taskId.toLowerCase().includes(q)) return true;
    if (r.dimension.toLowerCase().includes(q)) return true;
    return false;
  });

  const ageMins = fetchedAt ? Math.max(0, Math.round((Date.now() - fetchedAt) / 60000)) : 0;

  return (
    <aside className="rule-nav" aria-label="Budget rules">
      <div className="rule-nav__head">
        <div className="rule-nav__title">
          <strong>Rules</strong>
          <span className="rule-nav__count">{rules.length}</span>
        </div>
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          onClick={onCreate}
          title="New rule"
        >
          <IconPlus size={12} /> New
        </button>
      </div>

      <div className="rule-nav__status-strip" role="tablist" aria-label="Filter by status">
        {["all", "ok", "warn", "over"].map((s) => {
          const isOn = filterStatus === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={isOn}
              className={`rule-nav__status-tab rule-nav__status-tab--${s} ${isOn ? "rule-nav__status-tab--on" : ""}`}
              onClick={() => onFilterStatusChange(s)}
            >
              <span>{s}</span>
              <span className="rule-nav__status-tab-count">
                {s === "all" ? evaluations.length : counts[s] || 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rule-nav__search">
        <IconSearch size={12} />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name / scope / dimension…"
          aria-label="Search rules"
        />
      </div>

      <div className="rule-nav__list" role="list">
        {filtered.length === 0 ? (
          <div className="rule-nav__empty">No rules match.</div>
        ) : (
          filtered.map((r) => {
            const ev = evalById[r.id];
            const isOn = r.id === selectedId;
            return (
              <button
                key={r.id}
                type="button"
                role="listitem"
                className={`rule-nav__item ${isOn ? "rule-nav__item--on" : ""} ${r.enabled ? "" : "rule-nav__item--disabled"}`}
                onClick={() => onSelect(r.id)}
              >
                <div className="rule-nav__item-head">
                  <strong>{r.name}</strong>
                  {ev ? <BudgetStatusPill status={ev.status} /> : null}
                </div>
                <div className="rule-nav__item-meta">
                  <span className="rule-nav__item-dim">
                    <DimensionIcon dimension={r.dimension} size={11} />
                    <span>{r.dimension}</span>
                  </span>
                  <ScopeChip scope={r.scope} agentId={r.agentId} taskId={r.taskId} />
                  <span className="rule-nav__item-period">per {r.period}</span>
                </div>
                {!r.enabled ? <span className="rule-nav__item-disabled-pill">disabled</span> : null}
              </button>
            );
          })
        )}
      </div>

      <div className="rule-nav__foot">
        <span>{ageMins}m ago</span>
        <button type="button" className="ds-btn ds-btn--ghost ds-btn--xs" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </aside>
  );
};

Object.assign(window, { RuleNav });
