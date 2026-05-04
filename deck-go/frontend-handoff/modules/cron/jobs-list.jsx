// JobsList — left pane: filters + 7-col table (name + schedule + next-run
// + last-status + delivery target + enabled toggle + chevron).

const JobsList = ({
  jobs,
  runs,
  selectedId,
  onSelect,
  query,
  onQuery,
  enabledFilter,
  onEnabledFilter,
  sortBy,
  onSortBy,
}) => {
  const lastByJob = React.useMemo(() => {
    const map = new Map();
    for (const r of runs) {
      const cur = map.get(r.jobId);
      if (!cur || r.ts > cur.ts) map.set(r.jobId, r);
    }
    return map;
  }, [runs]);

  let filtered = jobs;
  if (enabledFilter === "enabled") filtered = filtered.filter((j) => j.enabled);
  if (enabledFilter === "disabled") filtered = filtered.filter((j) => !j.enabled);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (j) =>
        (j.name || "").toLowerCase().includes(q) ||
        (j.id || "").toLowerCase().includes(q) ||
        (j.schedule?.expr || "").toLowerCase().includes(q),
    );
  }

  filtered = [...filtered].sort((a, b) => {
    const av = a[sortBy] ?? Infinity;
    const bv = b[sortBy] ?? Infinity;
    if (typeof av === "number") return av - bv;
    return String(av).localeCompare(String(bv));
  });

  return (
    <div className="jobs-list">
      <div className="jobs-list__head">
        <h3 className="jobs-list__title">Scheduled jobs</h3>
        <span className="jobs-list__count">
          {filtered.length} / {jobs.length}
        </span>
      </div>
      <div className="jobs-list__filters">
        <div className="seg-filter" role="tablist">
          {["all", "enabled", "disabled"].map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={enabledFilter === k}
              className={`seg-filter__btn ${enabledFilter === k ? "seg-filter__btn--on" : ""}`}
              onClick={() => onEnabledFilter(k)}
            >
              {k}
              <span className="seg-filter__count">
                {k === "all"
                  ? jobs.length
                  : k === "enabled"
                    ? jobs.filter((j) => j.enabled).length
                    : jobs.filter((j) => !j.enabled).length}
              </span>
            </button>
          ))}
        </div>
        <label className="search-input">
          <IconSearch />
          <input
            type="text"
            placeholder="Search name / id / cron expr"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        <label className="sort-select">
          <span className="muted small">sort</span>
          <select value={sortBy} onChange={(e) => onSortBy(e.target.value)}>
            <option value="nextRunAtMs">next run</option>
            <option value="updatedAtMs">recently updated</option>
            <option value="name">name</option>
          </select>
        </label>
      </div>
      <div className="jobs-list__table" role="table">
        <div className="jobs-list__table-head" role="row">
          <span role="columnheader">Job</span>
          <span role="columnheader">Schedule</span>
          <span role="columnheader">Next run</span>
          <span role="columnheader">Last run</span>
          <span role="columnheader">Target</span>
          <span role="columnheader">State</span>
          <span role="columnheader" />
        </div>
        {filtered.length === 0 ? (
          <div className="jobs-list__empty">No jobs match.</div>
        ) : (
          filtered.map((j) => {
            const last = lastByJob.get(j.id);
            return (
              <div
                key={j.id}
                role="row"
                tabIndex={0}
                aria-selected={selectedId === j.id}
                className={`jobs-row ${selectedId === j.id ? "jobs-row--on" : ""} ${!j.enabled ? "jobs-row--disabled" : ""}`}
                onClick={() => onSelect(j.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(j.id);
                  }
                }}
              >
                <div className="jobs-row__name" role="cell">
                  <strong>{j.name}</strong>
                  <span className="jobs-row__id">{j.id}</span>
                </div>
                <div className="jobs-row__schedule" role="cell">
                  <ScheduleBadge schedule={j.schedule} />
                  <ScheduleSummary schedule={j.schedule} />
                </div>
                <div className="jobs-row__next" role="cell">
                  {j.enabled ? (
                    <CountdownTimer targetMs={j.nextRunAtMs} prefix="in " />
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                <div className="jobs-row__last" role="cell">
                  {last ? (
                    <span className="jobs-row__last-cluster">
                      <RunStatusBadge status={last.status} />
                      <span className="muted small">{formatRelative(last.ts)}</span>
                    </span>
                  ) : (
                    <span className="muted small">never</span>
                  )}
                </div>
                <div className="jobs-row__target" role="cell">
                  <code className="muted small">{j.sessionTarget}</code>
                </div>
                <div className="jobs-row__state" role="cell">
                  <EnabledToggle enabled={j.enabled} />
                </div>
                <div className="jobs-row__chev" role="cell">
                  <IconChevronR />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

Object.assign(window, { JobsList });
